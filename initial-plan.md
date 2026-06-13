This is much clearer now. You are building something more ambitious than a strategy picker:

# A Context Compaction Operating System

A **model-agnostic, non-destructive context layer** that:

1. Receives raw agent conversations through an API/proxy.
2. Stores the complete session as an append-only event log.
3. Understands the semantic, task, model, and user context.
4. Chooses different treatments for different portions of the context.
5. Combines multiple compaction philosophies in one plan.
6. Asks the user context-specific questions before high-risk compactions.
7. Exposes the resulting system as an agent-callable tool.
8. Evaluates whether the compacted agent still succeeds, remembers, and avoids hallucinating.

That is a strong and differentiated thesis.

---

# The most important design realization

The seven approaches should **not** be implemented as seven equivalent buttons.

They operate at different levels of the system. The article you provided mixes triggering policies, compression mechanisms, storage architectures, handoff mechanisms, and model-training approaches. 

We should normalize them into composable layers.

## Layer 1: When should compaction happen?

| Approach        | Trigger                                               |
| --------------- | ----------------------------------------------------- |
| Fixed threshold | Context reaches a token percentage                    |
| LangChain-style | Agent decides at a task boundary                      |
| Risk-based      | System detects repetition, context rot, or saturation |
| Human-triggered | User requests compaction                              |
| Predictive      | Compact before an expensive upcoming operation        |

## Layer 2: What should happen to each segment?

| Operation                      | Inspired by                  |
| ------------------------------ | ---------------------------- |
| Keep verbatim                  | Conservative preservation    |
| Delete tokens selectively      | Morph                        |
| Mask old observations          | JetBrains                    |
| Summarize structurally         | Cursor/general summarization |
| Clear tool results             | Claude Code                  |
| Externalize for retrieval      | Claude Code/JIT retrieval    |
| Create a task handoff          | Sourcegraph Amp              |
| Use provider-native compaction | OpenAI/model adapters        |

## Layer 3: Who performs the operation?

* Rules engine
* General-purpose LLM
* Dedicated compaction model
* Original agent itself
* Provider-native endpoint
* Human

## Layer 4: How is state preserved?

* Destructive context replacement
* Append-only log with generated context views
* External memory store
* Fresh-agent handoff
* Cross-session memory

Your router therefore does not merely choose:

> “Use Morph.”

It creates a plan such as:

```text
Trigger:
Task boundary reached at 78% context usage

Operations:
- Preserve user requirements verbatim
- Mask superseded terminal outputs
- Extract exact error messages from active failures
- Summarize the completed repository exploration
- Externalize API documentation
- Keep the latest code diff
- Continue in the current agent

Executor:
- Deterministic rules for instructions and errors
- LLM for completed-task summary
- Embedding-based retrieval for externalized documentation

Validation:
- Verify all user constraints survived
- Verify all active artifact paths survived
- Check summary for unsupported statements
```

That compositional model is the heart of the product.

---

# Finalized product definition

## Deployment model

You selected **D: standalone proxy**, but the proxy exposes compaction as an **agent tool**.

So the product has two integration surfaces:

### API integration

Applications send conversation events through your service.

```http
POST /v1/sessions/{session_id}/events
POST /v1/sessions/{session_id}/compaction-plan
POST /v1/sessions/{session_id}/compact
GET  /v1/sessions/{session_id}/context
```

### Agent-tool integration

The agent receives a tool such as:

```python
compact_context(
    objective="Continue implementing OAuth",
    upcoming_action="Run integration tests",
    desired_budget=24000
)
```

The tool returns either:

* A generated compaction plan
* A question for the user
* An approved runtime context
* A recommendation to hand off to a new agent

---

# Proposed architecture

```text
                         AGENT / APPLICATION
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ API / Proxy Layer │
                        └────────┬─────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Canonical Event Log      │
                    │                          │
                    │ Raw messages             │
                    │ Tool calls and outputs   │
                    │ User responses           │
                    │ Model responses           │
                    │ Compaction decisions      │
                    │ Artifact references       │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Context Analyzer         │
                    │                          │
                    │ Semantic classification  │
                    │ Task-stage detection     │
                    │ Exactness requirements   │
                    │ Artifact extraction      │
                    │ Reconstructability       │
                    │ Relevance prediction     │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Policy Engine            │
                    │                          │
                    │ Global user preferences  │
                    │ Hard preservation rules  │
                    │ Model capabilities       │
                    │ Cost and token budgets   │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Strategy Planner         │
                    │ Rules + LLM              │
                    │                          │
                    │ Plans per segment        │
                    └────────────┬─────────────┘
                                 │
                   ┌─────────────▼──────────────┐
                   │ Human Decision Gateway     │
                   │                            │
                   │ Ask only about uncertain   │
                   │ or high-risk decisions     │
                   └─────────────┬──────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Strategy Executors       │
                    │                          │
                    │ Keep                     │
                    │ Mask                     │
                    │ Delete                   │
                    │ Summarize                │
                    │ Externalize              │
                    │ Handoff                  │
                    │ Provider-native compact  │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Safety Validator         │
                    │                          │
                    │ Instruction coverage     │
                    │ Artifact coverage        │
                    │ Hallucination checks     │
                    │ Contradiction detection  │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Runtime Context View     │
                    └─────────────────────────┘
```

The canonical history remains untouched. Every compaction produces a new **context view**, which means you can:

* Compare strategies
* Undo bad decisions
* Re-run the same session with another policy
* Inspect exactly what disappeared
* Measure degradation across repeated compactions

---

# Human interaction model

You selected:

* Generic preferences once at the beginning
* Specific questions during each compaction

That can work well, but the system should avoid stopping the agent for obvious low-risk decisions.

## Initial global profile

The user configures priorities such as:

```yaml
mode: accuracy_first

optimization:
  task_success: very_high
  instruction_preservation: mandatory
  hallucination_tolerance: zero
  token_reduction: medium
  latency: medium

preferences:
  preserve_user_messages_verbatim: true
  preserve_active_errors_verbatim: true
  allow_agent_handoff: true
  allow_external_retrieval: true
  require_approval_for_high_risk_changes: true
```

Suggested built-in modes:

| Mode             | Behaviour                              |
| ---------------- | -------------------------------------- |
| Accuracy First   | Keeps more verbatim material           |
| Balanced         | Moderate compression with validation   |
| Cost First       | Aggressive masking and externalization |
| Long-Horizon     | Prefers task summaries and handoffs    |
| Human Controlled | Requires approval for major operations |
| Custom           | User assigns weights and hard rules    |

## Per-compaction questions

The question should be generated from the actual trade-off.

For example:

> The unresolved authentication failure has 9,200 tokens of logs. I can retain the final stack trace and externalize the complete logs, or preserve everything verbatim. Which should survive in the active context?

Or:

> Repository exploration is complete, but three architectural alternatives were considered. Should I preserve all rejected alternatives, or retain only the selected approach and rejection reasons?

Each question should include:

* What information is affected
* Why compaction is being proposed
* Available choices
* Estimated token savings
* Risk associated with each choice

The system should not ask about deleting obsolete package-installation progress bars or duplicate outputs. Those can be handled by hard rules.

---

# Context item model

Each message should be split into meaningful segments rather than treated as one indivisible block.

```json
{
  "segment_id": "seg_193",
  "event_id": "evt_72",
  "session_id": "session_14",
  "content_type": "tool_observation",
  "semantic_type": "error_trace",
  "task_id": "oauth-implementation",
  "task_stage": "debugging",
  "status": "unresolved",
  "artifacts": [
    "src/auth/oauth.ts",
    "tests/auth.test.ts"
  ],
  "importance": 0.92,
  "future_relevance": 0.88,
  "exactness_required": true,
  "retrievable": true,
  "reconstruction_cost": "medium",
  "user_pinned": false,
  "dependencies": [
    "seg_196",
    "seg_201"
  ],
  "previous_operations": []
}
```

The planner then assigns an action:

```json
{
  "segment_id": "seg_193",
  "operation": "extract_and_externalize",
  "active_context_content": "Exact final error and stack frame",
  "external_reference": "memory://session_14/logs/oauth_failure_3",
  "reason": "Active unresolved error, but full output is retrievable",
  "confidence": 0.89,
  "requires_human_approval": false
}
```

---

# Strategy registry

Each compaction mechanism should implement the same interface.

```python
from typing import Protocol


class CompactionStrategy(Protocol):
    name: str

    def supports(self, segment, environment) -> bool:
        ...

    def estimate(self, segment, environment):
        """Estimate token savings, latency, cost, and preservation risk."""
        ...

    def execute(self, segment, environment):
        """Return transformed content and provenance information."""
        ...

    def validate(self, original, transformed):
        """Return retention and hallucination checks."""
        ...
```

This allows you to add:

* A Morph adapter
* An OpenAI native-compaction adapter
* A local summarizer
* A deterministic observation masker
* A specialized code-state compactor
* A task-handoff generator

without changing the orchestration layer.

---

# Combining the evaluation ideas from the image

The image gives you four excellent product demos. They should become four evaluation modules inside the platform.

## 1. Second Brain Bot → Persistence and observability test

The original idea:

> Feed facts during the day, answer later, survive a restart, and show what was stored.

For your system, this becomes:

### Context Ledger

Feed the agent:

* User preferences
* Constraints
* Decisions
* Artifact changes
* Errors
* Facts
* Completed and unresolved tasks

Then compact, restart, or hand off the agent.

The dashboard shows:

* Original information
* Classification
* Selected strategy
* Active-context representation
* Externalized representation
* Whether it was later recalled
* Which compaction cycle modified it

This proves that your system is not a mysterious summarization black box.

---

## 2. Goldfish vs Elephant → Side-by-side agent comparison

Run the same task with:

### Goldfish

* Fixed threshold
* One generic summary strategy
* No structured artifact tracking
* No human preferences

### Elephant

* Context-aware picker
* Segment-level mixed compaction
* Append-only history
* Human policy
* Validation and retrieval

A stronger benchmark should actually have four columns:

| Run              | Context approach          |
| ---------------- | ------------------------- |
| Baseline         | No compaction             |
| Static           | One fixed strategy        |
| Manual best-case | Human-selected strategy   |
| Adaptive         | Your context-aware picker |

Show:

* Final task result
* Tests passed
* Instructions violated
* Facts recalled
* Repeated tool calls
* Tokens consumed
* Compaction cost
* Hallucinated artifacts
* Total elapsed time

This becomes your most convincing demo.

---

## 3. Recall Score → Structured retention benchmark

Before compaction, generate hidden questions from the canonical event log.

The questions should cover several categories.

### User instructions

* What constraint did the user place on the implementation?
* Which library did the user explicitly prohibit?

### Artifacts

* Which file was modified?
* What function signature changed?
* Which test is currently failing?

### Decisions

* Why was PostgreSQL selected over SQLite?
* Which approach was attempted and rejected?

### Exact details

* What was the error code?
* Which port was the service using?
* What command produced the failure?

### Task state

* Which subtasks are finished?
* What is the next unresolved action?

After compaction, ask the consuming agent those hidden questions.

Then calculate:

```text
Overall Recall
Instruction Recall
Artifact Recall
Decision Recall
Exact-Fact Recall
Unresolved-State Recall
```

The exact category breakdown matters more than one overall recall percentage.

---

## 4. Decay Lab → Repeated-compaction degradation

This is especially important because the major danger is not just one bad summary. It is **summary-of-summary drift**.

Run the same information through:

```text
Original session
→ Compaction 1
→ More events
→ Compaction 2
→ More events
→ Compaction 3
→ Agent handoff
→ Session restart
```

At every stage, measure which facts survive.

The dashboard can show:

| Information       | C1 | C2 | C3 | Handoff | Restart |
| ----------------- | -: | -: | -: | ------: | ------: |
| User instruction  |  ✓ |  ✓ |  ✓ |       ✓ |       ✓ |
| Active file path  |  ✓ |  ✓ |  ✗ |       ✗ |       ✗ |
| Error code        |  ✓ |  ✗ |  ✗ |       ✗ |       ✗ |
| Rejected approach |  ✓ |  ✓ |  ✓ |       ✓ |       ✓ |

This produces a **retention curve** for each information type and each strategy.

It also lets you compare:

* Repeated summarization
* Extractive deletion
* Observation masking
* Retrieval offloading
* Fresh-agent handoff
* Your adaptive combination

---

# Unified evaluation framework

## Primary metrics

### 1. Final task success

The system’s most important metric.

For coding agents:

* Tests passed
* Correct patch produced
* Regression rate
* Task completion
* Human acceptance

### 2. User instruction preservation

Treat this as a hard constraint, not merely another metric.

Measure:

* Instruction recall
* Constraint violations
* Preference violations
* Whether verbatim-required instructions survived exactly

### 3. Hallucination risk

Measure:

* Fabricated file paths
* Fabricated decisions
* Altered numbers
* Incorrect error messages
* Reversed relationships
* Claims unsupported by the canonical history

### 4. Customizability compliance

Did the system follow the selected policy?

For example:

* Accuracy-first mode should not aggressively paraphrase exact facts.
* Cost-first mode should reach the target budget.
* Pinned content should never disappear.
* Human rejection of a strategy should be respected.

## Secondary metrics

* Token reduction
* Total token consumption across the full task
* Compaction latency
* Compaction API cost
* Repeated file reads
* Repeated tool calls
* Recovery after a bad compaction
* Number of human interruptions
* Retrieval success
* Context-view size
* Number of compaction cycles survived

## Default weighted score

A starting configuration could be:

| Dimension                 | Weight |
| ------------------------- | -----: |
| Final task success        |    35% |
| Instruction preservation  |    20% |
| Hallucination avoidance   |    15% |
| Artifact and state recall |    15% |
| Policy compliance         |    10% |
| Efficiency                |     5% |

But instruction preservation should also have a minimum threshold. A strategy that violates a critical instruction should fail even if its weighted score is otherwise high.

---

# The best first demo

Build one coding-agent evaluation called:

## Goldfish vs Elephant: The Three-Compaction Challenge

Give both agents the same repository task:

1. Explore a repository.
2. Follow several user constraints.
3. Modify multiple files.
4. Encounter an error.
5. Try and reject one approach.
6. Compact after exploration.
7. Compact during implementation.
8. Compact during debugging.
9. Finish the task after a fresh-agent handoff.

### Goldfish

Uses one generic LLM summary at every token threshold.

### Elephant

Uses your adaptive planner:

* Exploration outputs → summarized
* Large documentation → externalized
* Old terminal output → masked
* User instructions → retained verbatim
* Active errors → exact extraction
* Modified artifacts → structured state
* Final phase → task-boundary handoff

The final interface shows:

```text
Task success
Tests passed
Instruction recall
Artifact recall
Exact-fact recall
Hallucinations
Repeated actions
Tokens consumed
Compaction cost
Retention after each cycle
```

That single demo combines all four ideas in the image.

---

# What belongs in V0

You can represent all seven philosophies, but you do not need to recreate all proprietary systems initially.

## Implement directly

1. Observation masking
2. Tool-result clearing
3. Extractive deletion
4. Structured summarization
5. Retrieval externalization
6. Fresh-agent handoff
7. Agent/task-boundary triggering

## Support through adapters

1. Provider-native compaction endpoints
2. Third-party compaction models
3. Self-summarizing models
4. Dedicated deletion models

## Defer

* Training an RL self-compaction model
* Training your own Morph-like model
* Optimizing the picker from task-success reward
* Multi-agent shared memory
* Automatic learning of long-term user preferences

The first product should prove that **routing and composition improve outcomes**, before training any custom models.

---

# Recommended build sequence

## Phase 1: Replayable event foundation

* API proxy
* Append-only event schema
* Raw transcript ingestion
* Tool-call ingestion
* Context-view generation
* Replay and rollback

## Phase 2: Deterministic compactors

* Observation masking
* Tool-result clearing
* Exact extraction
* Retrieval offloading
* Manual pinning

## Phase 3: LLM planner

* Semantic segment classification
* Task-stage detection
* Mixed strategy plan
* Confidence and risk scores
* Context-specific user question

## Phase 4: Safety validation

* Instruction coverage
* Artifact-state coverage
* Unsupported-claim detection
* Original-to-compacted diff
* Automatic fallback to a safer strategy

## Phase 5: Evaluation lab

* Goldfish vs Elephant
* Recall Score
* Decay Lab
* Context Ledger
* Token and task-success dashboard

## Phase 6: Learned routing

Once you have enough traces:

```text
Context state
+ selected strategy
+ human overrides
+ downstream task outcome
= router training data
```

Eventually the system can learn which plans work best for specific task types and models.

---

# The next decisions

Answer these six, and the V0 specification becomes concrete:

1. **Which agent framework should we integrate first:** OpenAI Agents SDK, LangGraph, PydanticAI, Mastra, or a custom loop?
2. **Should the first demonstration be a coding agent**, even though the product remains general-purpose?
3. When content is externalized, should the system **automatically retrieve it when relevant**, or should the consuming agent call a retrieval tool explicitly?
4. Should per-compaction human questions be **blocking**, or may the agent continue with a conservative default while awaiting an answer?
5. Which providers should V0 support: **OpenAI, Anthropic, Gemini, local models**, or only one initially?
6. Should the event log and externalized memory begin with **SQLite for a local prototype** or **PostgreSQL for a deployable service**?
