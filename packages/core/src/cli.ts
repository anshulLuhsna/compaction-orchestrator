#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { stdin, stdout, stderr } from "node:process";
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

function printHelp() {
  stdout.write(`Compaction Orchestrator CLI

Usage:
  compaction-orchestrator <fixture.json>
  compaction-orchestrator < fixture.json

Input JSON:
  {
    "name": "demo",
    "objective": "Prepare compact context for the next turn.",
    "useCase": "generic" | "customer_support",
    "events": [{ "role": "user", "content": "..." }]
  }

Output:
  JSON summary with operations, metrics, runtime context, and optional contextPackage.
`);
}

main().catch((error) => {
  stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
