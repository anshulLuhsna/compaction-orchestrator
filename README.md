# Compaction Orchestrator

Open-source compaction control for custom AI agents.

Most agent systems eventually need to shrink long conversations. The usual answer is one generic summary or a hidden provider-specific compaction step. That is cheap to build, but it gives developers very little control over what survives. It can drop active errors, policy constraints, customer state, tool evidence, or the next action.

Compaction Orchestrator is a control layer for those choices. It lets your agent choose different compaction strategies per turn and per context segment, so each piece of context gets the treatment that fits its type, risk, use case, and latency target.

The first developer experience is an in-process SDK. The API and UI are the proof and orchestration layer.

```ts
import { compact } from "@compaction-orchestrator/core";

const result = compact({
  messages,
  objective: "Prepare the next support-agent handoff.",
  useCase: "customer_support"
});

console.log(result.contextView.content);
console.log(result.contextPackage?.nextActions);
```

The V0 proves the core shape:

```text
raw session events
→ segment classification
→ strategy routing per segment
→ compaction plan
→ validated runtime context view
```

The canonical event log stays intact. Compaction produces a new context view.

One turn can mix strategies:

```text
user constraint      -> keep_verbatim
current test failure -> extract_active_error
large tool output    -> externalize_for_retrieval
completed research   -> structured_summary
```

## Try It

Run the zero-server SDK demo:

```bash
npm install
npm run test:sdk
npm run test:cli
npm run test:api
npm run demo:sdk
npm run demo:coding
npm run demo:cli
```

The support demo reads `examples/customer-support-session.json` and prints:

- Preserved customer/support state
- Selected compaction operations
- Escalation and next action
- Token reduction metrics

The coding-agent demo reads `examples/coding-agent-session.json` and shows the agent-builder case:

- User constraints stay verbatim
- Noisy search output is externalized
- Active typecheck errors are extracted
- Next action survives as compact runtime context

The CLI demo runs the same coding-agent fixture through the package bin path. After publishing, the intended shape is:

```bash
npx @compaction-orchestrator/core examples/coding-agent-session.json
```

Then run the API and UI for the visual demo:

```bash
npm run dev
```

Try the one-shot HTTP API with a plain message array:

```bash
API_URL=http://localhost:3000 npm run test:oneshot
```

In another terminal:

```bash
npm run dev:web
```

Open `http://127.0.0.1:5173`, choose **Support** or **Coding**, then use **Run package** / **Run compact** and **Evaluate**. Support shows the typed handoff package; Coding shows a developer-native runtime context with constraints, active error, strategy plan, and externalized noisy output.

## Current Status

This repo contains the first executable prototype:

- Append-only session event ingestion
- Segment classification
- Per-turn, per-segment strategy routing
- Runtime context view generation
- In-process SDK helper
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

- [SDK quickstart](./docs/sdk.md)
- [CLI quickstart](./docs/cli.md)
- [Product brief](./docs/product-brief.md)
- [Pitch](./docs/pitch.md)
- [Architecture](./docs/architecture.md)
- [API reference](./docs/api.md)
- [OpenAPI contract](./docs/openapi.yaml)
- [Strategy picker data flow](./docs/strategy-picker-data-flow.md)
- [Strategy plugins](./docs/strategies.md)
- [Data model](./docs/data-model.md)
- [Evaluation plan](./docs/evaluation.md)
- [OpenAI setup](./docs/openai-setup.md)
- [Customer support demo](./docs/customer-support-demo.md)
- [Launch demo guide](./docs/launch-demo.md)
- [Roadmap](./docs/roadmap.md)

## Run the API

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

This only verifies OpenAI connectivity. The current strategy picker remains deterministic; the next step is to add an optional OpenAI-powered strategy or planner behind the same control layer.

## SDK

### Compact plain messages

```ts
import { compact } from "@compaction-orchestrator/core";

const result = compact({
  messages: [
    {
      role: "system",
      content: "Support policy: do not promise refunds above $5,000 without Billing Ops approval."
    },
    {
      role: "user",
      content: "Customer Maya Chen was double charged and cannot open the billing page."
    },
    {
      role: "tool",
      content: "Error: billing_portal_v2=false for account ACME-ENT-4481. Owner receives 403."
    }
  ],
  objective: "Prepare support handoff",
  useCase: "customer_support"
});

console.log(result.contextView.content);
```

Use `compact()` when you want a function call inside your agent loop. Use the HTTP API when you want persisted sessions, UI inspection, or sidecar orchestration.

The package root stays SDK-only. Import persistence explicitly when you need it:

```ts
import { SqliteStore } from "@compaction-orchestrator/core/store";
```

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

## Coding-Agent SDK Demo

Run the developer-native fixture without starting the API server:

```bash
npm run demo:coding
```

This compacts `examples/coding-agent-session.json` and verifies that the SDK preserves framework constraints, response shape, route path, active typecheck failure, and next action while externalizing noisy search output.

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

Use **Support** for the customer-support handoff package demo. Use **Coding** for the agent-builder demo that preserves framework constraints, active typecheck failure, route shape, and next action. **Evaluate** compares the adaptive output against the Goldfish generic-summary baseline for the selected fixture.

Use **Import JSON** in the Input Session panel to load a local `.json` fixture. The imported JSON is copied into the editor, so you can change it before running package or evaluation.

## Next Recommended Step

Improve segmentation next: split long events into smaller segments so one large tool observation can produce multiple treatments instead of one strategy for the whole event.
