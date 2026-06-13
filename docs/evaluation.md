# Evaluation Plan

## Why Evaluation Matters

The product should not optimize for shorter context alone. The real goal is preserving downstream agent success.

## First Demo

Build `Goldfish vs Elephant`.

The first implemented version is the customer-support evaluation in:

```text
scripts/evaluate-customer-support.mjs
```

Run it with:

```bash
npm run eval:support
```

### Goldfish

Naive baseline:

- Fixed threshold
- One generic summary
- No segment-level strategy routing
- No artifact tracking

### Elephant

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

## First Benchmark Fixture

Use a synthetic customer-support transcript first:

```text
examples/customer-support-session.json
```

It includes:

- Support policy
- Customer identity
- Billing issue
- Tool output
- Active error state
- Escalation decision
- Next action

Later, use a synthetic coding-agent transcript with:

- Several explicit user constraints
- Repository exploration
- Multiple file references
- A failed command with a stack trace
- A rejected implementation approach
- A final objective

Run both compaction approaches and ask recall questions afterward.

## Recall Question Categories

- User instructions
- Artifacts
- Decisions
- Exact details
- Active task state
- Rejected approaches

## Success Criteria For V0

The adaptive router should beat generic summary on instruction recall, active error recall, and artifact recall while keeping context smaller than the raw transcript.

For the customer-support V0, the adaptive context package should preserve:

- Customer identity
- Account ID
- Policy constraints
- Exact invoice IDs
- Active support state
- Escalation reason
- Next action

## Evaluation Modules To Add

### Goldfish Memory

Compare generic summary against the adaptive context package.

Implemented for customer support.

### Context Ledger

Show what was stored, how it was classified, which strategy was selected, and whether it was later recalled.

### Recall Score

Generate or define hidden questions before compaction, then score what survived after compaction.

Partially implemented through fixture `expectedFacts`.

### Decay Lab

Run repeated compaction cycles and measure which facts disappear after each cycle.

### Handoff Test

Give the context package to a fresh agent and ask it to continue the task.
