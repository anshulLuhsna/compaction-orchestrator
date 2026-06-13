import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  CompactionPlan,
  ContextSegment,
  EventRole,
  EventType,
  ExternalizedContent,
  RuntimeContextView,
  SemanticType,
  Session,
  SessionEvent,
  SessionEventInput
} from "./types.js";
import { createId, nowIso } from "./utils.js";

export interface ContextStore {
  createSession(input?: { name?: string; metadata?: Record<string, unknown> }): Session;
  getSession(sessionId: string): Session | undefined;
  listSessions(): Session[];
  addEvent(sessionId: string, input: SessionEventInput): SessionEvent;
  listEvents(sessionId: string): SessionEvent[];
  saveCompaction(plan: CompactionPlan, view: RuntimeContextView, segments: ContextSegment[]): void;
  latestContextView(sessionId: string): RuntimeContextView | undefined;
  listContextViews(sessionId: string): RuntimeContextView[];
  listExternalizedContent(sessionId: string): ExternalizedContent[];
  getExternalizedContent(sessionId: string, segmentId: string): ExternalizedContent | undefined;
}

export class InMemoryStore implements ContextStore {
  private sessions = new Map<string, Session>();
  private events = new Map<string, SessionEvent[]>();
  private plans = new Map<string, CompactionPlan[]>();
  private views = new Map<string, RuntimeContextView[]>();
  private externalized = new Map<string, ExternalizedContent[]>();

  createSession(input: { name?: string; metadata?: Record<string, unknown> } = {}): Session {
    const session: Session = {
      id: createId("ses"),
      name: input.name,
      createdAt: nowIso(),
      metadata: input.metadata ?? {}
    };
    this.sessions.set(session.id, session);
    this.events.set(session.id, []);
    this.plans.set(session.id, []);
    this.views.set(session.id, []);
    this.externalized.set(session.id, []);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  addEvent(sessionId: string, input: SessionEventInput): SessionEvent {
    const sessionEvents = this.requireEvents(sessionId);
    const event: SessionEvent = {
      ...input,
      id: createId("evt"),
      sessionId,
      createdAt: nowIso(),
      sequence: sessionEvents.length + 1
    };
    sessionEvents.push(event);
    return event;
  }

  listEvents(sessionId: string): SessionEvent[] {
    return [...this.requireEvents(sessionId)];
  }

  saveCompaction(plan: CompactionPlan, view: RuntimeContextView, segments: ContextSegment[]): void {
    this.requirePlans(plan.sessionId).push(plan);
    this.requireViews(view.sessionId).push(view);
    this.requireExternalized(plan.sessionId).push(...externalizedFrom(plan, segments));
  }

  latestContextView(sessionId: string): RuntimeContextView | undefined {
    return this.requireViews(sessionId).at(-1);
  }

  listContextViews(sessionId: string): RuntimeContextView[] {
    return [...this.requireViews(sessionId)];
  }

  listExternalizedContent(sessionId: string): ExternalizedContent[] {
    return [...this.requireExternalized(sessionId)];
  }

  getExternalizedContent(sessionId: string, segmentId: string): ExternalizedContent | undefined {
    return this.requireExternalized(sessionId).find((content) => content.segmentId === segmentId);
  }

  private requireEvents(sessionId: string): SessionEvent[] {
    const events = this.events.get(sessionId);
    if (!events) {
      throw new Error(`Unknown session ${sessionId}`);
    }
    return events;
  }

  private requirePlans(sessionId: string): CompactionPlan[] {
    const plans = this.plans.get(sessionId);
    if (!plans) {
      throw new Error(`Unknown session ${sessionId}`);
    }
    return plans;
  }

  private requireViews(sessionId: string): RuntimeContextView[] {
    const views = this.views.get(sessionId);
    if (!views) {
      throw new Error(`Unknown session ${sessionId}`);
    }
    return views;
  }

  private requireExternalized(sessionId: string): ExternalizedContent[] {
    const externalized = this.externalized.get(sessionId);
    if (!externalized) {
      throw new Error(`Unknown session ${sessionId}`);
    }
    return externalized;
  }
}

export class SqliteStore implements ContextStore {
  private db: DatabaseSync;

  constructor(path = "data/compaction-orchestrator.sqlite") {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  createSession(input: { name?: string; metadata?: Record<string, unknown> } = {}): Session {
    const session: Session = {
      id: createId("ses"),
      name: input.name,
      createdAt: nowIso(),
      metadata: input.metadata ?? {}
    };

    this.db.prepare(`
      INSERT INTO sessions (id, name, created_at, metadata_json)
      VALUES (?, ?, ?, ?)
    `).run(session.id, session.name ?? null, session.createdAt, stringify(session.metadata));

    return session;
  }

  getSession(sessionId: string): Session | undefined {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as SessionRow | undefined;
    return row ? sessionFromRow(row) : undefined;
  }

  listSessions(): Session[] {
    const rows = this.db.prepare("SELECT * FROM sessions ORDER BY created_at ASC").all() as SessionRow[];
    return rows.map(sessionFromRow);
  }

  addEvent(sessionId: string, input: SessionEventInput): SessionEvent {
    if (!this.getSession(sessionId)) {
      throw new Error(`Unknown session ${sessionId}`);
    }

    const sequenceRow = this.db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM events WHERE session_id = ?").get(sessionId) as { next_sequence: number };
    const event: SessionEvent = {
      ...input,
      id: createId("evt"),
      sessionId,
      createdAt: nowIso(),
      sequence: sequenceRow.next_sequence
    };

    this.db.prepare(`
      INSERT INTO events (id, session_id, sequence, created_at, role, type, content, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.sessionId,
      event.sequence,
      event.createdAt,
      event.role,
      event.type,
      event.content,
      stringify(event.metadata)
    );

    return event;
  }

  listEvents(sessionId: string): SessionEvent[] {
    this.requireSession(sessionId);
    const rows = this.db.prepare("SELECT * FROM events WHERE session_id = ? ORDER BY sequence ASC").all(sessionId) as EventRow[];
    return rows.map(eventFromRow);
  }

  saveCompaction(plan: CompactionPlan, view: RuntimeContextView, segments: ContextSegment[]): void {
    this.requireSession(plan.sessionId);
    const externalized = externalizedFrom(plan, segments);

    this.db.exec("BEGIN;");
    try {
      this.db.prepare(`
        INSERT INTO compaction_plans (id, session_id, objective, created_at, policy_json, plan_json, warnings_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        plan.id,
        plan.sessionId,
        plan.objective,
        plan.createdAt,
        stringify(plan.policy),
        stringify(plan),
        stringify(plan.warnings)
      );

      for (const segment of segments) {
        this.db.prepare(`
          INSERT OR REPLACE INTO segments (
            id, session_id, event_id, content_type, semantic_type, task_stage, status,
            importance, future_relevance, exactness_required, retrievable,
            reconstruction_cost, artifacts_json, metadata_json, content
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          segment.id,
          segment.sessionId,
          segment.eventId,
          segment.contentType,
          segment.semanticType,
          segment.taskStage,
          segment.status,
          segment.importance,
          segment.futureRelevance,
          segment.exactnessRequired ? 1 : 0,
          segment.retrievable ? 1 : 0,
          segment.reconstructionCost,
          stringify(segment.artifacts),
          stringify(segment.metadata),
          segment.content
        );
      }

      this.db.prepare(`
        INSERT INTO context_views (
          id, session_id, plan_id, created_at, content, token_estimate,
          external_references_json, warnings_json, view_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        view.id,
        view.sessionId,
        view.planId,
        view.createdAt,
        view.content,
        view.tokenEstimate,
        stringify(view.externalReferences),
        stringify(view.warnings),
        stringify(view)
      );

      for (const content of externalized) {
        this.db.prepare(`
          INSERT OR REPLACE INTO externalized_content (
            reference, session_id, segment_id, event_id, semantic_type, content, created_at, metadata_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          content.reference,
          content.sessionId,
          content.segmentId,
          content.eventId,
          content.semanticType,
          content.content,
          content.createdAt,
          stringify(content.metadata)
        );
      }
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  latestContextView(sessionId: string): RuntimeContextView | undefined {
    this.requireSession(sessionId);
    const row = this.db.prepare(`
      SELECT view_json FROM context_views
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(sessionId) as JsonRow | undefined;

    return row ? parseJson<RuntimeContextView>(row.view_json) : undefined;
  }

  listContextViews(sessionId: string): RuntimeContextView[] {
    this.requireSession(sessionId);
    const rows = this.db.prepare(`
      SELECT view_json FROM context_views
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(sessionId) as JsonRow[];

    return rows.map((row) => parseJson<RuntimeContextView>(row.view_json));
  }

  listExternalizedContent(sessionId: string): ExternalizedContent[] {
    this.requireSession(sessionId);
    const rows = this.db.prepare(`
      SELECT * FROM externalized_content
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(sessionId) as ExternalizedRow[];

    return rows.map(externalizedFromRow);
  }

  getExternalizedContent(sessionId: string, segmentId: string): ExternalizedContent | undefined {
    this.requireSession(sessionId);
    const row = this.db.prepare(`
      SELECT * FROM externalized_content
      WHERE session_id = ? AND segment_id = ?
    `).get(sessionId, segmentId) as ExternalizedRow | undefined;

    return row ? externalizedFromRow(row) : undefined;
  }

  private requireSession(sessionId: string): void {
    if (!this.getSession(sessionId)) {
      throw new Error(`Unknown session ${sessionId}`);
    }
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        role TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        UNIQUE(session_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS segments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        content_type TEXT NOT NULL,
        semantic_type TEXT NOT NULL,
        task_stage TEXT NOT NULL,
        status TEXT NOT NULL,
        importance REAL NOT NULL,
        future_relevance REAL NOT NULL,
        exactness_required INTEGER NOT NULL,
        retrievable INTEGER NOT NULL,
        reconstruction_cost TEXT NOT NULL,
        artifacts_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        content TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS compaction_plans (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        objective TEXT NOT NULL,
        created_at TEXT NOT NULL,
        policy_json TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        warnings_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS context_views (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL REFERENCES compaction_plans(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        content TEXT NOT NULL,
        token_estimate INTEGER NOT NULL,
        external_references_json TEXT NOT NULL,
        warnings_json TEXT NOT NULL,
        view_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS externalized_content (
        reference TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        semantic_type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_events_session_sequence ON events(session_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_context_views_session_created ON context_views(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_externalized_session_segment ON externalized_content(session_id, segment_id);
    `);
  }
}

function externalizedFrom(plan: CompactionPlan, segments: ContextSegment[]): ExternalizedContent[] {
  const segmentsById = new Map(segments.map((segment) => [segment.id, segment]));
  return plan.segments.flatMap((segmentPlan) => {
    if (!segmentPlan.result.externalReference) {
      return [];
    }

    const segment = segmentsById.get(segmentPlan.segmentId);
    if (!segment) {
      return [];
    }

    return [{
      reference: segmentPlan.result.externalReference,
      sessionId: segment.sessionId,
      segmentId: segment.id,
      eventId: segment.eventId,
      semanticType: segment.semanticType,
      content: segment.content,
      createdAt: nowIso(),
      metadata: {
        operation: segmentPlan.operation,
        provenance: segmentPlan.result.provenance
      }
    }];
  });
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

type SessionRow = {
  id: string;
  name: string | null;
  created_at: string;
  metadata_json: string;
};

type EventRow = {
  id: string;
  session_id: string;
  sequence: number;
  created_at: string;
  role: string;
  type: string;
  content: string;
  metadata_json: string;
};

type JsonRow = {
  view_json: string;
};

type ExternalizedRow = {
  reference: string;
  session_id: string;
  segment_id: string;
  event_id: string;
  semantic_type: string;
  content: string;
  created_at: string;
  metadata_json: string;
};

function sessionFromRow(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name ?? undefined,
    createdAt: row.created_at,
    metadata: parseJson<Record<string, unknown>>(row.metadata_json)
  };
}

function eventFromRow(row: EventRow): SessionEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    sequence: row.sequence,
    createdAt: row.created_at,
    role: row.role as EventRole,
    type: row.type as EventType,
    content: row.content,
    metadata: parseJson<Record<string, unknown>>(row.metadata_json)
  };
}

function externalizedFromRow(row: ExternalizedRow): ExternalizedContent {
  return {
    reference: row.reference,
    sessionId: row.session_id,
    segmentId: row.segment_id,
    eventId: row.event_id,
    semanticType: row.semantic_type as SemanticType,
    content: row.content,
    createdAt: row.created_at,
    metadata: parseJson<Record<string, unknown>>(row.metadata_json)
  };
}
