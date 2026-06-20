import { readFile } from "node:fs/promises";
import { evaluateCompactionFixture } from "../packages/core/dist/index.js";

const fixturePaths = process.argv.slice(2);
const paths = fixturePaths.length > 0
  ? fixturePaths
  : [
    "examples/coding-agent-session.json",
    "examples/customer-support-session.json",
    "examples/voice-agent-session.json"
  ];

const comparisons = [];
for (const path of paths) {
  const fixture = JSON.parse(await readFile(path, "utf8"));
  comparisons.push(evaluateCompactionFixture(fixture));
}

for (const comparison of comparisons) {
  printComparison(comparison);
}

const summary = comparisons.map((comparison) => ({
  fixture: comparison.fixture,
  winner: comparison.winner,
  rawTokenEstimate: comparison.rawTokenEstimate,
  results: comparison.results.map((result) => ({
    candidate: result.candidate,
    accs: result.breakdown.accs,
    criticalStateRecall: result.breakdown.criticalStateRecall,
    exactnessPreservation: result.breakdown.exactnessPreservation,
    downstreamReadiness: result.breakdown.downstreamReadiness,
    retrievalRecoverability: result.breakdown.retrievalRecoverability,
    planInspectability: result.breakdown.planInspectability,
    tokenReduction: result.breakdown.tokenReduction,
    tokenReductionPercent: result.tokenReductionPercent,
    missedFacts: result.facts
      .filter((fact) => !fact.passedWithRecovery)
      .map((fact) => fact.id),
    operations: result.operations
  }))
}));

console.log("\nJSON summary:");
console.log(JSON.stringify({ metric: "Agent Continuity under Compaction", comparisons: summary }, null, 2));

function printComparison(comparison) {
  console.log(`\n${comparison.fixture}`);
  console.log(`Raw token estimate: ${comparison.rawTokenEstimate}`);
  console.log(`Winner: ${comparison.winner}`);
  console.log("");
  console.table(comparison.results.map((result) => ({
    candidate: result.candidate,
    ACCS: result.breakdown.accs,
    CSR: result.breakdown.criticalStateRecall,
    EX: result.breakdown.exactnessPreservation,
    DTS: result.breakdown.downstreamReadiness,
    RR: result.breakdown.retrievalRecoverability,
    PI: result.breakdown.planInspectability,
    TR: result.breakdown.tokenReduction,
    "TR%": result.tokenReductionPercent,
    missed: result.facts.filter((fact) => !fact.passedWithRecovery).map((fact) => fact.id).join(", ") || "-"
  })));

  const orchestrator = comparison.results.find((result) => result.candidate === "compaction_orchestrator");
  if (orchestrator) {
    console.log("Orchestrator operations:");
    console.log(orchestrator.operations.join(" -> "));
  }
}
