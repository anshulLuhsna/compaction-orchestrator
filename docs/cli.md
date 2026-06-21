# CLI Quickstart

The package includes a small CLI for trying compaction without writing code or starting the API server.

From this repo:

```bash
npm install
npm run demo:cli
```

After publishing, the intended `npx` shape is:

```bash
npx @anshulluhsna/compaction-orchestrator examples/coding-agent-session.json
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

## Import Claude Code Sessions

Claude Code stores local conversation transcripts as JSONL under:

```text
~/.claude/projects/<project-slug>/<session-id>.jsonl
```

Convert one of those sessions into a Compaction Orchestrator fixture:

```bash
node packages/core/dist/cli.js import claude ~/.claude/projects/<project-slug>/<session-id>.jsonl \
  --out examples/my-claude-session.json
```

Then open the web UI and use **Import JSON** to test that session.

Useful options:

- `--name "my-session"` changes the fixture name.
- `--objective "prepare context for the next coding-agent turn"` changes the compaction objective.
- `--desired-budget 1200` changes the runtime context budget.
- `--max-tool-output-chars 12000` limits very large Claude tool results.

The importer preserves user messages, assistant messages, tool calls, tool outputs, source session id, cwd, git branch, timestamps, and Claude UUIDs where available. It leaves `expectedFacts` empty because only you know which facts the next turn must preserve. Add those later if you want meaningful evaluation scores.

Output is JSON with:

- `operations`
- `metrics`
- `contextView`
- `contextPackage` for customer-support fixtures

Run the CLI smoke test before changing the bin or output shape:

```bash
npm run test:cli
```
