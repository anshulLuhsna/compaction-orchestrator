# API Reference

Base URL:

```text
http://localhost:3000
```

The API is the sidecar version of the compaction control layer. Use it when you want persisted sessions, replayable compaction plans, UI inspection, or context coordination across processes.

Every compaction response includes a `plan`. That plan records which strategy was chosen for each context segment in the turn.

## Health

```http
GET /health
```

Response:

```json
{
  "ok": true,
  "service": "compaction-orchestrator-api"
}
```

## Create Session

```http
POST /v1/sessions
```

Request:

```json
{
  "name": "demo",
  "metadata": {
    "agent": "coding-agent"
  }
}
```

Response:

```json
{
  "session": {
    "id": "ses_...",
    "name": "demo",
    "createdAt": "2026-06-13T...",
    "metadata": {}
  }
}
```

## List Sessions

```http
GET /v1/sessions
```

## Get Session

```http
GET /v1/sessions/:sessionId
```

## Append Event

```http
POST /v1/sessions/:sessionId/events
```

Request:

```json
{
  "role": "user",
  "type": "message",
  "content": "Use Hono. Do not use Express.",
  "metadata": {
    "artifacts": ["apps/api/src/index.ts"]
  }
}
```

Allowed roles:

- `user`
- `assistant`
- `tool`
- `system`

Allowed event types:

- `message`
- `tool_call`
- `tool_output`
- `decision`
- `artifact`
- `compaction`

## List Events

```http
GET /v1/sessions/:sessionId/events
```

## One-Shot Compact

```http
POST /v1/compact
```

Use this when you want to try the API with one request instead of creating a session and appending events manually. The API creates a persisted session behind the scenes, stores the generated context view, and returns the session ID so you can inspect `/context` or `/externalized` afterward.

Request:

```json
{
  "sessionName": "coding-agent-router-debug-demo",
  "messages": [
    {
      "role": "user",
      "content": "Use Hono only. Do not add Express.",
      "metadata": {
        "artifacts": ["apps/api/src/index.ts"]
      }
    },
    {
      "role": "tool",
      "content": "npm run typecheck failed: Cannot find module './billing-store.js'"
    }
  ],
  "objective": "Prepare compact context for the next coding-agent turn.",
  "desiredBudget": 1200,
  "policy": {
    "mode": "balanced",
    "preserveActiveErrorsVerbatim": false
  }
}
```

Set `"useCase": "customer_support"` to return a customer-support `contextPackage` in the same response.

Response includes:

- `session`: persisted session created for the request
- `sessionId`
- `segments`
- `plan`: the per-segment compaction choices for this turn
- `contextView`
- `contextPackage` when `useCase` is `customer_support`

## Compact Session

```http
POST /v1/sessions/:sessionId/compact
```

Request:

```json
{
  "objective": "Continue implementing the API",
  "desiredBudget": 8000,
  "policy": {
    "mode": "balanced",
    "preserveUserMessagesVerbatim": true,
    "preserveActiveErrorsVerbatim": false,
    "allowExternalRetrieval": true,
    "allowHandoff": true,
    "requireApprovalForHighRiskChanges": true
  }
}
```

Policy modes:

- `accuracy_first`
- `balanced`
- `cost_first`
- `long_horizon`
- `human_controlled`

Response includes:

- `segments`: classified context segments
- `plan`: strategy decisions and validation output for each segment in the turn
- `contextView`: compacted runtime context

The same session can produce different plans when you change the objective, desired budget, or policy.

## Get Latest Context View

```http
GET /v1/sessions/:sessionId/context
```

Returns the most recent compacted runtime context view.

## Build Customer Support Context Package

```http
POST /v1/sessions/:sessionId/context-package
```

Request:

```json
{
  "objective": "Prepare a reliable handoff package for the next support agent.",
  "desiredBudget": 1600,
  "policy": {
    "mode": "balanced",
    "preserveUserMessagesVerbatim": true,
    "preserveActiveErrorsVerbatim": false,
    "allowExternalRetrieval": true
  }
}
```

Response includes:

- `segments`
- `contextPackage.customer`
- `contextPackage.issue`
- `contextPackage.preservedInstructions`
- `contextPackage.policyConstraints`
- `contextPackage.troubleshooting`
- `contextPackage.decisions`
- `contextPackage.escalation`
- `contextPackage.nextActions`
- `contextPackage.runtimeContext`
- `contextPackage.compactionPlan`
- `contextPackage.externalReferences`
- `contextPackage.metrics`

## List Context Views

```http
GET /v1/sessions/:sessionId/context-views
```

Returns all context views generated for the session.

## List Externalized Content

```http
GET /v1/sessions/:sessionId/externalized
```

Returns metadata for full content that was moved out of the active runtime context.

Response:

```json
{
  "externalized": [
    {
      "reference": "memory://ses_.../seg_...",
      "segmentId": "seg_...",
      "eventId": "evt_...",
      "semanticType": "tool_observation",
      "createdAt": "2026-06-13T...",
      "metadata": {},
      "contentLength": 12000
    }
  ]
}
```

## Fetch Externalized Content

```http
GET /v1/sessions/:sessionId/externalized/:segmentId
```

Returns the full externalized content for a segment.
