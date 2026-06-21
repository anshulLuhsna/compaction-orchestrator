# Your Agent Does Not Need One Summary. It Needs a Compaction Plan.

Compaction Orchestrator is an open-source compaction control layer for custom AI agents.

Long-running agents eventually hit the same wall: too much context, too much tool output, too many decisions, too many half-useful logs.

The default answer is usually trimming, rolling summaries, or one generic summary.

That is the wrong primitive.

A user constraint should not be compressed like an old search result. An active typecheck error should not be treated like completed exploration. A customer escalation should not disappear because it happened ten turns ago.

Compaction Orchestrator gives the agent a plan.

It stores the raw session, classifies the context, chooses a strategy for each segment in the current turn, and returns a smaller runtime context view.

<img width="2400" height="965" alt="Gemini_Generated_Image_t7whext7whext7wh-Photoroom" src="https://github.com/user-attachments/assets/8a39c61d-c8c2-466b-95c7-90d9349af3b3" />


Repo: [github.com/anshulLuhsna/compaction-orchestrator](https://github.com/anshulLuhsna/compaction-orchestrator)

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

## Use Cases Included

The repo ships with three runnable fixtures. Each one is designed around a different reason compaction fails in real agents.

| Use case | Fixture | What usually breaks | What the plan preserves |
| --- | --- | --- | --- |
| Coding agent | `examples/coding-agent-session.json` | One-size-fits-all memory loses exact constraints or active build errors | Hono-only constraint, route path, response shape, typecheck failure, next command |
| Customer support agent | `examples/customer-support-session.json` | Generic handoff memory drops operational state | Customer, account, refund policy, duplicate invoices, entitlement error, escalation, next action |
| Voice agent | `examples/voice-agent-session.json` | A latency-first agent keeps the context short but loses slot or consent state | Caller intent, reschedule-only consent, selected appointment slot, low-latency budget, next spoken prompt |

Current ACCS examples:

| Use case | Generic summary ACCS | Strongest baseline ACCS | Compaction Orchestrator ACCS | Demo command |
| --- | ---: | ---: | ---: | --- |
| Coding agent | 0.548 | 0.698 | 0.836 | `npm run demo:coding` |
| Customer support | 0.410 | 0.474 | 0.773 | `npm run demo:support` |
| Voice agent | 0.430 | 0.767 | 0.886 | `npm run demo:voice` |

The customer-support fixture also has a live DeepSeek probe result: DeepSeek recovered `5/6` facts from the generic summary and `6/6` from the orchestrated context.

The strongest current baseline is `rolling_summary_recent`, which summarizes older history and keeps recent messages verbatim. See [evaluation red-team notes](./docs/evaluation-red-team.md) for what this proves and what it does not prove.

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
npm run demo:voice
```

Use it from code:

```ts
import { compact } from "@anshulluhsna/compaction-orchestrator";

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
npx @anshulluhsna/compaction-orchestrator examples/coding-agent-session.json
```

The CLI returns JSON with selected operations, metrics, runtime context, and optional context package output.

Import a real Claude Code session:

```bash
find ~/.claude/projects -name "*.jsonl" -type f -print0 \
  | xargs -0 ls -lt \
  | head -20

node packages/core/dist/cli.js import claude ~/.claude/projects/<project-slug>/<session-id>.jsonl \
  --out examples/my-claude-session.json
```

Then use **Import JSON** in the UI. The importer converts Claude Code JSONL into the same fixture shape as the stock demos.

Import a real Codex session:

```bash
find ~/.codex/sessions -name "*.jsonl" -type f -print0 \
  | xargs -0 ls -lt \
  | head -20

node packages/core/dist/cli.js import codex ~/.codex/sessions/YYYY/MM/DD/rollout-...jsonl \
  --out examples/my-codex-session.json
```

Then use **Import JSON** in the UI. The importer skips encrypted reasoning and preserves messages, tool calls, tool outputs, cwd, model, and session metadata.

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

Use **Coding** to see a developer-agent session. Use **Support** to see a customer-support handoff. Use **Voice** to see a latency-sensitive rescheduling agent.

The UI follows one path: choose a fixture, run compaction, then run the live evaluation.

![Compaction Orchestrator UI](./docs/images/ui.png)

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

## Demo 3: Voice Agent

The voice fixture includes:

- A low-latency runtime budget
- A caller intent: reschedule, do not cancel
- Caller identity
- ASR noise
- Scheduler lookup output
- Consent state
- Selected appointment slot
- Next spoken prompt

The compaction plan keeps the active context lean, externalizes noisy transcript and scheduler output, preserves consent and slot state, and keeps the next spoken prompt ready for the next turn.

## Strategy Matrix

| Context type | Default risk | Strategy |
| --- | --- | --- |
| User instruction | Exact wording gets lost | `keep_verbatim` |
| Active error | Debugging signal gets blurred | `extract_active_error` |
| Large tool output | Context window gets flooded | `externalize_for_retrieval` |
| Completed exploration | Old work takes too much space | `structured_summary` |
| Support escalation | Operational state gets dropped | use-case package |
| Voice turn state | Latency optimization drops slots or consent | cost-first plan with preserved exact state |

## Package Shape

The root package is SDK-first:

```ts
import {
  compact,
  compactCustomerSupport,
  messagesToEvents
} from "@anshulluhsna/compaction-orchestrator";
```

Persistence is explicit:

```ts
import { SqliteStore } from "@anshulluhsna/compaction-orchestrator/store";
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
npm run demo:voice
npm run eval:accs
```

## Documentation

- [Build summary](./docs/build-summary.md)
- [SDK quickstart](./docs/sdk.md)
- [CLI quickstart](./docs/cli.md)
- [API reference](./docs/api.md)
- [OpenAPI contract](./docs/openapi.yaml)
- [Evaluation metric](./docs/evaluation-metric.md)
- [Evaluation results](./docs/evaluation-results.md)
- [Evaluation red-team notes](./docs/evaluation-red-team.md)
- [Strategy picker data flow](./docs/strategy-picker-data-flow.md)
- [Strategy plugins](./docs/strategies.md)
- [Customer support demo](./docs/customer-support-demo.md)
- [Launch demo guide](./docs/launch-demo.md)
- [Launch article draft](./docs/articles/compaction-control-layer.md)

## Current Status

This is launchable as an alpha/demo repo.

It has a working SDK, CLI, API, SQLite persistence layer, UI demo, examples, tests, docs, OpenAPI spec, CI, MIT license, and npm package metadata.

It is not production infrastructure yet, and the current eval is based on curated fixtures rather than broad real-world traces.

The next useful work is optional LLM-powered strategies behind the existing interface, broader real-world evaluation traces, and a production persistence option later.

## License

MIT
