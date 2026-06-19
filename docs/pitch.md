# Pitch

## The Problem

AI agents are getting good enough to do real work, but they still have a fragile memory problem.

As an agent works through a long task, its context fills up with user instructions, tool outputs, file paths, errors, decisions, rejected approaches, logs, and partial progress. Once the context gets too large, most systems do one of three things:

- Keep everything until the model slows down or hits the context limit
- Drop older context and risk forgetting important details
- Summarize everything into one generic summary

That generic summary is the dangerous part.

Not all context has the same value. A user constraint should not be treated like an old install log. An active error should not be summarized like completed exploration. A rejected architecture decision should not disappear just because it happened early in the session.

When compaction is too blunt, agents start failing in familiar ways:

- They forget user instructions
- They repeat old work
- They hallucinate files or decisions
- They lose the current debugging state
- They ignore rejected approaches
- They preserve noisy logs while dropping important constraints

The result is that long-running agents become less reliable exactly when the work becomes more serious.

## The Solution

We are building a pluggable compaction control API for AI agents.

Instead of treating context compaction as one generic summarization step, our system gives developers control over which strategy the agent uses for each part of the session.

The core idea:

```text
raw agent session
-> classify context
-> choose strategy per segment in the current turn
-> compact safely
-> return a smaller runtime context
```

The original session is never destroyed. We keep a full append-only event log, then generate compacted context views from it.

That means the system can decide:

- Keep user instructions verbatim
- Extract only the useful lines from an active error
- Mask old tool output
- Summarize completed exploration
- Externalize large logs or docs for retrieval
- Preserve file and artifact state
- Generate a handoff for a fresh agent later

The key is that one turn can use multiple strategies at once. The agent is not forced into a single compaction mode.

This turns compaction from a hidden summarization step into a programmable control layer.

## Simple Explanation

Most agents treat memory like one big document. When it gets too long, they summarize the whole thing.

We treat memory more like a workspace.

Some things stay on the desk. Some things go into storage. Some things get rewritten as a checklist. Some things are kept word-for-word. Some things become searchable references.

The point is not just shorter context.

The point is better context.

## What The Product Does

The API receives agent events:

- User messages
- Assistant messages
- Tool calls
- Tool outputs
- Errors
- Decisions
- Artifact references

It stores them in SQLite as the canonical history.

When the agent or application asks for compaction, the system:

1. Loads the raw session events
2. Classifies them into context segments
3. Checks which compaction strategies apply
4. Chooses a strategy using policy rules
5. Executes the strategy
6. Validates what survived
7. Saves the compaction plan
8. Returns a runtime context view

The consuming agent receives the smaller context view, while the full history remains available for replay, retrieval, auditing, and evaluation.

## Example

A coding agent session might contain:

- User says: "Use Hono. Do not use Express."
- Agent reads several files
- Tool output includes a long failed test log
- Agent rejects one implementation approach
- Agent modifies `apps/api/src/index.ts`

A generic summarizer might compress this into:

```text
The user wants an API implementation. There was a test failure. Some files were changed.
```

Our system does something more specific:

```text
User instruction:
Use Hono. Do not use Express.

Active error:
Cannot find module './router'
at apps/api/src/index.ts:8

Artifact state:
Modified apps/api/src/index.ts

Rejected approach:
Express was rejected because the user required Hono.

Externalized:
Full test log stored at memory://session/segment
```

The context is smaller, but the critical details are still alive.

## Why Now

Agents are moving from short demos to long-running work:

- Coding tasks
- Research workflows
- Support operations
- Data analysis
- Internal automation
- Multi-step product work

Longer tasks create more context pressure. Bigger context windows help, but they do not solve the underlying problem. More space does not tell the agent what matters.

Teams need context infrastructure that understands what information should survive, what can shrink, and what can move out of the active window.

## Unique Selling Points

### 1. Context-Specific Compaction

We do not compact everything the same way.

Different context types get different treatment:

- Instructions are preserved
- Errors are extracted
- Logs are masked or externalized
- Decisions are retained structurally
- Completed exploration is summarized

### 2. Pluggable Strategy API

Strategies are plugins.

Developers can add new strategies for their domain:

- Coding agents
- Research agents
- Support agents
- Data agents
- Legal review
- Medical workflows
- Internal enterprise assistants

The orchestration layer stays the same.

### 3. Non-Destructive Memory

The original session is never overwritten.

Every compaction creates a new context view. This enables:

- Replay
- Rollback
- Auditing
- Strategy comparison
- Evaluation
- Retrieval

### 4. Policy-Aware Routing

The system can optimize for different goals:

- Accuracy first
- Balanced
- Cost first
- Long horizon
- Human controlled

The same session can produce different context views depending on the policy.

### 5. Built For Evaluation

The system records what strategy was chosen and why.

That makes it possible to measure:

- Did the agent finish the task?
- Did instructions survive?
- Did active errors survive?
- Were artifacts remembered?
- Did hallucinations increase?
- How many tokens were saved?

### 6. Agent-Callable API

This can sit behind a normal HTTP API or become an agent tool.

An agent could call:

```text
compact_context(
  objective="Continue debugging auth",
  desired_budget=8000
)
```

and receive a safer runtime context.

## What Makes It Different

Most approaches ask:

```text
How do we summarize this conversation?
```

We ask:

```text
What does each piece of context deserve?
```

That is the difference.

This is not a better summarizer. It is a context router.

## Short Pitch

We are building a pluggable compaction control API for AI agents.

As agent sessions get longer, they start forgetting instructions, losing debugging state, repeating work, or hallucinating details. Most systems solve this with one generic summary or hidden provider compaction, but different types of context need different treatment.

Our system stores the full session, classifies the context, and lets the agent apply different compaction strategies in the same turn. User instructions stay verbatim, active errors are extracted, old tool logs are masked, large content is externalized, and completed work is summarized.

The result is smaller context with more control over what the agent carries forward.

## One-Liner

A pluggable context compaction layer that helps AI agents remember what matters and shrink what does not.

## Developer Pitch

This is an API-first context layer for AI agents.

You send it raw session events. It stores the full event log, classifies the context into segments, routes each segment through a compaction strategy, and returns a runtime context view.

The strategy interface is pluggable, so teams can define domain-specific compaction behavior instead of relying on one generic summary.

## Investor Pitch

AI agents need memory infrastructure before they can reliably handle long-running work.

Today, compaction is usually a blunt summarization step. That causes agents to forget instructions, lose active task state, and hallucinate details.

We are building the context control layer for agentic applications: a non-destructive, policy-aware API that decides what context to preserve, shrink, externalize, or retrieve.

As agents become part of production workflows, context management becomes core infrastructure.

## Demo Pitch

We can show two agents doing the same coding task.

Goldfish uses a generic summary whenever context gets long.

Elephant uses our adaptive compaction router.

Goldfish forgets constraints, loses error details, or repeats old work.

Elephant preserves the user instruction, extracts the active error, tracks changed files, externalizes noisy logs, and continues with a smaller but safer context.

Then we compare:

- Task success
- Instruction recall
- Error recall
- Artifact recall
- Hallucinations
- Tokens used

## Current Prototype

The current repo already has:

- HTTP API
- SQLite persistence
- Append-only sessions
- Event ingestion
- Segment classification
- Strategy picker
- Compaction plans
- Runtime context views
- Externalized content retrieval
- OpenAI connectivity check

The current picker is deterministic. The next version can add OpenAI-powered summarization and planning while keeping deterministic safety rules for critical information.

## How To Explain The USP In One Sentence

We do not summarize the whole conversation; we route each piece of context to the safest useful treatment.
