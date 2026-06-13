# compaction-orchestrator

A pluggable Context API for applying context-specific and use-case-specific compaction strategies to agent sessions.

Most agent systems compact context with one generic summary. This project treats compaction as a routing problem: each piece of context gets the treatment that fits its type, risk, and use case.

The V0 proves the core shape:

```text
raw session events
→ segment classification
→ strategy routing
→ compaction plan
→ validated runtime context view
```

The canonical event log stays intact. Compaction produces a new context view.

## Current Status

This repo contains the first executable API prototype:

- Append-only session event ingestion
- Segment classification
- Strategy routing
- Runtime context view generation
- SQLite persistence
- Customer-support context package output
- Deterministic built-in strategies
- Smoke test covering mixed strategy selection

## Stack

- TypeScript
- Hono HTTP API
- SQLite persistence through Node's built-in `node:sqlite`
- Pluggable strategy interface in `packages/core`

## Documentation

- [Product brief](./docs/product-brief.md)
- [Pitch](./docs/pitch.md)
- [Architecture](./docs/architecture.md)
- [API reference](./docs/api.md)
- [Strategy picker data flow](./docs/strategy-picker-data-flow.md)
- [Strategy plugins](./docs/strategies.md)
- [Data model](./docs/data-model.md)
- [Evaluation plan](./docs/evaluation.md)
- [OpenAI setup](./docs/openai-setup.md)
- [Customer support demo](./docs/customer-support-demo.md)
- [Roadmap](./docs/roadmap.md)

## Run

```bash
npm install
npm run dev
```

The API listens on `http://localhost:3000`.

By default, runtime data is stored in:

```text
data/compaction-orchestrator.sqlite
```

Override it with:

```bash
DATABASE_URL=data/dev.sqlite npm run dev
```

Node currently prints an experimental warning for `node:sqlite`. That is acceptable for this local V0; we can swap to a production SQLite/Postgres driver later behind the same store interface.

## OpenAI Setup

Create a local environment file:

```bash
cp .env.example .env
```

Then set:

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5.5
```

Keep `.env` local. It is ignored by git.

With the API running, check configuration:

```bash
curl -s http://localhost:3000/v1/openai/status
```

Run a live API smoke test:

```bash
npm run openai:check
```

This only verifies OpenAI connectivity. The current compaction picker remains deterministic; the next step is to add an optional OpenAI-powered strategy or planner.

## API

### Create a session

```bash
curl -s http://localhost:3000/v1/sessions \
  -H 'content-type: application/json' \
  -d '{"name":"demo"}'
```

### Append an event

```bash
curl -s http://localhost:3000/v1/sessions/:session_id/events \
  -H 'content-type: application/json' \
  -d '{
    "role": "user",
    "type": "message",
    "content": "Use Hono. Preserve this instruction exactly.",
    "metadata": {}
  }'
```

### Compact a session

```bash
curl -s http://localhost:3000/v1/sessions/:session_id/compact \
  -H 'content-type: application/json' \
  -d '{
    "objective": "Continue implementing the API",
    "desiredBudget": 8000,
    "policy": { "mode": "balanced" }
  }'
```

### Build a customer-support context package

```bash
curl -s http://localhost:3000/v1/sessions/:session_id/context-package \
  -H 'content-type: application/json' \
  -d '{
    "objective": "Prepare support handoff",
    "desiredBudget": 1600,
    "policy": { "mode": "balanced" }
  }'
```

### Fetch latest context view

```bash
curl -s http://localhost:3000/v1/sessions/:session_id/context
```

### List externalized content

```bash
curl -s http://localhost:3000/v1/sessions/:session_id/externalized
```

### Fetch externalized content by segment

```bash
curl -s http://localhost:3000/v1/sessions/:session_id/externalized/:segment_id
```

### Check OpenAI configuration

```bash
curl -s http://localhost:3000/v1/openai/status
```

### Run OpenAI smoke test

```bash
curl -s -X POST http://localhost:3000/v1/openai/test
```

## Built-in Strategies

- `keep_verbatim`: preserves exact high-risk instructions and critical context
- `extract_active_error`: keeps active debugging signal without noisy full logs
- `externalize_for_retrieval`: moves large retrievable content outside active context
- `mask_tool_output`: replaces stale tool output with metadata
- `structured_summary`: deterministic fallback summary with artifact retention

## Project Layout

```text
apps/api
  HTTP API routes and local server

packages/core
  event model, segmenter, strategy registry, compactor, SQLite store

scripts
  smoke-test.mjs
```

## Smoke Test

In one terminal:

```bash
npm run dev
```

In another:

```bash
npm run test:smoke
```

Expected result includes mixed operations:

```json
{
  "operations": ["keep_verbatim", "extract_active_error"]
}
```

To verify externalized content retrieval:

```bash
npm run test:persistence
```

## Customer Support End-To-End Demo

With the API running:

```bash
npm run demo:support
```

This ingests `examples/customer-support-session.json` and returns a structured context package with customer, issue, escalation, next actions, selected compaction strategies, metrics, and external references.

Run the Goldfish-vs-adaptive evaluation:

```bash
npm run eval:support
```

Expected result: `adaptive_context_package` wins on recall, especially active support state.

## Web UI

Run the API:

```bash
DATABASE_URL=data/ui.sqlite npm run start
```

Run the shadcn-style UI in another terminal:

```bash
npm run dev:web
```

Open:

```text
http://127.0.0.1:5173
```

Use **Run package** to ingest the customer-support fixture and view the context package. Use **Evaluate** to compare the adaptive package against the Goldfish generic-summary baseline.

Use **Import JSON** in the Input Session panel to load a local `.json` fixture. The imported JSON is copied into the editor, so you can change it before running package or evaluation.

## Next Recommended Step

Improve segmentation next: split long events into smaller segments so one large tool observation can produce multiple treatments instead of one strategy for the whole event.
