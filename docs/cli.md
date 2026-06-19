# CLI Quickstart

The package includes a small CLI for trying compaction without writing code or starting the API server.

From this repo:

```bash
npm install
npm run demo:cli
```

After publishing, the intended `npx` shape is:

```bash
npx @compaction-orchestrator/core examples/coding-agent-session.json
```

The CLI accepts the same fixture shape used by the SDK demos:

```json
{
  "name": "coding-agent-router-debug-demo",
  "objective": "Prepare compact context for the next coding-agent turn.",
  "useCase": "generic",
  "events": [
    {
      "role": "user",
      "content": "Use Hono only. Do not add Express."
    }
  ]
}
```

You can also pipe JSON through stdin:

```bash
cat examples/customer-support-session.json | node packages/core/dist/cli.js
```

Output is JSON with:

- `operations`
- `metrics`
- `contextView`
- `contextPackage` for customer-support fixtures

Run the CLI smoke test before changing the bin or output shape:

```bash
npm run test:cli
```
