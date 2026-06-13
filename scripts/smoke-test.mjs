const baseUrl = process.env.API_URL ?? "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
  }

  return body;
}

const session = await request("/v1/sessions", {
  method: "POST",
  body: JSON.stringify({
    name: "smoke-coding-session",
    metadata: { demo: true }
  })
});

await request(`/v1/sessions/${session.session.id}/events`, {
  method: "POST",
  body: JSON.stringify({
    role: "user",
    type: "message",
    content: "Use Hono. Preserve this instruction exactly. Do not add Express.",
    metadata: { source: "smoke" }
  })
});

await request(`/v1/sessions/${session.session.id}/events`, {
  method: "POST",
  body: JSON.stringify({
    role: "tool",
    type: "tool_output",
    content: "npm test failed\nError: Cannot find module './router'\n    at src/index.ts:8:15\nLots of repeated log output\nLots of repeated log output",
    metadata: { command: "npm test", artifacts: ["src/index.ts"] }
  })
});

const compacted = await request(`/v1/sessions/${session.session.id}/compact`, {
  method: "POST",
  body: JSON.stringify({
    objective: "Continue implementing the API",
    desiredBudget: 500,
    policy: {
      mode: "balanced",
      preserveActiveErrorsVerbatim: false
    }
  })
});

console.log(JSON.stringify({
  sessionId: session.session.id,
  contextViewId: compacted.contextView.id,
  segments: compacted.plan.segments.length,
  operations: compacted.plan.segments.map((segment) => segment.operation),
  tokenEstimate: compacted.contextView.tokenEstimate
}, null, 2));
