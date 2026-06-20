import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateCompactionFixture } from "../packages/core/dist/index.js";

const fixturePaths = [
  "examples/coding-agent-session.json",
  "examples/customer-support-session.json",
  "examples/voice-agent-session.json"
];

for (const path of fixturePaths) {
  const fixture = JSON.parse(await readFile(path, "utf8"));
  const comparison = evaluateCompactionFixture(fixture);
  const orchestrator = resultFor(comparison, "compaction_orchestrator");
  const generic = resultFor(comparison, "generic_summary");
  const lastN = resultFor(comparison, "last_n_messages");
  const truncation = resultFor(comparison, "front_truncation");

  assert.equal(comparison.winner, "compaction_orchestrator", `${fixture.name}: orchestrator should win ACCS`);
  assert.ok(orchestrator.breakdown.accs > generic.breakdown.accs, `${fixture.name}: orchestrator should beat generic summary`);
  assert.ok(orchestrator.breakdown.accs > lastN.breakdown.accs, `${fixture.name}: orchestrator should beat last-N`);
  assert.ok(orchestrator.breakdown.accs > truncation.breakdown.accs, `${fixture.name}: orchestrator should beat truncation`);
  assert.equal(orchestrator.facts.filter((fact) => !fact.passedWithRecovery).length, 0, `${fixture.name}: orchestrator should preserve/recover all facts`);
}

console.log(JSON.stringify({
  ok: true,
  metric: "Agent Continuity under Compaction",
  fixtures: fixturePaths
}, null, 2));

function resultFor(comparison, candidate) {
  const result = comparison.results.find((item) => item.candidate === candidate);
  assert.ok(result, `Missing ${candidate}`);
  return result;
}
