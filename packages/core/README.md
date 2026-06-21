# @anshulluhsna/compaction-orchestrator

Control which compaction strategy your agent chooses for each turn and context segment.

Compaction Orchestrator is an SDK and CLI for agent builders who own the model-call boundary. It is not another generic summarizer. It classifies session context, chooses a compaction strategy per segment, and returns a smaller runtime context plus an inspectable plan.

## Install

```bash
npm install @anshulluhsna/compaction-orchestrator
```

## Quick Start

```ts
import { compact } from "@anshulluhsna/compaction-orchestrator";

const result = compact({
  messages: [
    {
      role: "user",
      content: "Use Hono only. Do not add Express."
    },
    {
      role: "tool",
      type: "tool_output",
      content: "src/routes/billing.ts:42 error TS2322: status must be string"
    }
  ],
  objective: "Prepare context for the next coding-agent turn.",
  desiredBudget: 1200,
  policy: {
    mode: "balanced",
    preserveUserMessagesVerbatim: true,
    preserveActiveErrorsVerbatim: false,
    allowExternalRetrieval: true
  }
});

console.log(result.contextView.content);
console.log(result.plan.segments.map((segment) => segment.operation));
```

The important output is `plan`. It tells you which segment was kept verbatim, summarized, externalized, or converted into an active error extract.

## Customer Support Package

```ts
import { compactCustomerSupport } from "@anshulluhsna/compaction-orchestrator";

const handoff = compactCustomerSupport({
  messages,
  objective: "Prepare a reliable support handoff."
});

console.log(handoff.contextPackage.customer);
console.log(handoff.contextPackage.issue);
console.log(handoff.contextPackage.nextActions);
```

The support package returns a typed handoff with customer state, issue state, escalation, policy constraints, next actions, runtime context, metrics, and the compaction plan.

## Fixture Shape

The CLI and demo UI use this JSON shape:

```json
{
  "name": "my-agent-session",
  "objective": "Prepare compact context for the next turn.",
  "desiredBudget": 1200,
  "useCase": "generic",
  "policy": {
    "mode": "balanced",
    "preserveUserMessagesVerbatim": true,
    "preserveActiveErrorsVerbatim": false,
    "allowExternalRetrieval": true
  },
  "events": [
    {
      "role": "user",
      "type": "message",
      "content": "Use Hono only. Do not add Express.",
      "metadata": {
        "semanticType": "user_instruction"
      }
    }
  ],
  "expectedFacts": []
}
```

`expectedFacts` is optional. Add it when you want evaluation scores for your own trace.

## CLI

```bash
npx @anshulluhsna/compaction-orchestrator session.json
cat session.json | npx @anshulluhsna/compaction-orchestrator
```

The CLI returns JSON with selected operations, token metrics, runtime context, and an optional context package.

## Import Real Agent Chats

Convert Claude Code JSONL:

```bash
npx @anshulluhsna/compaction-orchestrator import claude ~/.claude/projects/<project>/<session>.jsonl \
  --out my-claude-session.json
```

Convert Codex JSONL:

```bash
npx @anshulluhsna/compaction-orchestrator import codex ~/.codex/sessions/YYYY/MM/DD/rollout-...jsonl \
  --out my-codex-session.json
```

Useful import options:

- `--name "my-session"` changes the fixture name.
- `--objective "prepare context for the next coding-agent turn"` changes the compaction objective.
- `--desired-budget 1200` changes the runtime context budget.
- `--max-tool-output-chars 12000` limits large tool outputs.
- `--include-developer` includes Codex developer/system messages.

Imported local traces may contain file paths, tool output, private code, API responses, or secrets. Review generated fixtures before sharing them or committing them.

## Strategy Routing

A single run can mix strategies:

- `keep_verbatim` for exact user constraints.
- `extract_active_error` for the current failure.
- `externalize_for_retrieval` for large retrievable logs.
- `mask_tool_output` for low-relevance tool output.
- `structured_summary` for completed exploration.

The current alpha router is deterministic. `cost_first` chooses the supported strategy with the highest estimated token savings. Other modes use the default safety ordering today: preserve user instructions, extract active errors when allowed, then use the first supported strategy.

## Custom Strategies

```ts
import { compact, defaultStrategies, type CompactionStrategy } from "@anshulluhsna/compaction-orchestrator";

const keepBillingFacts: CompactionStrategy = {
  name: "keep_billing_facts",
  supports: (segment) => /invoice|refund|entitlement/i.test(segment.content),
  estimate: () => ({
    tokenSavings: 0,
    preservationRisk: "low",
    latency: "low",
    confidence: 1
  }),
  execute: (segment) => ({
    content: segment.content,
    provenance: [segment.id],
    tokenEstimate: segment.tokenEstimate
  }),
  validate: () => ({
    passed: true,
    checks: ["kept billing fact verbatim"],
    warnings: []
  })
};

const result = compact({
  messages,
  strategies: [keepBillingFacts, ...defaultStrategies()]
});
```

Custom strategies work with the generic SDK path and the customer-support package path.

## Persistence

The package root is SDK-first. SQLite persistence is available through an explicit subpath:

```ts
import { SqliteStore } from "@anshulluhsna/compaction-orchestrator/store";
```

SQLite is useful for local API/server workflows where you want durable sessions, events, compaction plans, context views, and externalized content.

## Security Notes

- The package has no install hooks.
- The core SDK does not make network calls.
- The CLI reads local files or stdin and writes output only when `--out` is provided.
- Treat imported coding-agent traces as sensitive until reviewed.

## License

MIT
