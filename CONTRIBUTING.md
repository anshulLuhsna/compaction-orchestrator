# Contributing

Thanks for helping make Compaction Orchestrator useful for agent builders.

Before opening a larger pull request, please open an issue or discussion with the use case, proposed API shape, and how you will verify the compaction behavior. Small fixes, docs improvements, fixtures, and failing tests are welcome directly.

Run these checks before sending changes:

```bash
npm run typecheck
npm run build
npm run test:api
npm run demo:sdk
```

Good contributions usually include one of:

- A runnable fixture that shows the compaction problem.
- A strategy or policy change with before/after output.
- A docs update that makes integration clearer for a real agent loop.
