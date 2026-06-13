import { serve } from "@hono/node-server";
import { compactSession, sessionEventInputSchema, SqliteStore } from "@compaction-orchestrator/core";
import { Hono } from "hono";
import { z } from "zod";

const app = new Hono();
const store = new SqliteStore(process.env.DATABASE_URL ?? "data/compaction-orchestrator.sqlite");

const createSessionSchema = z.object({
  name: z.string().optional(),
  metadata: z.record(z.unknown()).default({})
});

const compactRequestSchema = z.object({
  objective: z.string().min(1),
  desiredBudget: z.number().int().positive().optional(),
  policy: z.object({
    mode: z.enum(["accuracy_first", "balanced", "cost_first", "long_horizon", "human_controlled"]).optional(),
    preserveUserMessagesVerbatim: z.boolean().optional(),
    preserveActiveErrorsVerbatim: z.boolean().optional(),
    allowExternalRetrieval: z.boolean().optional(),
    allowHandoff: z.boolean().optional(),
    requireApprovalForHighRiskChanges: z.boolean().optional()
  }).default({})
});

app.get("/health", (context) => {
  return context.json({ ok: true, service: "compaction-orchestrator-api" });
});

app.post("/v1/sessions", async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return context.json({ error: "Invalid session payload", issues: parsed.error.issues }, 400);
  }

  const session = store.createSession(parsed.data);
  return context.json({ session }, 201);
});

app.get("/v1/sessions", (context) => {
  return context.json({ sessions: store.listSessions() });
});

app.get("/v1/sessions/:sessionId", (context) => {
  const session = store.getSession(context.req.param("sessionId"));
  if (!session) {
    return context.json({ error: "Session not found" }, 404);
  }

  return context.json({ session });
});

app.post("/v1/sessions/:sessionId/events", async (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const body = await context.req.json().catch(() => undefined);
  const parsed = sessionEventInputSchema.safeParse(body);
  if (!parsed.success) {
    return context.json({ error: "Invalid event payload", issues: parsed.error.issues }, 400);
  }

  const event = store.addEvent(sessionId, parsed.data);
  return context.json({ event }, 201);
});

app.get("/v1/sessions/:sessionId/events", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  return context.json({ events: store.listEvents(sessionId) });
});

app.post("/v1/sessions/:sessionId/compact", async (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const body = await context.req.json().catch(() => undefined);
  const parsed = compactRequestSchema.safeParse(body);
  if (!parsed.success) {
    return context.json({ error: "Invalid compaction payload", issues: parsed.error.issues }, 400);
  }

  const output = compactSession({
    sessionId,
    events: store.listEvents(sessionId),
    objective: parsed.data.objective,
    desiredBudget: parsed.data.desiredBudget,
    policy: parsed.data.policy
  });

  store.saveCompaction(output.plan, output.contextView, output.segments);
  return context.json(output);
});

app.get("/v1/sessions/:sessionId/context", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const latest = store.latestContextView(sessionId);
  if (!latest) {
    return context.json({ error: "No context view exists yet. Call /compact first." }, 404);
  }

  return context.json({ contextView: latest });
});

app.get("/v1/sessions/:sessionId/context-views", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  return context.json({ contextViews: store.listContextViews(sessionId) });
});

app.get("/v1/sessions/:sessionId/externalized", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const items = store.listExternalizedContent(sessionId).map((item) => ({
    reference: item.reference,
    segmentId: item.segmentId,
    eventId: item.eventId,
    semanticType: item.semanticType,
    createdAt: item.createdAt,
    metadata: item.metadata,
    contentLength: item.content.length
  }));

  return context.json({ externalized: items });
});

app.get("/v1/sessions/:sessionId/externalized/:segmentId", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const item = store.getExternalizedContent(sessionId, context.req.param("segmentId"));
  if (!item) {
    return context.json({ error: "Externalized content not found" }, 404);
  }

  return context.json({ externalized: item });
});

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Compaction Orchestrator API listening on http://localhost:${info.port}`);
});
