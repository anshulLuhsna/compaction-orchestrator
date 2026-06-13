# Evaluation Plan

## Why Evaluation Matters

The product should not optimize for shorter context alone. The real goal is preserving downstream agent success.

## First Demo

Build `Goldfish vs Elephant`.

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

Use a synthetic coding-agent transcript with:

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
