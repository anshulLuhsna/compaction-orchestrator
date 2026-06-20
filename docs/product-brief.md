# Product Brief

## What We Are Building

`compaction-orchestrator` is a pluggable compaction control API for AI agents and AI applications.

It receives raw session events, preserves the canonical history, classifies the context into meaningful segments, and applies different compaction strategies depending on the segment type, use case, policy, and risk.

The product is not another compaction tool or summarizer. It is a control layer for deciding which compaction strategy an agent should use.

## Core Thesis

Long-running agents fail when context gets compressed with one generic treatment. User constraints, active errors, rejected approaches, tool logs, file paths, and decisions do not all deserve the same handling.

The system should decide whether each segment should be:

- Kept verbatim
- Extracted
- Masked
- Summarized
- Externalized for retrieval
- Turned into a handoff
- Sent to a provider-native compaction mechanism

A single agent turn can use multiple strategies at once. For example, one turn might keep a user instruction verbatim, extract an active error, externalize a large log, and summarize completed exploration.

## Primary User

The first user is a developer or agent-platform builder who wants reliable long-running agent behavior without manually managing context windows.

## Shipped Use Cases

The repo now includes three public fixtures:

### Coding Agent

Shows that an adaptive compaction router preserves important task state better than simple memory baselines and a stronger summary-plus-recent baseline:

- User instructions survive exactly
- Active errors remain actionable
- Changed files and artifacts remain visible
- Completed exploration is summarized
- Noisy old tool output is masked
- Large retrievable context is externalized

### Customer Support

Shows support handoff state that should not be flattened into one summary:

- Customer identity
- Account ID
- Refund policy
- Duplicate invoice facts
- Billing entitlement error
- Escalation state
- Next action

### Voice Agent

Shows a latency-sensitive turn where the context must stay lean without dropping the caller's intent, consent state, selected slot, or next spoken prompt.

Current ACCS results compare against simple baselines and `rolling_summary_recent`, a stronger baseline that summarizes older history and keeps recent messages verbatim.

## Non-Goals For V0

- Training a custom compaction model
- Optimizing routing from task-success rewards
- Building a full dashboard before the API is real
- Multi-user auth and billing
- Provider-specific native compaction adapters

## Product Promise

More control over what your agent keeps, shrinks, externalizes, and carries into the next turn.
