# Evaluation Results

Latest deterministic verification:

```bash
npm run eval:accs
```

Metric:

```text
Agent Continuity under Compaction (ACCS)
```

ACCS measures whether critical agent state survives compaction while context shrinks. It is not a summarization-quality score.

## Red-Team Baseline Update

The first eval only compared against basic baselines: raw context, last-N, front truncation, and one generic summary.

That was useful, but too easy.

The current eval also includes two stronger baselines closer to what agent builders actually use:

- `recent_token_window`: keep the most recent tokens up to the orchestrator's active-context budget.
- `rolling_summary_recent`: summarize older history, then keep recent messages verbatim.

Latest results against the strongest non-orchestrator baseline:

| Fixture | Strongest non-orchestrator baseline | Baseline ACCS | Orchestrator ACCS | What this says |
| --- | --- | ---: | ---: | --- |
| Coding agent | `rolling_summary_recent` | 0.698 | 0.836 | Rolling summary preserves facts, but uses more context and has no inspectable plan. |
| Customer support | `rolling_summary_recent` | 0.474 | 0.773 | It still misses duplicate-invoice state. |
| Voice agent | `rolling_summary_recent` | 0.767 | 0.886 | It preserves facts, but saves fewer tokens and has no plan. |

This is the honest claim: Compaction Orchestrator is not only beating a weak generic summary. On these fixtures, it also beats a stronger summary-plus-recent baseline because it combines fact preservation, token reduction, recoverability, and plan inspectability.

## Coding Agent Fixture

Fixture:

```text
examples/coding-agent-session.json
```

Winner:

```text
compaction_orchestrator
```

| Candidate | ACCS | Critical recall | Exactness | Readiness | Plan | Token reduction | Missed facts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `compaction_orchestrator` | 0.836 | 1.000 | 1.000 | 1.000 | 1.000 | 41.7% | - |
| `rolling_summary_recent` | 0.698 | 1.000 | 1.000 | 1.000 | 0.000 | 12.7% | - |
| `raw_full_context` | 0.693 | 1.000 | 1.000 | 1.000 | 0.000 | 0.0% | - |
| `generic_summary` | 0.548 | 0.800 | 0.800 | 0.800 | 0.000 | 48.4% | `active_error` |
| `front_truncation` | 0.438 | 0.600 | 0.600 | 0.600 | 0.000 | 69.3% | `active_error`, `next_action` |
| `last_n_messages` | 0.435 | 0.600 | 0.600 | 0.600 | 0.000 | 63.0% | `framework_constraint`, `route_path` |
| `recent_token_window` | 0.384 | 0.600 | 0.600 | 0.600 | 0.000 | 41.7% | `framework_constraint`, `route_path` |

Orchestrator operations:

```text
keep_verbatim
-> structured_summary
-> externalize_for_retrieval
-> structured_summary
-> extract_active_error
-> structured_summary
```

What this shows:

- Last-N loses early user constraints and route requirements.
- Front truncation loses the active error and next action.
- Generic summary misses the active error.
- Orchestrator preserves all required facts, exposes the plan, and still reduces active context by 41.7%.

## Customer Support Fixture

Fixture:

```text
examples/customer-support-session.json
```

Winner:

```text
compaction_orchestrator
```

| Candidate | ACCS | Critical recall | Exactness | Readiness | Plan | Token reduction | Missed facts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `compaction_orchestrator` | 0.773 | 1.000 | 1.000 | 1.000 | 1.000 | 28.8% | - |
| `raw_full_context` | 0.702 | 1.000 | 1.000 | 1.000 | 0.000 | 0.0% | - |
| `rolling_summary_recent` | 0.474 | 0.816 | 0.750 | 0.750 | 0.000 | 21.9% | `duplicate_invoice` |
| `recent_token_window` | 0.451 | 0.684 | 0.750 | 0.750 | 0.000 | 28.8% | `customer_name`, `duplicate_invoice` |
| `front_truncation` | 0.436 | 0.632 | 0.500 | 0.500 | 0.000 | 67.9% | `error_state`, `next_action` |
| `generic_summary` | 0.410 | 0.632 | 0.500 | 0.500 | 0.000 | 55.5% | `duplicate_invoice`, `error_state` |
| `last_n_messages` | 0.402 | 0.500 | 0.500 | 0.500 | 0.000 | 67.7% | `customer_name`, `policy_constraint`, `duplicate_invoice` |

Orchestrator operations:

```text
keep_verbatim
-> structured_summary
-> structured_summary
-> externalize_for_retrieval
-> structured_summary
-> extract_active_error
-> structured_summary
-> structured_summary
```

What this shows:

- Last-N loses customer identity, refund policy, and invoice facts.
- Front truncation loses billing-page error state and next action.
- Generic summary loses duplicate-invoice and entitlement-error state.
- Orchestrator preserves all required support facts, exposes the plan, and reduces runtime context by 28.8%.

## Voice Agent Fixture

Fixture:

```text
examples/voice-agent-session.json
```

Winner:

```text
compaction_orchestrator
```

| Candidate | ACCS | Critical recall | Exactness | Readiness | Plan | Token reduction | Missed facts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `compaction_orchestrator` | 0.886 | 1.000 | 1.000 | 1.000 | 1.000 | 64.8% | - |
| `rolling_summary_recent` | 0.767 | 1.000 | 1.000 | 1.000 | 0.000 | 49.2% | - |
| `raw_full_context` | 0.689 | 1.000 | 1.000 | 1.000 | 0.000 | 0.0% | - |
| `last_n_messages` | 0.585 | 0.684 | 0.750 | 0.750 | 0.000 | 82.6% | `caller_name`, `caller_intent` |
| `recent_token_window` | 0.523 | 0.684 | 0.750 | 0.750 | 0.000 | 64.8% | `caller_name`, `caller_intent` |
| `generic_summary` | 0.430 | 0.632 | 0.500 | 0.500 | 0.000 | 70.4% | `consent_state`, `selected_slot` |
| `front_truncation` | 0.277 | 0.447 | 0.250 | 0.250 | 0.000 | 76.0% | `consent_state`, `selected_slot`, `next_spoken_prompt` |

Orchestrator operations:

```text
structured_summary
-> keep_verbatim
-> externalize_for_retrieval
-> externalize_for_retrieval
-> structured_summary
-> mask_tool_output
-> structured_summary
```

What this shows:

- Last-N loses the caller identity and original intent.
- Front truncation loses consent state, selected slot, and next spoken prompt.
- Generic summary loses the exact consent state and selected appointment slot.
- Orchestrator preserves all required voice-agent state while reducing active context by 64.8%.

## UI Verification

The web UI now shows an **Agent Continuity under Compaction** table inside the Evaluation tab.

Verified browser flow:

```text
Open http://127.0.0.1:5173
Click Evaluate
See ACCS table
See compaction_orchestrator marked Winner
```

The UI also keeps the older recall comparison below the ACCS table.

## DeepSeek Probe

The DeepSeek probe is implemented:

```bash
npm run eval:deepseek
```

It compares `generic_summary` and `compaction_orchestrator` by asking DeepSeek to answer fixture fact probes using only each compacted runtime context.

Environment:

```text
DEEPSEEK_API_KEY=required for live run
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Latest live local result:

| Fixture | Candidate | DeepSeek fact recall | Deterministic ACCS | Notes |
| --- | --- | ---: | ---: | --- |
| Customer support | `generic_summary` | 5/6 | 0.410 | Missed the duplicate invoice pair. |
| Customer support | `compaction_orchestrator` | 6/6 | 0.773 | Preserved customer state, policy, invoice pair, active error, and next action. |
| Coding agent | `generic_summary` | 5/5 | 0.548 | DeepSeek could answer the probes, but there is no inspectable compaction plan. |
| Coding agent | `compaction_orchestrator` | 5/5 | 0.836 | DeepSeek could answer the probes and ACCS rewards the inspectable per-segment plan. |

The strongest live demo is the customer-support fixture: DeepSeek answers more next-turn facts from the orchestrated context than from the generic summary.

The coding fixture is still useful, but it demonstrates a different point: both compacted contexts can answer the fact probes, while ACCS gives the orchestrator a higher score because it preserves the same critical state with explicit operations and recoverability.

Run it live with:

```bash
DEEPSEEK_API_KEY=... npm run eval:deepseek -- examples/coding-agent-session.json
```

Customer-support fixture:

```bash
DEEPSEEK_API_KEY=... npm run eval:deepseek -- examples/customer-support-session.json
```

## Verification Commands

These passed locally:

```bash
npm run typecheck
npm run build:web
npm run test:accs
npm run eval:accs
npm run eval:deepseek
```
