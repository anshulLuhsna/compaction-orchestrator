import { readFile } from "node:fs/promises";

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const fixturePath = process.argv[2] ?? "examples/customer-support-session.json";
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

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
    name: fixture.name,
    metadata: {
      useCase: "customer_support",
      fixture: fixturePath
    }
  })
});

for (const event of fixture.events) {
  await request(`/v1/sessions/${session.session.id}/events`, {
    method: "POST",
    body: JSON.stringify(event)
  });
}

const packaged = await request(`/v1/sessions/${session.session.id}/context-package`, {
  method: "POST",
  body: JSON.stringify({
    objective: fixture.objective,
    desiredBudget: fixture.desiredBudget,
    policy: fixture.policy
  })
});

const contextPackage = packaged.contextPackage;
const summary = {
  sessionId: session.session.id,
  packageId: contextPackage.id,
  customer: contextPackage.customer,
  issue: contextPackage.issue,
  escalation: contextPackage.escalation,
  nextActions: contextPackage.nextActions,
  operations: contextPackage.compactionPlan.segments.map((segment) => segment.operation),
  metrics: contextPackage.metrics,
  externalReferences: contextPackage.externalReferences
};

console.log(JSON.stringify(summary, null, 2));
