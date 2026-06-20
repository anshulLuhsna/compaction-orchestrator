<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Use this as the researcher prompt:

You are an AI research engineer helping design an evaluation metric for an open-source project called Compaction Orchestrator.

Project context:
Compaction Orchestrator is not positioned as “another summarizer.” It is a compaction control layer for AI agents. It stores a raw agent session, classifies context into segments, chooses different compaction strategies per segment, and returns a smaller runtime context view plus an inspectable compaction plan.

The core claim we want to test:
A use-case-aware, per-segment compaction plan preserves the information an agent needs better than normal generic compaction strategies such as:

- one generic summary
- last-N messages
- truncation
- naive rolling summary
- provider/harness hidden compaction when observable

Your task:
Research existing evaluation methods for context compaction, summarization, long-context memory, agent memory, retrieval, and long-horizon agent evaluation. Then propose one strong metric or evaluation framework we can implement in this repo.

Do not invent sources. Search the web and cite sources with links.

Focus areas to research:

1. Summarization evaluation:
    - ROUGE / BERTScore / semantic similarity
    - factual consistency metrics
    - why these are insufficient for agent compaction
2. Long-context evaluation:
    - needle-in-a-haystack style tests
    - RULER / LongBench / similar long-context benchmarks
    - what they measure and what they miss for agents
3. Agent evaluation:
    - task success after compaction
    - trajectory preservation
    - tool-use correctness
    - state handoff quality
    - regression across prompt/model changes
4. Memory and retrieval evaluation:
    - recall@k
    - precision of retained facts
    - retrieval-grounded answer accuracy
    - stale or irrelevant memory pollution
5. Compression tradeoff metrics:
    - token reduction
    - latency/cost reduction
    - preservation of critical facts
    - downstream task success

What I want you to produce:

A. Existing Work Summary
Give a concise summary of the most relevant existing metrics/benchmarks.
For each one include:

- name
- what it measures
- why it is useful
- why it is not enough for agent compaction

B. Proposed Metric
Design a metric for Compaction Orchestrator.

The metric should compare:

- raw full context
- generic summary
- last-N messages
- naive truncation
- Compaction Orchestrator output

The metric should reward:

- preserving exact user constraints
- preserving active errors
- preserving decisions/rejected approaches
- preserving artifact/file state
- preserving policy constraints
- preserving next action
- externalizing noisy but retrievable content instead of losing it
- reducing tokens

The metric should penalize:

- losing critical facts
- paraphrasing exact constraints when exactness matters
- retaining too much irrelevant context
- hallucinating facts not in the original session
- hiding why a compaction decision was made
- making the downstream agent fail the next task

C. Metric Formula
Propose a concrete formula.

I am considering something like:

Compaction Utility Score =
weighted critical fact recall

+ downstream task success
+ exactness preservation
+ plan inspectability
+ retrieval recoverability
- hallucination penalty
- irrelevant context penalty
+ token reduction bonus

But improve this. Make it rigorous.

Define each subscore:

- how to compute it
- what inputs are needed
- whether it is automatic, LLM-judged, or human-labeled
- what weights should be default
- how weights change by use case: coding agent, support agent, voice agent

D. Evaluation Protocol
Design an eval protocol we can implement.

Include:

- fixture format
- expected facts / invariants format
- baseline compaction strategies
- scoring script design
- how to run multiple seeds or variants
- how to compare outputs
- how to report results in CLI and UI

E. Example Eval
Create one concrete example for a coding-agent session.

The session should include:

- user instruction
- noisy tool output
- active error
- rejected approach
- changed file/artifact
- next action

Show what facts must survive.
Show how each baseline might fail.
Show how Compaction Orchestrator should score better.

F. Recommended Name
Suggest 5 names for the metric.

Good names should sound serious and technical, not gimmicky.
Examples of the kind of name I like:

- Context Survival Score
- Agent Continuity Score
- Compaction Utility Score
- Critical State Retention
- Context Fidelity Under Compression

G. Implementation Plan
Give me a practical implementation plan for this repo.

Assume this TypeScript project already has:

- SDK
- CLI
- HTTP API
- SQLite persistence
- web UI
- examples/customer-support-session.json
- examples/coding-agent-session.json
- existing simple recall evals

Tell me:

- what files to add
- what scripts to add
- what data schema to use
- how to show the score in the UI
- what minimum version can be built in one day

Output style:
Be concrete. Be skeptical. Do not hype.
If existing research does not directly solve this, say so.
End with the strongest recommended metric and why it fits Compaction Orchestrator specifically.
My instinct: the metric should not be “summary quality.” It should be closer to agent continuity under compression.
The winning eval will probably combine:
critical state recall

+ exactness preservation
+ downstream next-turn task success
+ retrieval recoverability
+ token reduction
- hallucinated state
- irrelevant retained context
That lets you show the actual product claim: not “we summarize better,” but we preserve what the next agent turn needs while shrinking the rest.

A good fit for Compaction Orchestrator is an **agent-continuity-under-compaction metric**: a composite score that measures how well critical agent state survives compaction (and can be recovered) while actually shrinking tokens, with downstream next-turn task success as the arbiter. It explicitly compares baselines (full context, last‑N, generic summaries, truncation) to the orchestrated, per‑segment plan.

Below I’ll first ground this in existing work, then define a concrete metric, protocol, example, names, and an implementation plan.

***

## A. Existing work summary

### 1. Summarization metrics and factuality

**ROUGE / BLEU / BERTScore**

- **What they are:** ROUGE and BLEU measure n‑gram overlap between system output and reference summaries; ROUGE-L uses longest common subsequence; BERTScore uses contextual embeddings to score semantic similarity between candidate and reference.[^1][^2]
- **What they measure / why useful:**
    - Cheap, automatic approximations of relevance and fluency; correlate moderately with human judgments of relevance for some datasets.[^2][^1]
    - BERTScore handles paraphrases better than pure n‑gram overlap by matching in embedding space.[^1]
- **Why insufficient for compaction:**
    - They correlate poorly with **factual accuracy** and domain fidelity; models can hallucinate but still score high on ROUGE/BERTScore.[^3][^4][^5]
    - They assume a single “gold” reference and don’t know which facts are *critical* for agent continuity vs nice-to-have.
    - They do not penalize hallucinated constraints, wrong file paths, or changed error messages if wording still overlaps.[^5][^3]
    - They say nothing about **downstream task success** (e.g., whether the next coding step works) or whether compaction kept tool outputs and decisions in a usable form.

**Factual consistency / hallucination metrics**

- **Examples:** FActScore, LongDocFACTScore, question-answer generation based hallucination detection, TOFUeval.[^6][^7][^8][^4][^5]
- **What they measure / why useful:**
    - TOFUeval provides a dialogue-summarization benchmark with human labels for factual consistency, showing that LLM summaries hallucinate often, and that specialized factuality metrics can outperform LLM-as-judge on hallucination detection.[^7][^6]
    - Recent work uses QAG-style pipelines: generate questions from the summary, answer from the source, and compare answers to detect hallucinated statements.[^8][^5]
- **Why insufficient for compaction:**
    - They treat “factual consistency with source” as a global property; they don’t distinguish **critical vs non-critical** state.
    - They are summary-centric; they don’t model multi-turn agent trajectories, tool outputs, or state handoff.
    - They don’t include a **compression** dimension; a summary that’s 99% of the original text could get great factuality scores but be a useless “compaction” layer.

***

### 2. Long-context benchmarks

**Needle-in-a-Haystack (NIAH) and extensions**

- **What they are:** Insert one or more “needles” (facts) into a long “haystack” and ask the model to retrieve them. RULER generalizes this with single/multi-key, multi-value, and multi-query variants plus aggregation and multi-hop tasks.[^9][^10][^11]
- **Why useful:**
    - Directly tests long-context retrieval accuracy and how performance degrades with context length, exposing that many “32K context” models fall off sharply in accuracy at longer lengths.[^10][^11]
    - RULER adds multi-hop tracing and aggregation tasks, going beyond pure retrieval to test long-range reasoning over large contexts.[^11][^9]
- **Why insufficient for compaction:**
    - They assume *fixed* contexts; they don’t evaluate a system that chooses what to keep vs externalize.
    - Needles are synthetic and uniform; real agent state has heterogeneous types (constraints, error traces, decisions, files) with different priorities.
    - They measure “can the model find a token in long input,” not “did the compaction policy preserve the right subset so that the next action is correct.”

**LongBench / LongBench-v2**

- **What they are:** Bilingual, multi-task benchmarks for long-context understanding (single/multi-doc QA, summarization, few-shot, code, synthetic tasks), with documents from a few thousand up to 2M tokens and multiple question types; metric is typically accuracy or F1 on QA tasks.[^12][^13][^14]
- **Why useful:**
    - Covers realistic long-document scenarios (multi-doc QA, code repo understanding, structured data) with long inputs.[^13][^14][^12]
    - Provides a broad comparison of models’ long-context reasoning ability.
- **Why insufficient for compaction:**
    - Input is static; there is no notion of **incremental agent trajectory** or a memory controller.
    - They evaluate model capabilities, not explicit compaction policies or segment-specific strategies.
    - Task metrics (accuracy/F1) only indirectly reflect compaction quality and don’t distinguish which parts of the context were treated as critical vs compressible.

***

### 3. Agent memory and long-horizon benchmarks

**MemGym**

- **What it is:** A long-horizon memory environment for LLM agents, unifying existing “agent gyms” and memory-grounded pipelines across regimes: tool-use dialogue, deep-research, coding, and computer use.[^15][^16]
- **What it measures / why useful:**
    - Provides **memory-isolated scores**: they hold reasoning and tools constant while varying memory strategy, allowing cleaner comparison of memory systems.[^16]
    - Tracks whether agents preserve bridge facts across search turns, revisit earlier debugging evidence in coding tasks, or retain user constraints over long dialogues.[^15]
- **Why insufficient for compaction:**
    - Focuses on memory modules in agent environments, not explicitly on *per-segment compaction plans* as an inspectable artifact.
    - Metrics are largely task success and QA over trajectories; they don’t explicitly score token-budget vs retained critical state, or inspectability of compaction decisions.

**AMA-Bench**

- **What it is:** AMA-Bench (Agent Memory with Any length) evaluates long-horizon memory in real agentic applications with real-world trajectories and synthetic ones that scale to arbitrary horizons.[^17][^18]
- **What it measures / why useful:**
    - Combines real trajectories with expert-curated QA about what memory should preserve, and synthetic trajectories with rule-based QA.[^18]
    - Shows many existing memory designs underperform long-context baselines due to lossy compression and similarity-based retrieval errors, highlighting the cost of bad memory.[^17]
- **Why insufficient for compaction:**
    - Designed to compare *memory systems* at the agent level, not plug-in compaction controllers.
    - Emphasizes QA accuracy over trajectories, not the detailed structure of compaction (segment types, strategies, plan inspectability) or explicit token-usage tradeoffs.

**WorldMemArena / AMemGym**

- **WorldMemArena:** Evaluates multimodal agent memory across multi-session tasks using an Action–World Interaction Loop, annotating “gold memory points, updates, distractors, and evidence chains” for detailed diagnostics.[^19]
- **AMemGym:** An interactive environment for on-policy evaluation and optimization of long-horizon conversational memory, with structured state schemas and state evolution.[^20][^21]
- **Utility:** Both emphasize structured state evolution, distractors, and evaluation of whether the agent tracks user state across sessions—very close in spirit to “what to preserve” vs “what to forget.”[^21][^19]
- **Gap for compaction:** Neither directly models a separate compaction layer that outputs a smaller context view plus an explicit compaction plan, nor do they measure token savings vs continuity.

***

### 4. Retrieval and RAG evaluation

**IR-style metrics: Precision@k, Recall@k, Context Precision/Recall**

- **What they are:** Precision@k is the fraction of top‑k retrieved items that are relevant; Recall@k is the fraction of all relevant items that appear in the top‑k.[^22][^23][^24]
- **Why useful:**
    - High precision means less noise in retrieved context; high recall means critical documents aren’t missed—both are crucial for RAG and memory retrieval.[^23][^24][^22]
    - “Context precision” and “context recall” variants measure signal-to-noise and coverage of necessary information in retrieved context.[^24][^25][^22]
- **Why insufficient for compaction:**
    - These metrics evaluate a **retriever** against a fixed corpus; they do not evaluate a compaction planner that decides which pieces of a trajectory become part of that corpus vs the active context.
    - They treat all relevant documents equally; they don’t embed domain-specific notions like “policy constraints” or “active error state.”

**RAGAS and related frameworks**

- **What it is:** RAGAS (Retrieval Augmented Generation Assessment) is a framework with metrics like context precision/recall, entity recall, noise sensitivity, answer faithfulness, and response relevance, many of them reference-free but using LLMs as judges.[^25][^26][^27]
- **Utility:**
    - Provides **component-level metrics** for retrieval and generation as well as end-to-end answer correctness.[^27]
    - Introduces metrics like **noise sensitivity** (how spurious context affects answers) and faithfulness (are answers supported by retrieved context).[^26][^25]
- **Gap for compaction:**
    - Target is RAG question-answer pipelines, not long-horizon agent state.
    - No explicit modeling of trajectory-level decisions, rejected plans, or artifact state; metrics are question-centric, not “next action” oriented.

***

### 5. Compression and efficiency metrics

- **What’s commonly used:** Token count, context length, memory usage; benchmarks like MEM1 report memory efficiency (e.g., constant memory usage, 3.5× savings) alongside EM/F1 for tasks.[^28]
- **Why useful:**
    - Directly measures cost/latency reduction, which is a primary motivation for compaction.[^28]
- **Why insufficient alone:**
    - They do not know whether the compressed representation still preserves the crucial agent state; a heavily compressed memory with high EM can miss long-tail constraints specific to agent workflows (e.g., “do not touch file X”).

**Takeaway:**
There is substantial work on summarization, long context, agent memory, and RAG evaluation, but **none** directly define a metric for “agent continuity under explicit, per-segment compaction plans with token budgets.” Existing benchmarks either:

- ignore compaction strategy entirely,
- focus on QA or summarization quality, or
- measure memory designs at the agent level without scoring the compaction plan as a first-class object.[^9][^18][^16][^19][^21][^15][^17]

That’s the gap Compaction Orchestrator can own.

***

## B. Proposed metric: Agent Continuity under Compaction

I’ll call the metric generically **Agent Continuity under Compaction Score (ACCS)**; you can rename per section F.

### High-level idea

For each **scenario fixture** (e.g., a coding session just before the next turn), you:

1. Define a set of **critical state invariants**:
    - user constraints (incl. policy and safety constraints),
    - active errors (tool outputs, stack traces),
    - decisions and rejected approaches,
    - artifact/file state (file paths, key function signatures, diffs),
    - next action specification (what the agent is supposed to do next),
    - which items are allowed to be externalized (retrievable) vs must be inline.
2. For each **compaction strategy**:
    - full raw context (oracle),
    - generic one-shot summary,
    - last‑N messages,
    - truncation by tokens,
    - naive rolling summary,
    - Compaction Orchestrator (per-segment plan),

you compute sub-scores that answer:
    - **Did the critical state survive (inline or recoverable via retrieval)?**
    - **Is exactness preserved where required?**
    - **Does the next agent turn succeed on its task?**
    - **Is the compaction plan transparent?**
    - **Did we avoid hallucinated or irrelevant content?**
    - **What token savings did we achieve?**
3. Aggregate these into ACCS, a normalized 0–1 score per strategy per fixture, with higher = better continuity under compression.

***

## C. Metric formula and subscores

### Overall formula

Let each subscore be normalized to $[0,1]$ (penalties also $[0,1]$). Define:

$$
\text{ACCS} = w_{csr} \cdot CSR + w_{ex} \cdot EX + w_{dts} \cdot DTS + w_{rr} \cdot RR + w_{pi} \cdot PI + w_{tr} \cdot TR - w_{hall} \cdot H - w_{irr} \cdot IC
$$

where:

- $CSR$: Critical State Recall
- $EX$: Exactness Preservation
- $DTS$: Downstream Task Success
- $RR$: Retrieval Recoverability
- $PI$: Plan Inspectability
- $TR$: Token Reduction bonus
- $H$: Hallucination Penalty
- $IC$: Irrelevant Context penalty

All $w$ weights are non-negative and chosen so ACCS $\in [0,1]$ (e.g., normalize sum of positive weights to 1 and keep penalties small but non-trivial).

Below, for each subscore I’ll specify:

- computation,
- inputs,
- automation,
- default weights for three use cases.


### 1. Critical State Recall (CSR)

**Goal:** Reward preserving all **annotated critical facts**, whether inline or via explicitly linked external memory.

- **Inputs:**
    - Fixture list $F = \{f_i\}$ of facts with attributes:
        - `id`, `text` (or structured form),
        - `type` ∈ {constraint, error, decision, rejected_approach, artifact_state, policy, next_action},
        - `criticality` ∈ {critical, important, nice_to_have},
        - `externalizable` ∈ {true, false}.
    - Compacted runtime context $C$.
    - Optional: compaction plan listing what was kept inline vs externalized.
- **Computation:**
    - Define weights by criticality, e.g. {critical: 3, important: 2, nice: 1}.
    - For each fact $f_i$:
        - It is counted as “recalled” if:
            - (a) its string/structured representation (or an LLM-identified equivalent) appears in runtime context $C$, or
            - (b) it’s marked `externalizable=true` and can be retrieved by a retrieval query seeded with the next user instruction (see RR below).
    - Compute weighted recall:

$$
CSR = \frac{\sum_{i \in \text{recalled}} w(f_i)}{\sum_{i} w(f_i)}
$$
- **Automation:**
    - Low-level check: exact substring / structured field match (automatic).
    - Fuzzy equivalence (e.g., “max 3 retries” vs “retry up to three times”): optional LLM-judge or embedding-based semantic similarity, but **only** if not exact-match to avoid inflating paraphrased-but-wrong constraints.
- **Default weight:**
    - Coding: $w_{csr} = 0.25$
    - Support: $w_{csr} = 0.25$
    - Voice agent: $w_{csr} = 0.20$

(Downstream task success will carry another large chunk.)

### 2. Exactness Preservation (EX)

**Goal:** Reward **bit-level exact preservation** where the fixture says exactness matters (e.g., error messages, file paths, API parameters, regexes, policy text).

- **Inputs:**
    - Subset of facts $E \subset F$ where `exact_required=true`.
    - Compacted context $C$.
- **Computation:**
    - For each $f_i \in E$, check whether:
        - its canonical string or structured representation appears **exactly** in $C$,
        - or, for structured fields, that key-value pairs match exactly (e.g., JSON snippet with same fields and values).
    - Score:

$$
EX = \frac{\# \text{exactly preserved facts}}{|E|}
$$
    - If a fact is only paraphrased, count it as **not exact**, even if semantically similar (aligning with your requirement).
- **Automation:** Automatic (string/structured equality). No LLM required.
- **Default weight:**
    - Coding: $w_{ex} = 0.20$ (exact error messages, paths, constraints matter a lot).
    - Support: $w_{ex} = 0.10$ (policy text and SLA clauses).
    - Voice: $w_{ex} = 0.10$.


### 3. Downstream Task Success (DTS)

**Goal:** The ultimate test – after compaction, does the next agent turn succeed on the intended task?

- **Inputs:**
    - For each fixture, a **next-task harness**:
        - Coding: repo snapshot + unit tests + reference call (e.g., patch-based or “next action” target).
        - Support: canonical answer or structured checklist, or LLM-as-judge rubric.
        - Voice agent: target API call or action sequence.
    - Base agent configuration (model, system prompt, tool harness).
- **Computation:**
    - For each compaction strategy $s$:
        - Run the agent once with **full context** to obtain an “oracle” next action and ground-truth success label from the harness.
        - Then run the agent on compacted context $C_s$ for $N$ seeds (e.g., different sampling random seeds or slight prompt variations).
        - Evaluate each run’s success using the harness:
            - Coding: all tests pass → 1, else 0.
            - Support: exact match / high-scoring LLM-judge rating (e.g., ≥0.9) → 1, else interpolation between 0 and 1.
        - Compute:

$$
DTS_s = \frac{1}{N}\sum_{j=1}^N \text{success}_{s,j}
$$
    - You can also normalize by the oracle’s best performance if you want relative scoring (e.g., if model fails even with full context).
- **Automation:** Harness-specific; coding can be purely automatic; support/voice likely need LLM-as-judge with careful rubrics.
- **Default weight:**
    - Coding: $w_{dts} = 0.30$
    - Support: $w_{dts} = 0.35$
    - Voice: $w_{dts} = 0.30$


### 4. Retrieval Recoverability (RR)

**Goal:** Reward strategies that **externalize noisy content** but keep it retrievable when needed.

- **Inputs:**
    - Facts with `externalizable=true`.
    - Retrieval store built from compaction plan (segments that were “archived”).
    - A standardized **query generator** for the next step, e.g.,:
        - the next user message plus system/tool prompt,
        - or synthetic queries derived from each fact $f_i$.
- **Computation:**
    - For each externalizable fact $f_i$ and compaction strategy $s$:
        - Construct a query $q_i$ that an agent would likely issue to recover that information (templated or LLM-generated).
        - Retrieve top‑$k$ chunks from the external store of $s$.
        - Mark $f_i$ as recovered if any retrieved chunk contains it (lexically or by LLM-as-judge).
    - Compute weighted recall over externalizable facts:

$$
RR = \frac{\sum_{i \in \text{recovered} \cap E_x} w(f_i)}{\sum_{i \in E_x} w(f_i)}
$$

where $E_x = \{f_i \mid externalizable=true\}$.
- **Automation:** Retrieval is mechanical; matching can be exact or LLM-based; weighting same as CSR.
- **Default weight:**
    - Coding: $w_{rr} = 0.10$ (logs tracebacks often externalizable).
    - Support: $w_{rr} = 0.10$.
    - Voice: $w_{rr} = 0.15$ (voice logs/episodes externalization important).


### 5. Plan Inspectability (PI)

**Goal:** Reward compaction plans that are **explicit and interpretable**: you can see why each segment was kept/compacted and with what strategy.

This is where Orchestrator should dominate baselines, which usually have no inspectable plan.

- **Inputs:**
    - Compaction plan object for strategy $s$ with entries like:
        - segment id, type (user, tool, code, policy, etc.),
        - chosen strategy (keep, summarize, drop, externalize),
        - rationale (free text string),
        - token statistics (before/after).
- **Computation (one example):**
    - Define:
        - Coverage: fraction of original segments that are mentioned in the plan.
        - Rationale completeness: fraction of segments with non-empty rationales.
        - Type coverage: how many distinct segment types are explicitly handled.
    - Combine:

$$
PI = \frac{1}{3}(coverage + rationale\_completeness + type\_coverage)
$$
    - Baselines without plans get $PI = 0$.
- **Automation:** Purely structural; no LLM needed.
- **Default weight:**
    - All use cases: $w_{pi} = 0.05$ (important for debugging and trust, but secondary to task success and recall).


### 6. Token Reduction (TR)

**Goal:** Reward smaller runtime contexts, but only up to a point; don’t incentivize degenerate “drop everything” strategies.

- **Inputs:**
    - Original token count $T_{orig}$ for the raw session.
    - Runtime context token count $T_s$ for strategy $s$ (excluding external store).
- **Computation:**
    - Raw fraction:

$$
r = 1 - \frac{T_s}{T_{orig}}
$$
    - Clip to $[0, r_{max}]$, e.g., $r_{max} = 0.8$ (beyond 80% reduction, we don’t give extra credit by default).
    - Normalize:

$$
TR = \frac{\min(r, r_{max})}{r_{max}}
$$
- **Automation:** Mechanical.
- **Default weight:**
    - Coding: $w_{tr} = 0.05$
    - Support: $w_{tr} = 0.05$
    - Voice: $w_{tr} = 0.10$ (latency often tighter).


### 7. Hallucination Penalty (H)

**Goal:** Penalize compaction outputs that **state facts not supported by the raw session**, in line with hallucination definitions in summarization and RAG work.[^4][^8][^5]

- **Inputs:**
    - Raw full session as “source.”
    - Compacted runtime context (and plan) as “summary.”
- **Computation (QAG-style):**
    - Use a hallucination detection pipeline adapted from summarization work:
        - Generate atomic factual statements (or questions) from $C_s$.
        - For each, check support in the source using an LLM-as-judge or specialized factuality metric.[^8][^5]
    - Let $h$ be the fraction of statements judged **unsupported**.
    - Set $H = h$ (0–1).
- **Automation:** LLM-based, somewhat noisy; but we mostly need to distinguish “low hallucination” vs “lots of invented constraints.”
- **Default weight:**
    - Coding: $w_{hall} = 0.10$
    - Support: $w_{hall} = 0.15$
    - Voice: $w_{hall} = 0.10$


### 8. Irrelevant Context penalty (IC)

**Goal:** Penalize keeping too much **irrelevant or stale context**, similar to low context precision / high noise sensitivity in RAG eval.[^22][^24][^25][^26]

- **Inputs:**
    - Fixture labels on segments or facts: `relevant_for_next_step=true/false`.
    - Runtime context $C_s$ segments.
- **Computation:**
    - Let $R$ = tokens belonging to segments labeled relevant.
    - Let $K$ = all tokens kept in runtime context.
    - Context precision:

$$
P_c = \frac{|R \cap K|}{|K|}
$$
    - Define penalty as:

$$
IC = 1 - P_c
$$
    - (You can optionally also penalize for “stale but once relevant” facts separately.)
- **Automation:** Mechanical given per-segment labels in the fixture; can be extended with LLM-judged relevance for more realism, akin to context precision metrics in RAGAS.[^25][^26]
- **Default weight:**
    - Coding: $w_{irr} = 0.05$
    - Support: $w_{irr} = 0.05$
    - Voice: $w_{irr} = 0.05$


### Default weights by use case

You can encode defaults like:

- **Coding:**
    - $w_{csr}=0.25$, $w_{ex}=0.20$, $w_{dts}=0.30$, $w_{rr}=0.10$, $w_{pi}=0.05$, $w_{tr}=0.05$, $w_{hall}=0.10$, $w_{irr}=0.05$.
- **Support:**
    - Heavier on hallucinations and task success, slightly less on exactness.
- **Voice:**
    - Slightly more on TR and RR; slightly less on EX.

All of these should be configurable in the repo’s config file / CLI flags.

***

## D. Evaluation protocol for the repo

### 1. Fixture format

Use JSON fixtures under `examples/evals/` with a structure like:

```json
{
  "id": "coding-agent-session-001",
  "domain": "coding",
  "description": "Fix off-by-one bug in pagination without refactoring file",
  "model": "gpt-4.1",
  "session": [
    {
      "role": "user",
      "content": "…",
      "turn_id": "u1"
    },
    {
      "role": "assistant",
      "content": "…",
      "turn_id": "a1"
    },
    {
      "role": "tool",
      "name": "run_tests",
      "content": "…",
      "turn_id": "t1",
      "artifacts": [
        {
          "type": "test_output",
          "path": "logs/test.log"
        }
      ]
    }
  ],
  "next_task": {
    "type": "coding",
    "repo_path": "fixtures/repos/pagination-bug",
    "test_command": "npm test pagination.test.ts",
    "eval_type": "binary"
  },
  "facts": [
    {
      "id": "f1",
      "type": "constraint",
      "criticality": "critical",
      "externalizable": false,
      "exact_required": true,
      "text": "Do not refactor the entire file; only change the paginate() function.",
      "source_turn_ids": ["u1"]
    },
    {
      "id": "f2",
      "type": "error",
      "criticality": "critical",
      "externalizable": true,
      "exact_required": true,
      "text": "Expected page 3 to have 10 items but got 11",
      "source_turn_ids": ["t1"]
    },
    {
      "id": "f3",
      "type": "rejected_approach",
      "criticality": "important",
      "externalizable": false,
      "exact_required": false,
      "text": "The assistant proposed rewriting the entire pagination module, and the user rejected this.",
      "source_turn_ids": ["a1", "u2"]
    }
  ],
  "relevance_labels": [
    {
      "segment_ids": ["u1", "a1", "t1"],
      "relevant_for_next_step": true
    },
    {
      "segment_ids": ["older_chat_1", "older_chat_2"],
      "relevant_for_next_step": false
    }
  ]
}
```

Key design points:

- Facts and relevance labels are **explicit**, not inferred at eval time.
- `exact_required` and `externalizable` give you direct control over EX and RR behavior.


### 2. Baseline compaction strategies

Implement a small registry of strategies:

- `full`: no compaction (reference/oracle).
- `last-n-messages`: keep last $M$ messages.
- `last-n-tokens`: keep last $T$ tokens.
- `one-shot-summary`: call the model once to summarize entire history into a fixed token budget.
- `rolling-summary`: maintain a running summary plus the last few turns.
- `provider-hidden`: optional harness-simulated compaction if observable.
- `orchestrator`: Compaction Orchestrator’s per-segment plan.

Each strategy exposes a TypeScript interface:

```ts
type CompactionStrategy = (input: CompactionInput) => Promise<CompactionOutput>;

interface CompactionOutput {
  runtimeContext: string;
  plan?: CompactionPlan;
  archivedSegments?: ArchivedSegment[];
}
```


### 3. Scoring script design

Add a CLI command, e.g.:

```bash
co eval ./examples/evals/coding-agent-session-001.json \
  --strategies=full,last-n-messages,truncation,summary,orchestrator \
  --seeds=3 \
  --weights-preset=coding
```

Under the hood:

1. Load fixture and strategies.
2. For each strategy:
    - Run compaction to obtain `runtimeContext`, `plan`, and `archivedSegments`.
    - Compute CSR, EX, RR, PI, TR, IC from fixture + output.
    - Run the agent N times to compute DTS (using existing SDK/CLI/HTTP API).
    - Run hallucination detector (H).
3. Aggregate into ACCS and store per-run and aggregated metrics in SQLite.

A TypeScript type for persisted scores:

```ts
interface EvalRun {
  id: string;
  fixtureId: string;
  strategy: string;
  seed: number;
  metrics: {
    csr: number;
    ex: number;
    dts: number;
    rr: number;
    pi: number;
    tr: number;
    h: number;
    ic: number;
    accs: number;
  };
  tokens: {
    original: number;
    runtime: number;
    archived: number;
  };
  timestamp: string;
}
```


### 4. Multiple seeds / variants

- `--seeds=N` replicates the next-turn agent call N times per strategy.
- Store all per-seed runs; compute:
    - mean and standard deviation for DTS and ACCS,
    - optional 95% confidence intervals.
- You can also randomize minor variations in user message order if you want to stress compaction stability.


### 5. Reporting in CLI and UI

**CLI:**

- Print a table like:

```text
Strategy          ACCS   DTS   CSR   EX   RR   PI   TR   H    IC   Tokens(%) 
----------------------------------------------------------------------------
full              0.86   0.90  0.98 1.00 0.95 0.00 0.00 0.00 0.05 100
last-n-messages   0.52   0.40  0.55 0.50 0.20 0.00 0.40 0.05 0.30  40
truncation        0.47   0.30  0.50 0.45 0.15 0.00 0.60 0.03 0.35  30
summary           0.63   0.55  0.70 0.40 0.25 0.00 0.70 0.15 0.40  25
orchestrator      0.81   0.80  0.95 0.95 0.85 0.90 0.60 0.02 0.15  40
```

**UI:**

- “Evaluations” tab with:
    - Bar chart of ACCS per strategy.
    - Breakdown mini-bars for CSR, DTS, TR etc on hover.
    - A view linking from a strategy’s score to the actual compaction plan and runtime context for inspection.

***

## E. Example eval: coding-agent session

### Scenario

**User goal:** Fix a bug in a TypeScript pagination helper without refactoring the entire file, under strict constraints.

**Session (simplified):**

1. `u1` (user):

> I have a function `paginate(items: T[], page: number, pageSize: number)` in `src/pagination.ts`.
> Constraints:
> - Do not refactor the entire file, only edit `paginate`.
> - Do not change the function signature.
> - Do not add new dependencies.
> - Page numbers are 1-based.
> The bug: page 3 sometimes returns 11 items when `pageSize` is 10. Please fix.
2. `a1` (assistant):
    - Proposes an aggressive refactor: extract a new `Paginator` class, split logic across multiple functions, touch other files.
3. `u2` (user):

> Please undo that approach. I don’t want a refactor or new classes.
> Only change the implementation of `paginate` in `src/pagination.ts`. Keep everything else exactly as is.
4. `t1` (tool `git_diff`):
    - Shows a large diff touching multiple files, confirming the refactor (noisy, long).
5. `t2` (tool `run_tests`):
    - Outputs noisy Jest logs; the key lines are:

> FAIL src/pagination.test.ts
> Expected page 3 to have 10 items but got 11
> at `paginate` (src/pagination.ts:42:10)
6. `a2` (assistant):
    - Acknowledges constraints and promises to make a minimal change but hasn’t yet.
7. **Next action we want to evaluate:**
    - Agent should produce a small patch to `paginate` in `src/pagination.ts` that:
        - respects 1-based indexing,
        - uses correct slice boundaries, and
        - doesn’t touch any other file.

### Facts that must survive

In the fixture:

- `f1` (constraint, critical, exact-required=false):

> Only change the implementation of `paginate` in `src/pagination.ts`.
- `f2` (constraint, critical, exact-required=true):

> Do not add new dependencies.
- `f3` (constraint, important, exact-required=true):

> Page numbers are 1-based.
- `f4` (rejected_approach, important):

> “Refactor into a `Paginator` class touching multiple files” was tried and explicitly rejected.
- `f5` (error, critical, exact-required=true, externalizable=true):

> `Expected page 3 to have 10 items but got 11`.
- `f6` (artifact_state, critical):

> The function name, file path, and current slice expression around line 42 (e.g., `items.slice(page * pageSize, (page + 1) * pageSize)`).
- `f7` (next_action, critical):

> The next step is to produce a minimal patch to `paginate` in `src/pagination.ts` that passes tests.


### How baselines might fail

- **Full context:**
    - Perfect CSR and EX; no compression, no plan. ACCS is high except TR and PI are low (TR=0, PI=0).
- **Last‑N messages:**
    - If you keep only, say, the last 4 messages (`u2`, `t1`, `t2`, `a2`):
        - Likely **drops `f1`, `f2`, `f3`**, losing key constraints (only edit `paginate`, no new deps, 1-based).
        - DTS may fail because the agent might reintroduce a refactor or mis-handle 1-based indexing.
        - CSR and EX drop; ACCS is low despite decent token reduction.
- **Truncation by tokens:**
    - If truncated near the end:
        - Might keep the error message and some constraints but cut off parts of `u1` or `u2`, or lose the explicit rejection of the refactor.
        - Can also produce strange partial logs, confusing the model.
        - IC is high because irrelevant parts of `git_diff` logs might remain while an early constraint was lost.
- **One-shot summary:**
    - LLM summary might say:
> “User asks to fix a pagination bug where page 3 returns wrong item counts, and does not want a large refactor.”
        - `f2` (no new deps) and exact error string `f5` may be paraphrased or lost.
        - It might not mention file path `src/pagination.ts` or the exact function signature.
        - Hallucinations possible (e.g., summarizer invents edge cases).
        - CSR/EX moderate; H might be non-zero; DTS depends on how good the model is at working from this summary alone.
- **Naive rolling summary:**
    - Often over-compresses older turns and paraphrases constraints repeatedly, eroding EX and possibly dropping `f4` (rejected approach) and `f3` (1-based).
    - Noise from repeated noisy logs can accumulate or be poorly summarized.


### How Compaction Orchestrator should behave

Orchestrator segments the session:

- Segment S1: initial constraints and description (`u1`).
- Segment S2: assistant’s refactor proposal (`a1`).
- Segment S3: user rejection and tightened constraints (`u2`).
- Segment S4: `git_diff` tool output (`t1`).
- Segment S5: test logs (`t2`).
- Segment S6: assistant acknowledgment (`a2`).

Per-segment compaction plan:

- S1, S3:
    - Strategy: keep key constraint sentences verbatim; lightly summarize rest.
    - Rationale: constraints critical for next action; exactness required for some.
- S2:
    - Strategy: summarize as “large refactor with `Paginator` class was proposed and rejected.”
    - Rationale: important to know the rejected approach but not keep every line.
- S4:
    - Strategy: externalize full diff to archive; keep only file path and function location plus a short summary in runtime context.
- S5:
    - Strategy: keep exact failing assertion line and test name (`f5`); externalize full logs.
- S6:
    - Strategy: maybe drop or summarize; not critical.

Result:

- **CSR:** ~1.0 (all facts either inline or explicit in externalized segments).
- **EX:** close to 1.0 because exact error message, file path, and “no new deps” are intact.
- **RR:** high because archived logs/diffs allow retrieval if needed.
- **DTS:** near-oracle; agent has exactly what it needs to craft the minimal patch.
- **TR:** solid (e.g., 40–60% reduction).
- **PI:** high because the plan lists each segment, strategy, and rationale.
- **H:** low; compaction largely copies or minimally summarizes existing text with little room to invent facts.
- **IC:** lower than baselines; noise from `git_diff` and logs is mostly externalized or summarized.

This gives Orchestrator a noticeably higher ACCS than last‑N, truncation, or generic summaries, while still achieving meaningful token savings.

***

## F. Recommended metric names

Five candidate names:

1. **Agent Continuity under Compaction (ACCS)** – emphasizes agent trajectory continuity and compaction.
2. **Critical State Preservation Score (CSPS)** – highlights preservation of key state.
3. **Compacted Agent Fidelity Metric (CAFM)** – stresses fidelity of the agent state after compaction.
4. **Context Survival under Compression (CSC) Score** – similar to “Context Survival Score” but explicit about compression.
5. **Trajectory-Aware Compaction Utility (TACU)** – foregrounds long-horizon trajectories and utility.

Given your emphasis on “not just summarization quality but preserving what the next agent turn needs while shrinking the rest,” **Agent Continuity under Compaction (ACCS)** is my strongest recommendation: it reads serious and directly encodes the product claim.

***

## G. Practical implementation plan for the repo

Assuming a TypeScript project with SDK, CLI, HTTP API, SQLite, and web UI:

### 1. Files and directories to add

- `examples/evals/`
    - `coding-session-001.json` (the example above).
    - `customer-support-session-001.json` (adapt existing example).
- `src/eval/`:
    - `types.ts` – shared types for `Fixture`, `Fact`, `EvalRun`, `MetricWeights`.
    - `metrics.ts` – implementations of CSR, EX, DTS (wrapper), RR, PI, TR, H, IC and ACCS composition.
    - `strategies.ts` – baseline strategy wrappers (last‑N, truncation, summary, rolling).
    - `runner.ts` – orchestrates loading fixtures, running strategies, computing metrics, persisting to SQLite.
    - `hallucination.ts` – pluggable interface for hallucination detection (start with an LLM call or simple heuristic).
    - `retrieval.ts` – helper to build and query an in-memory/vector-index from archived segments (can initially be naive).
- `src/cli/`:
    - `eval-command.ts` – registers `co eval` / `orchestrator eval`.


### 2. Data schema (SQLite)

Add tables:

- `eval_fixtures`:
    - `id` (text, PK),
    - `domain` (text),
    - `path` (text),
    - `description` (text).
- `eval_runs`:
    - `id` (PK),
    - `fixture_id` (FK),
    - `strategy` (text),
    - `seed` (int),
    - `metrics_json` (JSON) – to keep schema flexible,
    - `tokens_original` (int),
    - `tokens_runtime` (int),
    - `tokens_archived` (int),
    - `created_at` (timestamp).
- Optional `eval_aggregates`:
    - fixture + strategy + aggregated stats (mean, stdev).

You already have persistence, so these can plug into the existing SQLite layer.

### 3. CLI scripts / commands

- `co eval <fixture>`:
    - Options: `--strategies`, `--seeds`, `--weights-preset`, `--dump-json`.
    - Prints per-strategy breakdown and ACCS.
- `co eval list`:
    - Shows available fixtures and last run stats.
- `co eval show <runId>`:
    - Shows detailed metrics and references to saved compaction plans and contexts (if you log them).


### 4. Web UI integration

- New “Evaluation” section:
    - Fixture picker (coding, support, voice).
    - Strategy selector.
    - “Run eval” button that calls the HTTP API endpoint (e.g., `POST /eval/run`).
    - Results view:
        - Table of metrics.
        - Bar chart of ACCS per strategy.
        - Link to “inspect plan” that shows:
            - runtime context,
            - compaction plan segments and rationales,
            - archived segments for retrieval.


### 5. Minimum viable version in one day

In one focused day, a realistic minimal version:

- Implement:
    - fixtures for at least 1 coding and 1 support session.
    - CSR, EX, TR, IC (using explicit labels).
    - DTS via an external script for coding (run tests) and a simplistic equality check for support.
    - Simple RR (exact-match retrieval) using an in-memory index.
    - PI as a structural metric (only for Orchestrator).
    - A naive H (e.g., 0 for all strategies or a simple check that no tokens exist outside source, without deep QAG).
- Add `co eval` CLI that:
    - runs strategies,
    - computes metrics,
    - prints ACCS and breakdown,
    - logs runs in SQLite.
- In the UI:
    - Add a basic page to display last results (no complex charts yet).

You can iterate later to:

- plug in a more robust hallucination detector based on QAG or RAGAS-style faithfulness,[^27][^8]
- refine retrieval (vector index, semantic matching),
- expand fixtures and domains (voice, multi-session agents),
- support configurable weights and per-domain presets.

***

### Why ACCS fits Compaction Orchestrator

Existing work on summarization, long-context benchmarks, and agent memory either ignores compaction policy or evaluates model/agent performance without explicitly scoring **what gets kept vs compressed vs externalized**, and how that affects **next-turn agent behavior**.[^18][^16][^19][^21][^9][^15][^17]

ACCS is explicitly:

- **Critical-state-centric** (CSR, EX, RR),
- **Agent-continuity-centric** (DTS, IC),
- **Compaction-aware** (TR, PI),
- **Safety-aware** (H, EX for policies and errors),

and directly compares Compaction Orchestrator against **generic strategies** (summary, last‑N, truncation, rolling) on exactly the claim you care about:

> *We preserve what the next agent turn needs while shrinking the rest.*

That makes ACCS a defensible, product-aligned metric rather than just another “summary quality” score.
<span style="display:none">[^29][^30]</span>

<div align="center">⁂</div>

[^1]: https://developers.openai.com/cookbook/examples/evaluation/how_to_eval_abstractive_summarization

[^2]: https://arxiv.org/pdf/2210.16732.pdf

[^3]: https://acl-bg.org/proceedings/2025/R2LM 2025/pdf/2025.r2lm-1.9.pdf

[^4]: https://oulurepo.oulu.fi/handle/10024/56413

[^5]: https://digitalcommons.calpoly.edu/cgi/viewcontent.cgi?article=4076\&context=theses

[^6]: https://aclanthology.org/2024.naacl-long.251.pdf

[^7]: https://arxiv.org/abs/2402.13249

[^8]: https://www.nature.com/articles/s41598-025-31075-1

[^9]: https://huggingface.co/papers/2404.06654

[^10]: https://llm-stats.com/benchmarks/ruler

[^11]: https://www.themoonlight.io/en/review/ruler-whats-the-real-context-size-of-your-long-context-language-models

[^12]: https://evalscope.readthedocs.io/en/latest/benchmarks/longbench_v2.html

[^13]: https://aclanthology.org/2024.acl-long.172.pdf

[^14]: https://github.com/THUDM/LongBench/blob/main/LongBench/README.md

[^15]: https://arxiv.org/html/2605.20833

[^16]: https://arxiv.org/abs/2605.20833

[^17]: https://openreview.net/pdf/5705a80026ee66192e9c660b3ecb2c73254e4707.pdf

[^18]: https://arxiv.org/abs/2602.22769

[^19]: https://huggingface.co/papers/2605.29341

[^20]: https://www.wispaper.ai/en/blog/amemgym-interactive-memory-benchmarking-assistants-long-horizon-conversations-20260305/eng

[^21]: https://iclr.cc/virtual/2026/poster/10007039

[^22]: https://redis.io/blog/rag-metrics/

[^23]: https://apxml.com/courses/getting-started-rag/chapter-6-evaluating-improving-rag-systems/evaluating-retrieval

[^24]: https://galileo.ai/blog/rag-evaluation-techniques-metrics-optimization

[^25]: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/

[^26]: https://medium.com/data-science/evaluating-rag-applications-with-ragas-81d67b0ee31a

[^27]: https://arxiv.org/abs/2309.15217

[^28]: https://openreview.net/attachment?id=jJ6F1sDn9i\&name=pdf

[^29]: https://dkaarthick.medium.com/ragas-for-rag-in-llms-a-comprehensive-guide-to-evaluation-metrics-3aca142d6e38

[^30]: https://www.pinecone.io/learn/series/vector-databases-in-production-for-busy-engineers/rag-evaluation/

