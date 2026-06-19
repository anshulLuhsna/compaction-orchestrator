import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const { stdout: codingStdout } = await execFileAsync("node", [
  "packages/core/dist/cli.js",
  "examples/coding-agent-session.json"
]);
const coding = JSON.parse(codingStdout);

assert.equal(coding.useCase, "generic");
assert.match(coding.contextView.content, /Use Hono only/);
assert.match(coding.contextView.content, /Cannot find module '.\/billing-store.js'/);
assert.ok(coding.contextView.externalReferences.length >= 1);
assert.ok(coding.operations.some((operation) => operation.operation === "extract_active_error"));

const { stdout: supportStdout } = await execFileAsync("node", [
  "packages/core/dist/cli.js",
  "examples/customer-support-session.json"
]);
const support = JSON.parse(supportStdout);

assert.equal(support.useCase, "customer_support");
assert.equal(support.contextPackage.customer.name, "Maya Chen");
assert.equal(support.contextPackage.escalation.targetTeam, "Billing Ops");
assert.ok(support.operations.some((operation) => operation.operation === "externalize_for_retrieval"));

console.log(JSON.stringify({
  ok: true,
  codingOperations: coding.operations.map((operation) => operation.operation),
  supportPackageId: support.contextPackage.id
}, null, 2));
