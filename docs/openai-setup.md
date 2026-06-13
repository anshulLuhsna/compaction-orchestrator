# OpenAI Setup

This project can already run actual sessions without OpenAI. OpenAI is currently wired as a connectivity layer so we can safely verify credentials before using models in the compaction planner.

## 1. Create `.env`

```bash
cp .env.example .env
```

Set:

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5.5
```

`.env` is ignored by git.

## 2. Start The API

```bash
npm run dev
```

The API runs at:

```text
http://localhost:3000
```

## 3. Check Whether OpenAI Is Configured

```bash
curl -s http://localhost:3000/v1/openai/status
```

Without a key:

```json
{
  "configured": false,
  "model": "gpt-5.5"
}
```

With a key:

```json
{
  "configured": true,
  "model": "gpt-5.5"
}
```

## 4. Run A Live OpenAI Smoke Test

```bash
npm run openai:check
```

Or:

```bash
curl -s -X POST http://localhost:3000/v1/openai/test
```

Expected successful shape:

```json
{
  "ok": true,
  "model": "gpt-5.5",
  "output": "OpenAI setup ok"
}
```

## 5. Run An Actual Compaction Session

Create a session:

```bash
curl -s http://localhost:3000/v1/sessions \
  -H 'content-type: application/json' \
  -d '{"name":"real-session"}'
```

Append events:

```bash
curl -s http://localhost:3000/v1/sessions/:session_id/events \
  -H 'content-type: application/json' \
  -d '{
    "role": "user",
    "type": "message",
    "content": "Preserve this exact instruction. Use Hono, not Express.",
    "metadata": {}
  }'
```

Compact:

```bash
curl -s http://localhost:3000/v1/sessions/:session_id/compact \
  -H 'content-type: application/json' \
  -d '{
    "objective": "Continue the implementation safely",
    "desiredBudget": 8000,
    "policy": {
      "mode": "balanced",
      "preserveActiveErrorsVerbatim": false
    }
  }'
```

Fetch the latest context view:

```bash
curl -s http://localhost:3000/v1/sessions/:session_id/context
```

## How OpenAI Will Be Used Next

Current compaction is deterministic.

Next model-backed additions:

1. `llm_structured_summary`
2. `llm_segment_classifier`
3. `llm_strategy_planner`
4. unsupported-claim validation
5. human question generation for risky compactions

The deterministic picker should remain the safety baseline. OpenAI should enrich classification and summaries, not override hard preservation rules for user instructions.
