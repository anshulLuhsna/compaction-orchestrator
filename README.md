# Your Agent Does Not Need One Summary. It Needs a Compaction Plan.

Compaction Orchestrator is an open-source compaction control layer for custom AI agents.

Long-running agents eventually hit the same wall: too much context, too much tool output, too many decisions, too many half-useful logs.

The default answer is one generic summary.

That is the wrong primitive.

A user constraint should not be compressed like an old search result. An active typecheck error should not be treated like completed exploration. A customer escalation should not disappear because it happened ten turns ago.

Compaction Orchestrator gives the agent a plan.

It stores the raw session, classifies the context, chooses a strategy for each segment in the current turn, and returns a smaller runtime context view.

![Compaction control hero placeholder](./docs/images/compaction-control-hero.png)

## The Core Idea

Compaction is not one operation.

It is a routing decision.

```text
raw session events
-> segment classification
-> per-segment strategy routing
-> compaction plan
-> runtime context view
```

One turn can mix strategies:

```text
user constraint      -> keep_verbatim
current failure      -> extract_active_error
large tool output    -> externalize_for_retrieval
completed work       -> structured_summary
```

The original session is not overwritten. The canonical event log stays intact. Every compaction creates a derived context view with an inspectable plan.

## Why This Exists

Most agent memory systems optimize for smaller context.

That is not enough.

The real question is not:

```text
How do we summarize this conversation?
```

The real question is:

```text
What should each piece of context become before the next model call?
```

That is the difference between a summarizer and a control layer.

## What Is Built

| Surface | What it does | Why it matters |
| --- | --- | --- |
| SDK | Runs `compact()` inside an agent loop | Fastest path for builders |
| CLI | Compacts a JSON session from file or stdin | Easy local demo and debugging |
| HTTP API | Persists sessions and returns context views | Sidecar orchestration path |
| SQLite store | Saves sessions, events, plans, views, externalized content | Replayable local state |
| Web UI | Shows input, output, strategies, metrics, eval | Demo and inspection surface |
| OpenAPI spec | Documents the HTTP contract | Easier integration |

## Try the SDK

```bash
npm install
npm run demo:coding
```

Use it from code:

```ts
import { compact } from "@compaction-orchestrator/core";

const result = compact({
  messages,
  objective: "Prepare context for the next agent turn.",
  policy: {
    mode: "balanced",
    preserveUserMessagesVerbatim: true,
    allowExternalRetrieval: true
  }
});

console.log(result.contextView.content);
console.log(result.plan.segments.map((segment) => segment.operation));
```

The important output is not only `contextView`.

It is `plan`.

That plan tells you what the agent chose to keep, extract, externalize, or summarize.

## Try the CLI

```bash
npm run demo:cli
```

After publishing, the intended path is:

```bash
npx @compaction-orchestrator/core examples/coding-agent-session.json
```

The CLI returns JSON with selected operations, metrics, runtime context, and optional context package output.

## Try the API and UI

Start the API:

```bash
npm run dev
```

Start the UI:

```bash
npm run dev:web
```

Open:

```text
http://127.0.0.1:5173
```

Use **Coding** to see a developer-agent session. Use **Support** to see a customer-support handoff.

![UI strategy plan placeholder](./docs/images/ui-strategy-plan.png)

## Demo 1: Coding Agent

The coding fixture includes:

- A user constraint: use Hono, do not add Express
- A required route: `/v1/billing/:invoiceId`
- A required response shape: `{ ok, invoiceId, status }`
- A noisy search result
- An active typecheck failure
- A next action

The compaction plan keeps the exact constraints, extracts the active error, externalizes noisy output, and summarizes completed exploration.

## Demo 2: Customer Support

The support fixture includes:

- Customer identity
- Account id
- Invoice facts
- Refund policy constraint
- Billing portal error
- Escalation state
- Next action

The output is a typed support handoff package with customer, issue, escalation, policy constraints, next actions, runtime context, metrics, and external references.

## Strategy Matrix

| Context type | Default risk | Strategy |
| --- | --- | --- |
| User instruction | Exact wording gets lost | `keep_verbatim` |
| Active error | Debugging signal gets blurred | `extract_active_error` |
| Large tool output | Context window gets flooded | `externalize_for_retrieval` |
| Completed exploration | Old work takes too much space | `structured_summary` |
| Support escalation | Operational state gets dropped | use-case package |

## Package Shape

The root package is SDK-first:

```ts
import {
  compact,
  compactCustomerSupport,
  messagesToEvents
} from "@compaction-orchestrator/core";
```

Persistence is explicit:

```ts
import { SqliteStore } from "@compaction-orchestrator/core/store";
```

## API Shape

One-shot compaction:

```http
POST /v1/compact
```

Persisted session compaction:

```http
POST /v1/sessions/:sessionId/compact
```

Customer-support package:

```http
POST /v1/sessions/:sessionId/context-package
```

The OpenAPI contract lives at:

```text
docs/openapi.yaml
```

## Local Checks

```bash
npm run typecheck
npm run build
npm run build:web
npm run test:sdk
npm run test:cli
npm run test:api
npm run demo:coding
```

## Documentation

- [Build summary](./docs/build-summary.md)
- [SDK quickstart](./docs/sdk.md)
- [CLI quickstart](./docs/cli.md)
- [API reference](./docs/api.md)
- [OpenAPI contract](./docs/openapi.yaml)
- [Strategy picker data flow](./docs/strategy-picker-data-flow.md)
- [Strategy plugins](./docs/strategies.md)
- [Customer support demo](./docs/customer-support-demo.md)
- [Launch demo guide](./docs/launch-demo.md)
- [Launch article draft](./docs/articles/compaction-control-layer.md)
- [Image prompts](./docs/image-prompts.md)

## Current Status

This is launchable as an alpha.

It has a working SDK, CLI, API, SQLite persistence layer, UI demo, examples, tests, docs, OpenAPI spec, CI, MIT license, and npm package metadata.

It is not production infrastructure yet.

The next useful work is sharper UI demo polish, optional LLM-powered strategies behind the existing interface, and a production persistence option later.

## License

MIT
