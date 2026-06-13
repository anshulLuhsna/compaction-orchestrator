# Product Brief

## What We Are Building

`compaction-orchestrator` is a pluggable Context API for AI agents and AI applications.

It receives raw session events, preserves the canonical history, classifies the context into meaningful segments, and applies different compaction strategies depending on the segment type, use case, policy, and risk.

The product is not a summarizer. It is a context routing layer.

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

## Primary User

The first user is a developer or agent-platform builder who wants reliable long-running agent behavior without manually managing context windows.

## First Use Case

Coding-agent context compaction.

The first demo should show that an adaptive compaction router preserves important task state better than a generic summary:

- User instructions survive exactly
- Active errors remain actionable
- Changed files and artifacts remain visible
- Completed exploration is summarized
- Noisy old tool output is masked
- Large retrievable context is externalized

## Non-Goals For V0

- Training a custom compaction model
- Optimizing routing from task-success rewards
- Building a full dashboard before the API is real
- Multi-user auth and billing
- Provider-specific native compaction adapters

## Product Promise

Compaction without losing the things that make the agent succeed.
