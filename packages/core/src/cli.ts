#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { stdin, stdout, stderr } from "node:process";
import { claudeCodeJsonlToFixture, codexJsonlToFixture } from "./importers.js";
import { compact } from "./sdk.js";
import type { CompactInput, CompactMessage } from "./sdk.js";

type Fixture = {
  name?: string;
  objective?: string;
  desiredBudget?: number;
  policy?: CompactInput["policy"];
  useCase?: CompactInput["useCase"];
  events?: CompactMessage[];
  messages?: CompactMessage[];
  metadata?: Record<string, unknown>;
};

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args[0] === "import") {
    await runImport(args.slice(1));
    return;
  }

  const inputPath = args.find((arg) => !arg.startsWith("-"));
  const fixture = await readFixture(inputPath);
  const messages = fixture.messages ?? fixture.events;

  if (!messages?.length) {
    throw new Error("Expected JSON with a non-empty `messages` or `events` array.");
  }

  const output = compact({
    messages,
    objective: fixture.objective,
    desiredBudget: fixture.desiredBudget,
    policy: fixture.policy,
    useCase: fixture.useCase ?? inferUseCase(messages),
    sessionName: fixture.name,
    metadata: fixture.metadata
  });

  const summary = {
    sessionId: output.sessionId,
    contextViewId: output.contextView.id,
    useCase: output.contextPackage?.useCase ?? "generic",
    operations: output.plan.segments.map((segment) => ({
      semanticType: segment.semanticType,
      operation: segment.operation,
      risk: segment.estimate.preservationRisk
    })),
    metrics: output.contextPackage?.metrics ?? {
      contextTokenEstimate: output.contextView.tokenEstimate,
      eventCount: messages.length,
      segmentCount: output.segments.length
    },
    contextView: output.contextView,
    contextPackage: output.contextPackage
  };

  stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function runImport(args: string[]) {
  const source = args[0];
  const inputPath = positionalArgs(args.slice(1))[0];

  if (source !== "claude" && source !== "codex") {
    throw new Error("Unknown import source. Supported sources: claude, codex");
  }

  const outPath = valueAfter(args, "--out");
  const name = valueAfter(args, "--name");
  const objective = valueAfter(args, "--objective");
  const desiredBudget = numberAfter(args, "--desired-budget");
  const maxToolOutputChars = numberAfter(args, "--max-tool-output-chars");
  const text = inputPath ? await readFile(inputPath, "utf8") : await readStdin();
  const fixture = source === "claude" ? claudeCodeJsonlToFixture(text, {
    name,
    sourcePath: inputPath,
    objective,
    desiredBudget,
    maxToolOutputChars
  }) : codexJsonlToFixture(text, {
    name,
    sourcePath: inputPath,
    objective,
    desiredBudget,
    maxToolOutputChars,
    includeDeveloperMessages: args.includes("--include-developer")
  });
  const output = `${JSON.stringify(fixture, null, 2)}\n`;

  if (outPath) {
    await writeFile(outPath, output);
  } else {
    stdout.write(output);
  }
}

async function readFixture(path: string | undefined): Promise<Fixture> {
  const text = path ? await readFile(path, "utf8") : await readStdin();
  return JSON.parse(text) as Fixture;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function inferUseCase(messages: CompactMessage[]): CompactInput["useCase"] {
  return messages.some((message) => message.metadata?.useCase === "customer_support") ? "customer_support" : "generic";
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberAfter(args: string[], flag: string): number | undefined {
  const value = valueAfter(args, flag);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a number after ${flag}.`);
  }

  return parsed;
}

function positionalArgs(args: string[]): string[] {
  const positionals: string[] = [];
  const flagsWithValues = new Set(["--out", "--name", "--objective", "--desired-budget", "--max-tool-output-chars"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (flagsWithValues.has(arg)) {
      index += 1;
      continue;
    }

    if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  return positionals;
}

function printHelp() {
  stdout.write(`Compaction Orchestrator CLI

Usage:
  compaction-orchestrator <fixture.json>
  compaction-orchestrator < fixture.json
  compaction-orchestrator import claude <session.jsonl> [--out fixture.json]
  compaction-orchestrator import codex <rollout.jsonl> [--out fixture.json]

Input JSON:
  {
    "name": "demo",
    "objective": "Prepare compact context for the next turn.",
    "useCase": "generic" | "customer_support",
    "events": [{ "role": "user", "content": "..." }]
  }

Output:
  JSON summary with operations, metrics, runtime context, and optional contextPackage.

Import:
  Convert Claude Code JSONL from ~/.claude/projects or Codex JSONL from ~/.codex/sessions into a fixture.
  Options: --out, --name, --objective, --desired-budget, --max-tool-output-chars, --include-developer.
`);
}

main().catch((error) => {
  stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
