# API Reference

Base URL:

```text
http://localhost:3000
```

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
- `plan`: strategy decisions and validation output
- `contextView`: compacted runtime context

## Get Latest Context View

```http
GET /v1/sessions/:sessionId/context
```

Returns the most recent compacted runtime context view.

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
