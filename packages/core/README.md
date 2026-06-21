# @anshulluhsna/compaction-orchestrator

Control which compaction strategy your agent chooses for each turn and context segment.

This package is the SDK and CLI for Compaction Orchestrator. It is not just another summarizer. It gives agent builders a programmable compaction control layer: preserve instructions verbatim, extract active errors, externalize noisy tool output, summarize completed exploration, and return a compact runtime context for the next model call.

## Install

```bash
npm install @anshulluhsna/compaction-orchestrator
```

## SDK

```ts
import { compact } from "@anshulluhsna/compaction-orchestrator";

const result = compact({
  messages,
  objective: "Prepare context for the next agent turn.",
  desiredBudget: 1200,
  policy: {
    mode: "balanced",
    preserveUserMessagesVerbatim: true,
    allowExternalRetrieval: true
  }
});

console.log(result.contextView.content);
console.log(result.plan.segments.map((segment) => segment.operation));
```

## Customer Support Package

```ts
import { compactCustomerSupport } from "@anshulluhsna/compaction-orchestrator";

const handoff = compactCustomerSupport({
  messages,
  objective: "Prepare a reliable support handoff.",
  useCase: "customer_support"
});

console.log(handoff.contextPackage.issue);
console.log(handoff.contextPackage.nextActions);
```

## CLI

```bash
npx @anshulluhsna/compaction-orchestrator examples/coding-agent-session.json
```

You can also pipe JSON through stdin:

```bash
cat session.json | npx @anshulluhsna/compaction-orchestrator
```

Import Claude Code or Codex transcripts into UI-ready fixtures:

```bash
npx @anshulluhsna/compaction-orchestrator import claude ~/.claude/projects/<project>/<session>.jsonl \
  --out my-claude-session.json

npx @anshulluhsna/compaction-orchestrator import codex ~/.codex/sessions/YYYY/MM/DD/rollout-...jsonl \
  --out my-codex-session.json
```

## Persistence

The package root is SDK-first. Persistence is available through an explicit subpath:

```ts
import { SqliteStore } from "@anshulluhsna/compaction-orchestrator/store";
```

SQLite is useful for local API/server workflows where you want durable sessions, compaction plans, context views, and externalized content.

## Strategy Routing

Compaction Orchestrator supports different strategies per turn and per segment. A single agent turn can produce a mixed plan such as:

- `keep_verbatim` for user constraints
- `extract_active_error` for the current failure
- `externalize_for_retrieval` for large logs
- `structured_summary` for completed exploration

The result is smaller context with more control over what survives.
