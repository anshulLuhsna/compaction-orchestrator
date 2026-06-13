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
    name: "persistence-externalization-session",
    metadata: { demo: true, kind: "persistence" }
  })
});

const largeOutput = Array.from({ length: 120 }, (_, index) => {
  return `Line ${index + 1}: repository scan output mentions packages/core/src/strategies.ts and old implementation detail.`;
}).join("\n");

await request(`/v1/sessions/${session.session.id}/events`, {
  method: "POST",
  body: JSON.stringify({
    role: "tool",
    type: "tool_output",
    content: largeOutput,
    metadata: {
      command: "rg --files",
      artifacts: ["packages/core/src/strategies.ts"]
    }
  })
});

const compacted = await request(`/v1/sessions/${session.session.id}/compact`, {
  method: "POST",
  body: JSON.stringify({
    objective: "Verify externalized content can be recovered",
    desiredBudget: 200,
    policy: {
      mode: "balanced",
      allowExternalRetrieval: true
    }
  })
});

const externalizedList = await request(`/v1/sessions/${session.session.id}/externalized`);
const first = externalizedList.externalized[0];
if (!first) {
  throw new Error("Expected at least one externalized item");
}

const externalized = await request(`/v1/sessions/${session.session.id}/externalized/${first.segmentId}`);

console.log(JSON.stringify({
  sessionId: session.session.id,
  contextViewId: compacted.contextView.id,
  operations: compacted.plan.segments.map((segment) => segment.operation),
  externalizedCount: externalizedList.externalized.length,
  recoveredContentLength: externalized.externalized.content.length
}, null, 2));
