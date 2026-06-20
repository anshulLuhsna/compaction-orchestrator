# Agent Continuity under Compaction

The project should not be evaluated as a summarizer.

The relevant question is:

```text
After compaction, can the next agent turn still continue correctly?
```

The first metric for that is **Agent Continuity under Compaction (ACCS)**.

## What ACCS Compares

For each fixture, ACCS compares:

- `raw_full_context`
- `last_n_messages`
- `recent_token_window`
- `front_truncation`
- `generic_summary`
- `rolling_summary_recent`
- `compaction_orchestrator`

This lets us show whether the orchestrated, per-segment compaction plan preserves critical state better than normal baselines.

The important red-team baseline is `rolling_summary_recent`: it models the common production pattern of summarizing older history while keeping recent messages verbatim. This is much stronger than a single generic summary.

## Score Components

ACCS combines:

- **Critical State Recall (CSR):** did required facts survive inline or recoverably?
- **Exactness Preservation (EX):** did exact constraints/errors/actions survive inline?
- **Downstream Readiness (DTS):** did next-turn-critical facts survive inline?
- **Retrieval Recoverability (RR):** were missing inline facts recoverable from externalized content?
- **Plan Inspectability (PI):** does the output expose per-segment operations and reasons?
- **Token Reduction (TR):** did the candidate actually shrink context?
- **Hallucination Penalty (H):** did important-looking tokens appear that were not in the source?
- **Irrelevant Context Penalty (IC):** how sparse is critical signal relative to retained context?

The current V0 is deterministic and fixture-based. It uses the fixture `expectedFacts` arrays as ground truth.

## Current Formula

```text
ACCS =
  0.34 * CSR
+ 0.18 * EX
+ 0.16 * DTS
+ 0.10 * RR
+ 0.08 * PI
+ 0.14 * TR
- 0.18 * H
- 0.10 * IC
```

The score is normalized to `0..1`.

## Run It

```bash
npm run eval:accs
```

Run one fixture:

```bash
npm run eval:accs -- examples/coding-agent-session.json
```

The script prints a table and a JSON summary.

Run the regression check:

```bash
npm run test:accs
```

## Optional DeepSeek Probe

If `DEEPSEEK_API_KEY` is configured, you can run a live next-turn probe with DeepSeek from either the web UI or the CLI.

In the UI, click **Evaluate live**. The app first computes deterministic ACCS, then calls `/v1/deepseek/probe` for `generic_summary` and `compaction_orchestrator`. The DeepSeek tab shows model, latency, recall, answers, and raw response content.

API endpoint:

```bash
curl -s -X POST http://localhost:3000/v1/deepseek/probe \
  -H 'content-type: application/json' \
  -d '{"fixture": { ... }}'
```

CLI:

```bash
DEEPSEEK_API_KEY=... npm run eval:deepseek -- examples/coding-agent-session.json
```

Run the customer-support fixture:

```bash
DEEPSEEK_API_KEY=... npm run eval:deepseek -- examples/customer-support-session.json
```

The script compares `generic_summary` and `compaction_orchestrator` by asking DeepSeek to answer the fixture fact probes using only each compacted runtime context.

Default settings:

```text
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

The script exits cleanly with a skipped message when `DEEPSEEK_API_KEY` is missing.

## Why This Fits

Generic summarization metrics mostly ask whether a summary resembles a reference.

ACCS asks whether critical agent state survives compression, whether exact facts remain exact, whether externalized facts are recoverable, whether the compaction decision is inspectable, and whether tokens were actually reduced.

That maps directly to the product claim:

```text
Preserve what the next agent turn needs while shrinking the rest.
```
