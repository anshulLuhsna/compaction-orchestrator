import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

const tempDir = await mkdtemp(join(tmpdir(), "co-claude-import-"));
const claudeJsonlPath = join(tempDir, "claude-session.jsonl");
const importedFixturePath = join(tempDir, "fixture.json");
await writeFile(claudeJsonlPath, [
  JSON.stringify({
    type: "user",
    uuid: "user-1",
    sessionId: "claude-session-1",
    cwd: "/tmp/project",
    message: {
      role: "user",
      content: "Use Hono only. Do not add Express."
    }
  }),
  JSON.stringify({
    type: "assistant",
    uuid: "assistant-1",
    sessionId: "claude-session-1",
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "I will inspect the current API." },
        { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "apps/api/src/index.ts" } }
      ]
    }
  }),
  JSON.stringify({
    type: "user",
    uuid: "tool-result-1",
    sessionId: "claude-session-1",
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool-1",
          content: "npm run typecheck failed: Cannot find module './billing-store.js'"
        }
      ]
    }
  })
].join("\n"));

await execFileAsync("node", [
  "packages/core/dist/cli.js",
  "import",
  "claude",
  claudeJsonlPath,
  "--out",
  importedFixturePath,
  "--name",
  "imported-claude-session"
]);

const importedFixture = JSON.parse(await readFile(importedFixturePath, "utf8"));
assert.equal(importedFixture.name, "imported-claude-session");
assert.equal(importedFixture.metadata.importer, "claude_code_jsonl");
assert.equal(importedFixture.metadata.sourceSessionId, "claude-session-1");
assert.equal(importedFixture.events.length, 4);
assert.ok(importedFixture.events.some((event) => event.type === "tool_call" && event.metadata.toolName === "Read"));
assert.ok(importedFixture.events.some((event) => event.type === "tool_output" && event.role === "tool"));
assert.match(importedFixture.events.map((event) => event.content).join("\n"), /Use Hono only/);

const codexJsonlPath = join(tempDir, "codex-session.jsonl");
const codexFixturePath = join(tempDir, "codex-fixture.json");
await writeFile(codexJsonlPath, [
  JSON.stringify({
    timestamp: "2026-06-21T00:00:00.000Z",
    type: "session_meta",
    payload: {
      id: "codex-session-1",
      cwd: "/tmp/project",
      originator: "Codex Desktop",
      cli_version: "0.140.0-alpha.19"
    }
  }),
  JSON.stringify({
    timestamp: "2026-06-21T00:00:01.000Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "Fix the billing route. Do not add Express." }]
    }
  }),
  JSON.stringify({
    timestamp: "2026-06-21T00:00:02.000Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "I will inspect the API route." }]
    }
  }),
  JSON.stringify({
    timestamp: "2026-06-21T00:00:03.000Z",
    type: "response_item",
    payload: {
      type: "function_call",
      name: "exec_command",
      arguments: "{\"cmd\":\"npm run typecheck\"}",
      call_id: "call-1"
    }
  }),
  JSON.stringify({
    timestamp: "2026-06-21T00:00:04.000Z",
    type: "response_item",
    payload: {
      type: "function_call_output",
      call_id: "call-1",
      output: "Error: Cannot find module './billing-store.js'"
    }
  })
].join("\n"));

await execFileAsync("node", [
  "packages/core/dist/cli.js",
  "import",
  "codex",
  codexJsonlPath,
  "--out",
  codexFixturePath,
  "--name",
  "imported-codex-session"
]);

const codexFixture = JSON.parse(await readFile(codexFixturePath, "utf8"));
assert.equal(codexFixture.name, "imported-codex-session");
assert.equal(codexFixture.metadata.importer, "codex_jsonl");
assert.equal(codexFixture.metadata.sourceSessionId, "codex-session-1");
assert.equal(codexFixture.events.length, 4);
assert.ok(codexFixture.events.some((event) => event.type === "tool_call" && event.metadata.toolName === "exec_command"));
assert.ok(codexFixture.events.some((event) => event.type === "tool_output" && event.metadata.semanticType === "active_error"));
assert.match(codexFixture.events.map((event) => event.content).join("\n"), /Do not add Express/);

console.log(JSON.stringify({
  ok: true,
  codingOperations: coding.operations.map((operation) => operation.operation),
  supportPackageId: support.contextPackage.id,
  importedClaudeEvents: importedFixture.events.length,
  importedCodexEvents: codexFixture.events.length
}, null, 2));
