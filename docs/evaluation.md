# Evaluation Plan

## Why Evaluation Matters

The product should not optimize for shorter context alone. The real goal is preserving downstream agent success.

## Current Demo Set

The current evaluation has moved beyond the first support-only baseline demo.

The main metric is now **Agent Continuity under Compaction (ACCS)**, implemented in:

```text
scripts/evaluate-accs.mjs
```

Run it with:

```bash
npm run eval:accs
```

It evaluates three fixtures:

- `examples/coding-agent-session.json`
- `examples/customer-support-session.json`
- `examples/voice-agent-session.json`

## Baselines

The current eval compares against:

- `raw_full_context`
- `last_n_messages`
- `recent_token_window`
- `front_truncation`
- `generic_summary`
- `rolling_summary_recent`
- `compaction_orchestrator`

The important red-team baseline is `rolling_summary_recent`: summarize older history, then keep recent messages verbatim. That is much closer to common agent memory patterns than a single generic summary.

## Orchestrator

Adaptive router:

- User instructions kept verbatim
- Active errors extracted
- Tool output masked
- Large retrievable content externalized
- Completed exploration summarized
- Artifact references retained

## Metrics

Primary:

- Task success
- Instruction preservation
- Artifact recall
- Exact error recall
- Hallucinated file paths or claims

Secondary:

- Runtime context tokens
- Compaction cost
- Repeated tool calls
- Human interruptions
- Number of compaction cycles survived

## Benchmark Fixtures

### Coding Agent

Tests preservation of user constraints, route paths, response shape, active typecheck errors, noisy tool output, and next implementation action.

### Customer Support

Tests preservation of customer identity, account ID, policy constraints, duplicate invoice facts, active entitlement error, escalation state, and next action.

### Voice Agent

Tests preservation of caller intent, consent state, selected appointment slot, low-latency runtime budget, ASR/scheduler noise handling, and next spoken prompt.

## Recall Question Categories

- User instructions
- Artifacts
- Decisions
- Exact details
- Active task state
- Rejected approaches

## Success Criteria For V0

The orchestrator should beat simple baselines and the stronger `rolling_summary_recent` baseline on ACCS across all shipped fixtures.

Current strongest-baseline results:

| Fixture | Strongest baseline ACCS | Orchestrator ACCS |
| --- | ---: | ---: |
| Coding agent | 0.698 | 0.836 |
| Customer support | 0.474 | 0.773 |
| Voice agent | 0.767 | 0.886 |

For the customer-support V0, the adaptive context package should preserve:

- Customer identity
- Account ID
- Policy constraints
- Exact invoice IDs
- Active support state
- Escalation reason
- Next action

## Evaluation Modules To Add

### Stronger Memory Baselines

Keep testing against summary-plus-recent and token-window baselines, not only generic summaries.

Implemented in ACCS.

### Context Ledger

Show what was stored, how it was classified, which strategy was selected, and whether it was later recalled.

### Recall Score

Generate or define hidden questions before compaction, then score what survived after compaction.

Partially implemented through fixture `expectedFacts`.

### Decay Lab

Run repeated compaction cycles and measure which facts disappear after each cycle.

### Handoff Test

Give the context package to a fresh agent and ask it to continue the task.
