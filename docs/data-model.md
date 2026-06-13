# Data Model

## Session

A session is a conversation or agent run.

```ts
type Session = {
  id: string;
  name?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};
```

## Session Event

An event is an append-only raw record.

```ts
type SessionEvent = {
  id: string;
  sessionId: string;
  sequence: number;
  createdAt: string;
  role: "user" | "assistant" | "tool" | "system";
  type: "message" | "tool_call" | "tool_output" | "decision" | "artifact" | "compaction";
  content: string;
  metadata: Record<string, unknown>;
};
```

## Context Segment

A segment is the router-friendly representation of an event.

```ts
type ContextSegment = {
  id: string;
  eventId: string;
  sessionId: string;
  content: string;
  semanticType: SemanticType;
  taskStage: TaskStage;
  status: SegmentStatus;
  artifacts: string[];
  importance: number;
  futureRelevance: number;
  exactnessRequired: boolean;
  retrievable: boolean;
  reconstructionCost: "low" | "medium" | "high";
  metadata: Record<string, unknown>;
};
```

Current semantic types:

- `user_instruction`
- `active_error`
- `tool_observation`
- `artifact_reference`
- `decision`
- `completed_exploration`
- `general_context`

## Compaction Plan

A plan records what happened to each segment and why.

```ts
type CompactionPlan = {
  id: string;
  sessionId: string;
  objective: string;
  createdAt: string;
  policy: CompactionPolicy;
  segments: SegmentPlan[];
  warnings: string[];
};
```

## Runtime Context View

A context view is the compacted context an agent can consume.

```ts
type RuntimeContextView = {
  id: string;
  sessionId: string;
  planId: string;
  createdAt: string;
  content: string;
  tokenEstimate: number;
  externalReferences: string[];
  warnings: string[];
};
```

## Future SQLite Tables

Implemented SQLite tables:

```text
sessions
events
segments
compaction_plans
context_views
externalized_content
```

The current implementation stores `SegmentPlan` objects inside `compaction_plans.plan_json`. We can normalize them into a separate `segment_plans` table later if querying per-segment plans becomes important.
