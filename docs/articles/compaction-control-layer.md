# your agent does not need one summary. it needs a compaction plan.

a friend asked me the right question:

> if i am a developer and the default context handling works, why should i care about your compactor?

that question is more useful than a compliment.

my answer: "vendor locked" is not enough.

most developers do not care that the default compaction is vendor owned if it keeps their agent working. they should not care. tools earn attention when they expose a problem people have already felt or are about to feel.

the problem is not that default compaction exists somewhere else.

the problem is that compaction becomes part of agent correctness, and most teams still treat it like cleanup.

![compaction plan hero](../images/article-hero.png)

repo: [github.com/anshulluhsna/compaction-orchestrator](https://github.com/anshulluhsna/compaction-orchestrator)

## the problem is still under-named

if this problem were obvious, there would already be a crowded market of compaction tools.

there is not.

that does not mean the problem is fake. it means most teams only notice it after their agent starts running long enough to forget the wrong thing.

in finished products like chatgpt, cursor, claude code, or other agent harnesses, context management is part of the product experience. you may never see the compaction step.

but when you build a custom agent, you usually own the model-call boundary. you decide what messages, tool outputs, summaries, cached state, and retrieved facts go into the next call.

so teams build their own version of compaction anyway:

- keep the last few messages
- summarize older turns
- pin system instructions
- trim tool outputs
- store large artifacts elsewhere
- hand-roll special rules for support, coding, voice, or internal workflows

compaction orchestrator is a name and interface for that layer.

## the hidden job of compaction

long-running agents eventually collect too much context: chat history, tool output, failed tool calls, partial decisions, old plans, user constraints, policy rules, api responses, error traces, and next actions.

the obvious move is to summarize.

that works until the summary preserves the story and loses the state.

"the customer had a billing issue" sounds reasonable. it is also useless if the next turn needs the duplicate invoice ids, the refund threshold, the entitlement error, and the exact promise the agent is allowed to make.

"the build failed" sounds reasonable. it is also useless if the next turn needs the missing module path and the exact exported member that failed.

"the caller wants to change an appointment" sounds reasonable. it is dangerous if the agent forgets that the caller said do not cancel, only reschedule.

this is the difference:

```text
summary asks: what happened?
compaction asks: what must survive for the next turn to work?
```

that is why one summary is the wrong primitive.

## why default is not the enemy

default compaction can be perfectly fine for general chat, coding products, or casual long conversations.

the issue starts when you are building a custom agent and you control the model-call boundary. at that point, context is no longer just text. it is runtime state.

a customer-support agent has operational state.

a voice agent has latency pressure, tool noise, slot values, and consent state.

a coding agent has exact errors, file paths, rejected approaches, and user constraints.

those are different failure modes.

if a default compactor hides the decision, you cannot inspect why something survived, why something was rewritten, or why the next turn went wrong. if you write your own one-off rules, you still end up admitting the same thing: compaction needs a control layer.

that is the space compaction orchestrator is trying to occupy.

not "better summaries."

control over what kind of context survives.

## the philosophical shift

an agent session is not one document.

it is a working state made of different materials.

some context should stay verbatim. some should be reduced to an active error. some should be summarized. some should be moved out of the runtime window but remain retrievable. some should be masked. some should not survive at all.

![flattened context vs preserved compaction layers](../images/slab-vs-stack.png)

compaction orchestrator turns that into a plan:

```text
raw session events
-> segment classification
-> per-segment strategy routing
-> runtime context view
-> inspectable compaction plan
```

one turn can mix strategies:

```text
user constraint      -> keep_verbatim
active failure       -> extract_active_error
large tool output    -> externalize_for_retrieval
completed work       -> structured_summary
support handoff      -> preserve policy, escalation, next action
voice turn           -> preserve intent, consent, slot, latency target
```

the important part is not that these strategy names are magical. they are deliberately plain.

the important part is that the decision is visible.

you can inspect the plan. you can compare it to baselines. you can add your own strategy. you can test whether the next agent turn still has the facts it needs.

## the customer-support example

customer support is the easiest place to feel the problem.

a generic summary might say:

```text
the customer has a duplicate billing issue and needs help with entitlement.
```

that reads fine.

but the agent may need:

```text
customer: maya chen
account: acct_7921
duplicate invoices: inv_001921 and inv_001922
refund policy: refund allowed only after duplicate charge verification
active error: entitlement service returned entitlement_sync_failed
next action: explain escalation, do not promise instant refund
```

if the summary drops one of those, the next turn can sound confident and still be wrong.

this is why "summary quality" is too soft as an evaluation target. a compaction system should be judged by continuity:

```text
can the next agent turn continue correctly after compaction?
```

that is what the repo's evaluation metric, agent continuity under compaction, is built around.

## the voice-agent example

at first glance, voice agents look like they should need less compaction. the turns are short. the agent needs to be fast.

but real voice agents are not just back-and-forth chat.

they book appointments. cancel appointments. call tools. recover from bad tool calls. handle asr noise. keep latency low. carry slot values across turns.

and sometimes old tool output is still useful.

if the agent looked up available appointment slots, throwing away the tool output blindly can hurt the next turn. keeping the whole thing can also hurt the next turn because voice agents have tight latency budgets.

so the decision is runtime specific:

```text
asr noise                  -> remove or summarize
selected slot              -> keep exactly
consent state              -> keep exactly
full scheduler response    -> externalize
next spoken prompt         -> keep lean
latency target             -> preserve as constraint
```

that is hard to express as one universal compaction rule.

## the coding-agent example

coding agents expose a different failure mode.

they often do not need a beautiful summary. they need exact strings.

the next turn may depend on a file path, a route name, a test command, a type error, or a user constraint like "use this framework, do not add a different one."

if those get paraphrased, the model may still understand the rough task but lose the thing that would have made the next action correct.

that is why the orchestrator can route active build failures differently from old exploration notes.

different context. different survival rule.

## the evidence so far

the repo currently compares these candidates:

- `raw_full_context`
- `last_n_messages`
- `recent_token_window`
- `front_truncation`
- `generic_summary`
- `rolling_summary_recent`
- `compaction_orchestrator`

agent continuity under compaction rewards critical fact recall, exactness, downstream readiness, recoverability, inspectability, and token reduction. it penalizes hallucinated or irrelevant retained context.

current deterministic results:

| fixture | generic summary accs | rolling_summary_recent accs | compaction_orchestrator accs | read |
| --- | ---: | ---: | ---: | --- |
| coding agent | 0.548 | 0.698 | 0.836 | rolling summary preserves facts, but uses more context and has no plan |
| customer support | 0.410 | 0.474 | 0.773 | rolling summary still misses duplicate invoice state |
| voice agent | 0.430 | 0.767 | 0.886 | rolling summary preserves facts, but saves fewer tokens and has no plan |

the support fixture also has a live deepseek probe:

| fixture | generic summary | compaction orchestrator | read |
| --- | ---: | ---: | --- |
| customer support | 5/6 fact recall | 6/6 fact recall | orchestrator preserved the duplicate invoice pair |
| coding agent | 5/5 fact recall | 5/5 fact recall | both answered, but only one had an inspectable plan |

this is not meant to claim that generic summaries are always bad.

that would be too convenient.

the stronger claim is narrower: when compaction affects correctness, you need to know what the compactor did and why.

sometimes the win is recall.

sometimes the win is control.

## who this is for

this is not for someone using chatgpt as a product.

it is not trying to replace the memory behavior inside cursor, claude code, or any other finished agent product.

compaction orchestrator is for builders who own the context they send into the model:

- custom support agents
- voice agents
- coding-agent harnesses
- internal workflow agents
- agent platforms that need different compaction policies per customer or use case

if your agent only has short conversations, you probably do not need this.

if forgetting the wrong detail costs money, trust, latency, or correctness, compaction should not be invisible.

## what the repo gives you

the repo is the implementation layer:

- sdk for agent loops
- cli for json fixtures
- http api for sidecar use
- sqlite persistence for sessions, events, plans, context views, and externalized content
- web ui for demos and inspection
- coding, support, and voice fixtures
- accs evaluation scripts
- optional live deepseek probe

the readme has the setup commands, sdk snippets, and demo instructions.

the article only needs one invitation:

try it against your own agent session.

add the facts your next turn must preserve. run your usual compaction strategy. run the orchestrated plan. see which one lets the next turn continue correctly.

that is the point.

not one more summary.

a compaction plan.

![compaction orchestrator ui](../images/ui.png)
