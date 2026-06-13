# Architecture

## System Flow

```text
client or agent
  -> API layer
  -> append-only event log
  -> segmenter
  -> strategy router
  -> compaction strategies
  -> validation
  -> runtime context view
```

## Packages

### `apps/api`

Thin HTTP wrapper around the core package.

Responsibilities:

- Create sessions
- Append events
- Run compaction
- Return runtime context views
- Validate request payloads

### `packages/core`

Domain logic.

Responsibilities:

- Event types
- Segment types
- Segment classification
- Strategy interface
- Built-in strategies
- Strategy selection
- Compaction plan generation
- Runtime context view generation
- SQLite-backed persistence

## Important Design Choices

### Canonical History Is Non-Destructive

The original event log is never rewritten by compaction. Every compaction creates a derived context view.

This matters because it enables:

- Rollback
- Replay
- Evaluation
- Strategy comparison
- Provenance

### Segment-Level Routing

Events are classified into context segments before compaction. The router chooses a strategy per segment.

Example:

```text
user constraint -> keep verbatim
active test failure -> extract error
old tool output -> mask
completed exploration -> summarize
large logs -> externalize
```

### Strategies Are Plugins

Each strategy implements a shared interface:

```ts
type CompactionStrategy = {
  name: string;
  supports(segment, environment): boolean;
  estimate(segment, environment): StrategyEstimate;
  execute(segment, environment): StrategyExecution;
  validate(original, transformed): StrategyValidation;
};
```

This lets the system add new compaction mechanisms without changing the API or orchestration layer.

## Persistence

The default API process uses SQLite at:

```text
data/compaction-orchestrator.sqlite
```

The SQLite store persists:

- Sessions
- Raw events
- Derived segments
- Compaction plans
- Runtime context views
- Externalized content

This keeps the canonical history durable and makes compaction runs replayable across server restarts.

The implementation uses Node's built-in `node:sqlite`, which currently emits an experimental warning. This is fine for the local prototype because the persistence boundary is isolated behind `ContextStore`.

## Current Limitations

- Segment classification is heuristic
- Summarization is deterministic truncation, not LLM-based
- Validation is basic
- No dashboard yet

These are intentional V0 constraints.
