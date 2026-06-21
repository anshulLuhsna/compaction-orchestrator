# Build Summary

## What We Are Building

Compaction Orchestrator is an open-source compaction control layer for custom AI agents.

The core idea is simple: long-running agents should not rely on one generic conversation summary. Different context needs different treatment. A user constraint may need to be kept verbatim, a noisy tool result may need to be externalized, an active error may need to be extracted, and old exploration may be safely summarized.

This project turns compaction into a pluggable orchestration problem:

```text
raw session messages
-> segment classification
-> strategy selection
-> compaction plan
-> runtime context view
-> optional use-case-specific package
```

The first target users are developers building custom agents, support bots, coding agents, voice agents, or internal AI workflows that need controllable memory compaction.

The positioning is not "another compaction tool." The positioning is: give developers control over the compaction strategy their agent chooses, including different strategies for different context segments inside the same turn.

## Product Shape

The project now has three useful surfaces:

- **SDK first**: use `compact()` directly inside an agent loop.
- **HTTP API**: run compaction as a sidecar/orchestration service with persistence.
- **Web UI demo**: visually show input sessions, selected strategies, compacted output, externalized content, and evaluation.

This gives us both a developer adoption path and a demo path.

## Core Package

The core implementation lives in `packages/core`.

It includes:

- Message/event types
- Segment classification
- Built-in compaction strategies
- Strategy routing logic
- Runtime context generation
- Customer-support context package generation
- SQLite store exports behind a separate subpath
- SDK helpers
- CLI entrypoint

The public package root is intentionally SDK-focused:

```ts
import { compact, compactCustomerSupport } from "@anshulluhsna/compaction-orchestrator";
```

Persistence is explicit:

```ts
import { SqliteStore } from "@anshulluhsna/compaction-orchestrator/store";
```

## SDK

The SDK gives users the fastest path to try the project without running a server.

Implemented helpers:

- `compact()`
- `compactCustomerSupport()`
- `messagesToEvents()`

The SDK accepts plain messages, objective, token budget, use case, and policy, then returns:

- Selected segments
- Compaction plan
- Runtime context view
- Metrics
- Optional customer-support context package

Current demos:

```bash
npm run demo:sdk
npm run demo:coding
npm run demo:voice
```

## CLI

The CLI lets someone run compaction from a fixture file or stdin.

Implemented command shape:

```bash
compaction-orchestrator examples/coding-agent-session.json
```

After package publishing, the intended shape is:

```bash
npx @anshulluhsna/compaction-orchestrator examples/coding-agent-session.json
```

The CLI prints JSON containing the selected operations, metrics, runtime context, and optional context package.

Current demo:

```bash
npm run demo:cli
```

## HTTP API

The API lives in `apps/api`.

It supports persisted session workflows plus a one-shot compaction endpoint.

Important implemented endpoint:

```http
POST /v1/compact
```

This accepts plain messages and creates a persisted session automatically. It returns:

- Session metadata
- Session id
- Segments
- Compaction plan
- Runtime context view
- Customer-support context package when requested

The API also supports session/event/context flows documented in `docs/api.md`.

## SQLite Persistence

SQLite is used for local durable persistence in the API process.

We store:

- Sessions
- Raw events
- Segments
- Compaction plans
- Runtime context views
- Externalized content

The reason for SQLite is that it gives the project a real durable event log without requiring users to run Postgres, Redis, or another service during local development. It also supports the architecture we care about: compaction does not mutate the original conversation. It creates derived context views from an append-only history.

The persistence boundary is isolated behind the store layer, so the project can later add Postgres or another backend without changing the compaction model.

## Web UI Demo

The web app lives in `apps/web`.

The UI currently supports:

- A single guided flow: choose a session, compact it, evaluate it
- Support, Coding, and Voice demo modes
- JSON import and raw editing behind a drawer
- Selected strategy operations
- Token metrics and externalized content count
- Optional advanced details for runtime context, events, and plans
- Live DeepSeek comparison between generic summary and orchestrated context

The UI is useful for demos because it makes the main claim visible: the orchestrator does not just shrink text; it chooses different treatments for different context.

![Compaction Orchestrator UI](./images/ui.png)

Run it with:

```bash
npm run dev
npm run dev:web
```

Then open:

```text
http://127.0.0.1:5173
```

## Demo Use Cases

### Customer Support

The support demo shows why generic summaries are risky for support agents.

It preserves:

- Customer identity
- Account id
- Policy constraints
- Invoice facts
- Active billing access error
- Escalation state
- Next action

It outputs a typed handoff package with customer, issue, escalation, next actions, metrics, and external references.

### Coding Agent

The coding-agent demo shows a developer-agent compaction case.

It preserves:

- User constraints
- Required route path
- Response shape
- Active typecheck errors
- Next implementation action

It externalizes noisy search/tool output instead of stuffing it into runtime context.

### Voice Agent

The voice-agent demo shows a latency-sensitive compaction case.

It preserves:

- Caller identity
- Reschedule intent
- Consent state
- Selected appointment slot
- Low-latency token budget
- Next spoken prompt

It externalizes noisy ASR and scheduler output while keeping active context under the fixture budget.

## Evaluation

The repo includes deterministic smoke tests and demo evaluations.

Implemented checks:

- SDK smoke test
- CLI smoke test
- One-shot API test
- API integration test
- Customer-support E2E test
- Customer-support evaluation against a generic baseline
- Coding-agent demo assertions
- Voice-agent demo assertions
- ACCS evaluation against simple baselines and `rolling_summary_recent`

Useful commands:

```bash
npm run typecheck
npm run build
npm run test:sdk
npm run test:cli
npm run test:api
npm run demo:sdk
npm run demo:coding
npm run demo:voice
npm run demo:cli
npm run eval:accs
```

The latest local verification passed for typecheck, web build, ACCS smoke tests, all-fixture ACCS evaluation, and live UI evaluation.

## Open Source Readiness

Already added:

- MIT license
- Contributing guide
- GitHub Actions CI
- SDK docs
- CLI docs
- API docs
- OpenAPI contract
- Architecture docs
- Strategy picker data-flow docs
- Product brief
- Pitch doc
- Demo docs
- Launch demo guide

The project is launchable as an alpha/demo repo now.

## What Is Still Left

Before a stronger public launch, the highest-leverage next steps are:

- Decide what to commit from local council artifacts versus what should stay private/untracked.
- Consider a production persistence option later, likely Postgres, while keeping SQLite as the local default.
- Add optional LLM-powered planning/summarization behind the existing strategy interface.

## Current Position

The project is no longer just an idea. It has a working SDK, CLI, API, SQLite persistence layer, UI demo, examples, tests, docs, and CI.

The best next move is not more architecture. The best next move is a final launch pass: decide what artifacts to commit, publish the alpha, and collect feedback from real agent builders.
