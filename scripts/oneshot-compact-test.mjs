import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const fixturePath = process.argv[2] ?? "examples/coding-agent-session.json";
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const supportFixture = JSON.parse(await readFile("examples/customer-support-session.json", "utf8"));

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

const output = await request("/v1/compact", {
  method: "POST",
  body: JSON.stringify({
    sessionName: fixture.name,
    messages: fixture.events,
    objective: fixture.objective,
    desiredBudget: fixture.desiredBudget,
    policy: fixture.policy
  })
});

assert.equal(output.session.id, output.sessionId);
assert.equal(output.plan.sessionId, output.session.id);
assert.equal(output.contextView.sessionId, output.session.id);

const contextText = [
  output.contextView.content,
  output.plan.segments.map((segment) => `${segment.semanticType}: ${segment.operation}. ${segment.reason}`).join("\n")
].join("\n\n");

const facts = fixture.expectedFacts.map((fact) => {
  const foundTerms = fact.requiredTerms.filter((term) => contextText.includes(term));
  return {
    id: fact.id,
    foundTerms,
    passed: foundTerms.length === fact.requiredTerms.length
  };
});

assert.equal(facts.every((fact) => fact.passed), true, JSON.stringify(facts, null, 2));

const latest = await request(`/v1/sessions/${output.session.id}/context`);
const externalized = await request(`/v1/sessions/${output.session.id}/externalized`);

assert.equal(latest.contextView.id, output.contextView.id);
assert.ok(externalized.externalized.length >= 1, "Expected one-shot compaction to persist externalized content.");

const supportOutput = await request("/v1/compact", {
  method: "POST",
  body: JSON.stringify({
    sessionName: supportFixture.name,
    messages: supportFixture.events,
    objective: supportFixture.objective,
    desiredBudget: supportFixture.desiredBudget,
    policy: supportFixture.policy,
    useCase: "customer_support"
  })
});

assert.equal(supportOutput.session.id, supportOutput.sessionId);
assert.equal(supportOutput.contextPackage.customer.name, "Maya Chen");
assert.equal(supportOutput.contextPackage.issue.status, "escalated");
assert.equal(supportOutput.contextPackage.escalation.targetTeam, "Billing Ops");
assert.equal(supportOutput.contextPackage.runtimeContext.id, supportOutput.contextView.id);

console.log(JSON.stringify({
  ok: true,
  sessionId: output.session.id,
  contextViewId: output.contextView.id,
  operations: output.plan.segments.map((segment) => segment.operation),
  facts,
  externalized: externalized.externalized.length,
  supportPackageId: supportOutput.contextPackage.id
}, null, 2));
