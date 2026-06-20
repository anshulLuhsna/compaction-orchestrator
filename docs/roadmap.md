# Roadmap

## Where We Are

The repo has a working API-first V0 with SQLite persistence and deterministic compaction strategies.

Verified commands:

```bash
npm run typecheck
npm run build:web
npm run test:accs
npm run eval:accs
```

## Recommended Next Sequence

### 1. Improve Segment Classification

Goal: make routing more reliable.

Tasks:

- Split long events into multiple segments
- Improve artifact extraction
- Add explicit status handling for resolved/superseded content
- Add `decision`, `constraint`, and `active_task_state` extractors

### 2. Improve Externalized Retrieval

Goal: make `externalize_for_retrieval` real.

Tasks:

- Add a retrieval endpoint by query
- Add search over externalized content
- Later add embeddings

### 3. Expand Realistic Evaluation Fixtures

Goal: make the project harder to fool.

Tasks:

- Add more real or realistic traces beyond the current coding, support, and voice fixtures
- Add contradicted, superseded, stale, and paraphrased facts
- Add model-executed next-turn continuation tests
- Add retrieval baselines that do not know the expected facts ahead of time
- Keep comparing against `rolling_summary_recent` and `recent_token_window`

### 4. Add LLM Planner

Goal: move beyond deterministic routing.

Tasks:

- Add optional model adapter interface
- Generate richer segment labels
- Generate context-specific human questions
- Add unsupported-claim validation

### 5. Build Minimal Dashboard

Goal: visualize what disappeared and why.

Views:

- Event log
- Segment list
- Strategy plan
- Runtime context
- Externalized references
- Warnings

## Strong Recommendation

Proceed in this order:

```text
better segmentation
-> externalized retrieval
-> stronger evaluation fixtures
-> LLM planner
-> dashboard
```

This keeps the project grounded in infrastructure before storytelling polish.
