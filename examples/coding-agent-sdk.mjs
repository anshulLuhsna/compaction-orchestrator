import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { compact } from "../packages/core/dist/index.js";

const fixturePath = process.argv[2] ?? "examples/coding-agent-session.json";
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

const result = compact({
  messages: fixture.events,
  objective: fixture.objective,
  desiredBudget: fixture.desiredBudget,
  policy: fixture.policy,
  sessionName: fixture.name
});

const contextText = [
  result.contextView.content,
  ...result.plan.segments.map((segment) => segment.reason)
].join("\n\n");

const facts = fixture.expectedFacts.map((fact) => {
  const foundTerms = fact.requiredTerms.filter((term) => contextText.includes(term));
  return {
    id: fact.id,
    expected: fact.expected,
    foundTerms,
    passed: foundTerms.length === fact.requiredTerms.length
  };
});

assert.equal(facts.every((fact) => fact.passed), true, JSON.stringify(facts, null, 2));
assert.ok(result.contextView.externalReferences.length >= 1, "Expected noisy search output to be externalized.");

console.log(JSON.stringify({
  sessionId: result.sessionId,
  contextViewId: result.contextView.id,
  operations: result.plan.segments.map((segment) => ({
    semanticType: segment.semanticType,
    operation: segment.operation,
    reason: segment.reason
  })),
  facts,
  metrics: {
    segmentCount: result.segments.length,
    tokenEstimate: result.contextView.tokenEstimate,
    externalReferences: result.contextView.externalReferences
  }
}, null, 2));
