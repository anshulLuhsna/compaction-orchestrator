# Evaluation Red-Team Notes

The evaluation is useful, but it should not be oversold.

## What Was Weak Before

The first ACCS version compared against:

- raw full context
- last-N messages
- front truncation
- one generic summary

Those are real baselines, but the generic summary was too easy to beat. Many production agent stacks do something closer to:

- token-window trimming
- summary plus recent messages
- retrieval or memory injection
- provider/harness-managed compaction

So the original result supported a narrow claim:

```text
Compaction Orchestrator beats simple baselines on curated fixtures.
```

It did not support:

```text
Compaction Orchestrator beats real-world agent memory systems in general.
```

## What Was Added

The eval now includes:

- `recent_token_window`: keeps the most recent tokens up to the same active-context budget as the orchestrator.
- `rolling_summary_recent`: summarizes older history and keeps recent messages verbatim.

These are closer to common short-term memory strategies in agent frameworks.

## Current Strongest-Baseline Results

| Fixture | Strongest non-orchestrator baseline | Baseline ACCS | Orchestrator ACCS |
| --- | --- | ---: | ---: |
| Coding agent | `rolling_summary_recent` | 0.698 | 0.836 |
| Customer support | `rolling_summary_recent` | 0.474 | 0.773 |
| Voice agent | `rolling_summary_recent` | 0.767 | 0.886 |

This is a better result than beating only a strawman summary.

It also reveals the honest story: rolling summary plus recent messages is competitive when the fixture is simple enough. The orchestrator's advantage is not only fact recall. It is fact recall plus token reduction plus explicit plan inspectability.

## What Is Still Missing

The eval still needs:

- More fixtures from real agent traces, not only hand-authored demos.
- A multi-turn continuation test where a model must actually perform the next action.
- Retrieval baselines that do not know the expected facts ahead of time.
- Model-judged task success across multiple providers.
- Stress tests where important facts are paraphrased, contradicted, superseded, or stale.
- Ablations for plan inspectability, externalization, and strategy routing.

## Public Claim Boundary

Safe claim:

```text
On three curated agent-session fixtures, Compaction Orchestrator beats simple baselines and a stronger summary-plus-recent baseline on ACCS.
```

Unsafe claim:

```text
Compaction Orchestrator is proven better than production agent memory systems.
```

Better launch wording:

```text
This is an alpha evaluation harness for testing compaction control. The early fixtures show why per-segment compaction can preserve agent state better than one-size-fits-all memory strategies.
```
