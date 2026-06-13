# Roadmap

## Where We Are

The repo has a working API-first V0 with SQLite persistence and deterministic compaction strategies.

Verified commands:

```bash
npm run build
npm run typecheck
npm run test:smoke
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

### 3. Add Goldfish vs Elephant Example

Goal: make the project demoable.

Tasks:

- Add example transcript fixture
- Implement generic-summary baseline
- Run adaptive compaction
- Print strategy comparison
- Score recall questions manually at first

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
-> Goldfish vs Elephant
-> LLM planner
-> dashboard
```

This keeps the project grounded in infrastructure before storytelling polish.
