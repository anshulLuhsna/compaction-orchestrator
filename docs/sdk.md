# SDK Quickstart

The fastest way to try Compaction Orchestrator is the core SDK path. It does not require running the API server or creating a SQLite database.

Use it when you want more control over the compaction your agent chooses at the model-call boundary. A single turn can mix strategies: preserve user constraints, extract the active error, externalize noisy logs, and summarize completed exploration.

```ts
import { compact } from "@compaction-orchestrator/core";

const result = compact({
  messages: [
    {
      role: "system",
      content: "Support policy: do not promise refunds above $5,000 without Billing Ops approval."
    },
    {
      role: "user",
      content: "Customer Maya Chen was double charged and cannot open the billing page."
    },
    {
      role: "tool",
      content: "Error: billing_portal_v2=false for account ACME-ENT-4481. Owner receives 403."
    }
  ],
  objective: "Prepare the next support-agent handoff.",
  useCase: "customer_support"
});

console.log(result.contextView.content);
console.log(result.contextPackage?.nextActions);
```

For the repo-local demo:

```bash
npm install
npm run demo:sdk
npm run demo:coding
```

`demo:sdk` reads `examples/customer-support-session.json`, runs the core package in-process, and prints the preserved support state, strategy operations, and token metrics.

`demo:coding` reads `examples/coding-agent-session.json` and verifies the developer-native case: exact user constraints, active typecheck failure, implementation decision, artifact references, and next action survive compaction while noisy search output is externalized.

The web UI exposes both fixtures as built-in buttons:

- **Support** runs the typed customer-support package path.
- **Coding** runs the generic compaction path for a coding-agent session.

Use the SDK when you want compaction control inside an agent loop. Use the HTTP API when you want a sidecar service that persists sessions, powers the UI, or coordinates context across processes.

## Public Exports

The package root is the zero-server SDK surface:

```ts
import {
  compact,
  compactCustomerSupport,
  messagesToEvents,
  compactSession,
  defaultStrategies
} from "@compaction-orchestrator/core";
```

SQLite persistence is a separate subpath so plain SDK users do not load the server store:

```ts
import { InMemoryStore, SqliteStore } from "@compaction-orchestrator/core/store";
```

## Agent Loop Shape

For a custom agent, wire compaction at the model-call boundary:

```ts
const messages = [];

while (true) {
  messages.push(await readNextUserOrToolEvent());

  const compacted = compact({
    messages,
    objective: "Prepare context for the next model call.",
    policy: {
      mode: "balanced",
      preserveUserMessagesVerbatim: true,
      allowExternalRetrieval: true
    }
  });

  const nextResponse = await callModel([
    {
      role: "system",
      content: compacted.contextView.content
    },
    ...messages.slice(-4)
  ]);

  messages.push(nextResponse);
}
```

The important part is that `compacted.plan.segments` tells you what strategy was chosen for each segment in that turn. That plan is the control surface: you can inspect it, evaluate it, persist it, or replace the built-in strategies with domain-specific ones.

For customer support, use the typed package:

```ts
const handoff = compactCustomerSupport({
  messages,
  objective: "Prepare a reliable handoff for the next support agent."
});

await sendToSupportDesk({
  customer: handoff.contextPackage.customer,
  issue: handoff.contextPackage.issue,
  escalation: handoff.contextPackage.escalation,
  nextActions: handoff.contextPackage.nextActions,
  context: handoff.contextView.content
});
```

## Local Checks

Run the SDK smoke test before changing the public API:

```bash
npm run test:sdk
npm run demo:coding
```

That test verifies:

- `compact()` keeps generic instructions and active errors.
- `compactCustomerSupport()` returns the typed support package.
- `messagesToEvents()` applies session sequencing and use-case metadata.
