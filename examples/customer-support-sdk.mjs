import { readFile } from "node:fs/promises";
import { compactCustomerSupport } from "../packages/core/dist/index.js";

const fixturePath = process.argv[2] ?? "examples/customer-support-session.json";
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

const result = compactCustomerSupport({
  messages: fixture.events,
  objective: fixture.objective,
  desiredBudget: fixture.desiredBudget,
  policy: fixture.policy,
  sessionName: fixture.name
});

const contextPackage = result.contextPackage;

console.log(JSON.stringify({
  packageId: contextPackage.id,
  issue: contextPackage.issue,
  escalation: contextPackage.escalation,
  preservedFacts: {
    customer: contextPackage.customer,
    policyConstraints: contextPackage.policyConstraints,
    decisions: contextPackage.decisions,
    nextActions: contextPackage.nextActions
  },
  operations: contextPackage.compactionPlan.segments.map((segment) => ({
    semanticType: segment.semanticType,
    operation: segment.operation,
    risk: segment.estimate.preservationRisk
  })),
  metrics: contextPackage.metrics
}, null, 2));
