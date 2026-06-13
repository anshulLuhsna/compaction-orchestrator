# Strategy Plugins

## Concept

A strategy is a pluggable compaction operation. The router asks each strategy whether it supports a segment, estimates the tradeoff, chooses one, executes it, and validates the result.

## Interface

Current interface in `packages/core/src/types.ts`:

```ts
export type CompactionStrategy = {
  name: string;
  supports(segment: ContextSegment, environment: CompactionEnvironment): boolean;
  estimate(segment: ContextSegment, environment: CompactionEnvironment): StrategyEstimate;
  execute(segment: ContextSegment, environment: CompactionEnvironment): StrategyExecution;
  validate(original: ContextSegment, transformed: StrategyExecution): StrategyValidation;
};
```

## Built-In Strategies

### `keep_verbatim`

Preserves exact content.

Used for:

- User instructions
- High-importance context
- Exactness-required segments

### `extract_active_error`

Keeps the actionable error signal from a large tool output.

Used for:

- Failed commands
- Stack traces
- Active debugging state

### `externalize_for_retrieval`

Moves large retrievable segments out of the active context and leaves a reference.

Used for:

- Large logs
- Long docs
- Tool output that may be needed later

Current V0 only emits the reference. Durable storage for externalized content is a next step.

### `mask_tool_output`

Replaces low-relevance tool output with compact metadata.

Used for:

- Old command output
- Repeated logs
- Installation progress

### `structured_summary`

Creates a deterministic summary with artifact mentions preserved.

Used for:

- General context
- Completed exploration
- Fallback when no specialized strategy applies

## Router Behavior

The current router is intentionally simple:

- `cost_first` chooses the supported strategy with the highest estimated token savings
- User instructions are kept verbatim
- Active errors can be extracted when `preserveActiveErrorsVerbatim` is `false`
- Otherwise, the first supported strategy wins

## How To Add A Strategy

1. Add a strategy object in `packages/core/src/strategies.ts`
2. Implement the shared interface
3. Add it to `defaultStrategies()`
4. Add a smoke fixture that proves it is selected
5. Update this document

## Next Strategy Candidates

- `task_handoff_summary`
- `decision_ledger_extract`
- `artifact_state_extract`
- `instruction_guardrail_extract`
- `provider_native_compaction`
- `llm_structured_summary`
