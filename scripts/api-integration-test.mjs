import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.TEST_API_PORT ?? 3130);
const apiUrl = `http://localhost:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), "compaction-orchestrator-api-"));
const databaseUrl = join(dataDir, "test.sqlite");

const server = spawn("node", ["apps/api/dist/index.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: databaseUrl
  },
  stdio: ["ignore", "pipe", "pipe"]
});

const logs = [];
server.stdout.on("data", (chunk) => logs.push(chunk.toString()));
server.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  await waitForHealth(apiUrl);
  await run("node", ["scripts/oneshot-compact-test.mjs"], { API_URL: apiUrl });
  await run("node", ["scripts/smoke-test.mjs"], { API_URL: apiUrl });
  await run("node", ["scripts/customer-support-e2e.mjs"], { API_URL: apiUrl });
  await run("node", ["scripts/evaluate-customer-support.mjs"], { API_URL: apiUrl });

  console.log(JSON.stringify({
    ok: true,
    apiUrl,
    databaseUrl,
    checks: ["oneshot", "smoke", "support-demo", "support-eval"]
  }, null, 2));
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1000);
    server.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  await rm(dataDir, { recursive: true, force: true });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 10000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`API did not become healthy: ${lastError?.message ?? "unknown"}\n${logs.join("")}`);
}

function run(command, args, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      if (code === 0) {
        process.stdout.write(stdout);
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${code}\n${stdout}\n${stderr}\nAPI logs:\n${logs.join("")}`));
      }
    });
  });
}
