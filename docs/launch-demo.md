# Launch Demo Guide

Use this when recording a short demo or explaining the project live.

## Positioning

Compaction Orchestrator gives agent builders control over the compaction strategy their agent chooses.

It is not positioned as another generic compaction or summarization tool. The point is that a long-running agent should be able to use different compaction strategies in the same turn:

```text
user constraint      -> keep_verbatim
current failure      -> extract_active_error
large tool output    -> externalize_for_retrieval
completed work       -> structured_summary
```

## Opening Script

Most long-running agents eventually need to compact context.

Today that compaction is usually hidden inside the harness or reduced to one generic summary. That gives developers very little control over what survives. The agent may preserve a noisy log but lose the active error, or summarize away the exact user constraint that mattered.

Compaction Orchestrator gives developers a control layer for this. It stores the raw session, classifies the context, and chooses a compaction strategy for each segment in the current turn.

So instead of asking "how do we summarize this conversation," we ask "what should each piece of context become before the next model call?"

## Demo Path

Start the API:

```bash
npm run dev
```

Start the UI in another terminal:

```bash
npm run dev:web
```

Open:

```text
http://127.0.0.1:5173
```

## Recording Flow

1. Start on the **Coding** fixture.
2. Point at the input JSON and say it represents an agent session with constraints, tool output, errors, and next actions.
3. Click **Run compact**.
4. Open the **Package** or **Runtime** tab and show the compacted context.
5. Open the **Plan** tab and show that different segments received different operations.
6. Point out:
   - user constraints stayed verbatim
   - active typecheck errors were extracted
   - large noisy tool output was externalized
   - completed exploration was summarized
7. Click **Evaluate** and show the ACCS table against simple baselines and `rolling_summary_recent`.
8. Switch to **Support** and click **Run package**.
9. Show the typed support handoff: customer, issue, escalation, policy constraints, next actions.
10. Switch to **Voice** and click **Run compact**.
11. Show that noisy ASR and scheduler output are moved out of active context while caller intent, consent, selected slot, latency budget, and next spoken prompt survive.

## What To Say While Showing The Plan

This is the important part. The output is not just shorter text. The system records the strategy choice for each segment.

That means I can inspect what happened, evaluate it, override it later, or plug in my own strategies for my own agent.

## Developer Demo

Show the SDK path:

```ts
import { compact } from "@compaction-orchestrator/core";

const result = compact({
  messages,
  objective: "Prepare context for the next agent turn.",
  policy: {
    mode: "balanced",
    preserveUserMessagesVerbatim: true,
    allowExternalRetrieval: true
  }
});

console.log(result.contextView.content);
console.log(result.plan.segments.map((segment) => segment.operation));
```

Show the CLI path:

```bash
npm run demo:cli
```

Show the voice-agent path:

```bash
npm run demo:voice
```

After publishing:

```bash
npx @compaction-orchestrator/core examples/coding-agent-session.json
```

## Close

The goal is simple: whenever someone building a custom agent thinks, "I need compaction, but I need control over what gets compacted and how," they should think of Compaction Orchestrator.

Use the honest claim:

```text
On three curated agent-session fixtures, Compaction Orchestrator beats simple baselines and a stronger summary-plus-recent baseline on ACCS.
```

Do not claim this proves superiority over every production memory system yet.
