import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import {
  buildCustomerSupportContextPackage,
  compactSession,
  sessionEventInputSchema
} from "@compaction-orchestrator/core";
import { SqliteStore } from "@compaction-orchestrator/core/store";
import { Hono } from "hono";
import { z } from "zod";
import { config as loadDotenv } from "dotenv";
import { getOpenAIConfig, runOpenAISmokeTest } from "./openai.js";

const envPath = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]
  .find((path) => existsSync(path));
loadDotenv(envPath ? { path: envPath } : undefined);

const app = new Hono();
const store = new SqliteStore(process.env.DATABASE_URL ?? "data/compaction-orchestrator.sqlite");

app.use("*", cors({
  origin(origin) {
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return origin;
    }

    return null;
  },
  allowHeaders: ["content-type"],
  allowMethods: ["GET", "POST", "OPTIONS"]
}));

const createSessionSchema = z.object({
  name: z.string().optional(),
  metadata: z.record(z.unknown()).default({})
});

const compactRequestSchema = z.object({
  objective: z.string().min(1),
  desiredBudget: z.number().int().positive().optional(),
  policy: z.object({
    mode: z.enum(["accuracy_first", "balanced", "cost_first", "long_horizon", "human_controlled"]).optional(),
    preserveUserMessagesVerbatim: z.boolean().optional(),
    preserveActiveErrorsVerbatim: z.boolean().optional(),
    allowExternalRetrieval: z.boolean().optional(),
    allowHandoff: z.boolean().optional(),
    requireApprovalForHighRiskChanges: z.boolean().optional()
  }).default({})
});

const compactMessageSchema = z.object({
  role: z.enum(["user", "assistant", "tool", "system"]),
  type: z.enum(["message", "tool_call", "tool_output", "decision", "artifact", "compaction"]).optional(),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).default({})
});

const oneShotCompactRequestSchema = compactRequestSchema.extend({
  messages: z.array(compactMessageSchema).min(1),
  useCase: z.enum(["generic", "customer_support", "customer-support"]).default("generic"),
  sessionName: z.string().optional(),
  metadata: z.record(z.unknown()).default({})
});

app.get("/health", (context) => {
  return context.json({ ok: true, service: "compaction-orchestrator-api" });
});

app.get("/v1/openai/status", (context) => {
  const config = getOpenAIConfig();
  return context.json({
    configured: config.configured,
    model: config.model
  });
});

app.post("/v1/compact", async (context) => {
  const body = await context.req.json().catch(() => undefined);
  const parsed = oneShotCompactRequestSchema.safeParse(body);
  if (!parsed.success) {
    return context.json({ error: "Invalid one-shot compaction payload", issues: parsed.error.issues }, 400);
  }

  const session = store.createSession({
    name: parsed.data.sessionName ?? "one-shot-compact",
    metadata: {
      ...parsed.data.metadata,
      useCase: parsed.data.useCase,
      source: "one-shot"
    }
  });

  const events = parsed.data.messages.map((message) => store.addEvent(session.id, {
      role: message.role,
      type: message.type ?? (message.role === "tool" ? "tool_output" : "message"),
      content: message.content,
      metadata: {
        ...parsed.data.metadata,
        ...message.metadata,
        ...(parsed.data.useCase === "customer_support" || parsed.data.useCase === "customer-support" ? { useCase: "customer_support" } : {})
      }
    }));

  const isCustomerSupport = parsed.data.useCase === "customer_support" || parsed.data.useCase === "customer-support";
  const persistedOutput = isCustomerSupport
    ? packageOutput(buildCustomerSupportContextPackage({
      sessionId: session.id,
      events,
      objective: parsed.data.objective,
      desiredBudget: parsed.data.desiredBudget,
      policy: parsed.data.policy
    }))
    : compactSession({
      sessionId: session.id,
      events,
      objective: parsed.data.objective,
      desiredBudget: parsed.data.desiredBudget,
      policy: parsed.data.policy
    });

  store.saveCompaction(
    persistedOutput.plan,
    persistedOutput.contextView,
    persistedOutput.segments
  );

  return context.json({
    session,
    sessionId: session.id,
    ...persistedOutput
  });
});

function packageOutput(output: ReturnType<typeof buildCustomerSupportContextPackage>) {
  return {
    sessionId: output.contextPackage.sessionId,
    segments: output.segments,
    plan: output.contextPackage.compactionPlan,
    contextView: output.contextPackage.runtimeContext,
    contextPackage: output.contextPackage
  };
}

app.post("/v1/openai/test", async (context) => {
  const config = getOpenAIConfig();
  if (!config.configured) {
    return context.json({
      error: "OPENAI_API_KEY is not configured",
      hint: "Create .env from .env.example and set OPENAI_API_KEY."
    }, 400);
  }

  try {
    const result = await runOpenAISmokeTest();
    return context.json({ ok: true, ...result });
  } catch (error) {
    return context.json({
      error: "OpenAI smoke test failed",
      message: error instanceof Error ? error.message : String(error)
    }, 502);
  }
});

app.post("/v1/sessions", async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return context.json({ error: "Invalid session payload", issues: parsed.error.issues }, 400);
  }

  const session = store.createSession(parsed.data);
  return context.json({ session }, 201);
});

app.get("/v1/sessions", (context) => {
  return context.json({ sessions: store.listSessions() });
});

app.get("/v1/sessions/:sessionId", (context) => {
  const session = store.getSession(context.req.param("sessionId"));
  if (!session) {
    return context.json({ error: "Session not found" }, 404);
  }

  return context.json({ session });
});

app.post("/v1/sessions/:sessionId/events", async (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const body = await context.req.json().catch(() => undefined);
  const parsed = sessionEventInputSchema.safeParse(body);
  if (!parsed.success) {
    return context.json({ error: "Invalid event payload", issues: parsed.error.issues }, 400);
  }

  const event = store.addEvent(sessionId, parsed.data);
  return context.json({ event }, 201);
});

app.get("/v1/sessions/:sessionId/events", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  return context.json({ events: store.listEvents(sessionId) });
});

app.post("/v1/sessions/:sessionId/compact", async (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const body = await context.req.json().catch(() => undefined);
  const parsed = compactRequestSchema.safeParse(body);
  if (!parsed.success) {
    return context.json({ error: "Invalid compaction payload", issues: parsed.error.issues }, 400);
  }

  const output = compactSession({
    sessionId,
    events: store.listEvents(sessionId),
    objective: parsed.data.objective,
    desiredBudget: parsed.data.desiredBudget,
    policy: parsed.data.policy
  });

  store.saveCompaction(output.plan, output.contextView, output.segments);
  return context.json(output);
});

app.post("/v1/sessions/:sessionId/context-package", async (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const body = await context.req.json().catch(() => undefined);
  const parsed = compactRequestSchema.safeParse(body);
  if (!parsed.success) {
    return context.json({ error: "Invalid context package payload", issues: parsed.error.issues }, 400);
  }

  const output = buildCustomerSupportContextPackage({
    sessionId,
    events: store.listEvents(sessionId),
    objective: parsed.data.objective,
    desiredBudget: parsed.data.desiredBudget,
    policy: parsed.data.policy
  });

  store.saveCompaction(
    output.contextPackage.compactionPlan,
    output.contextPackage.runtimeContext,
    output.segments
  );

  return context.json(output);
});

app.get("/v1/sessions/:sessionId/context", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const latest = store.latestContextView(sessionId);
  if (!latest) {
    return context.json({ error: "No context view exists yet. Call /compact first." }, 404);
  }

  return context.json({ contextView: latest });
});

app.get("/v1/sessions/:sessionId/context-views", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  return context.json({ contextViews: store.listContextViews(sessionId) });
});

app.get("/v1/sessions/:sessionId/externalized", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const items = store.listExternalizedContent(sessionId).map((item) => ({
    reference: item.reference,
    segmentId: item.segmentId,
    eventId: item.eventId,
    semanticType: item.semanticType,
    createdAt: item.createdAt,
    metadata: item.metadata,
    contentLength: item.content.length
  }));

  return context.json({ externalized: items });
});

app.get("/v1/sessions/:sessionId/externalized/:segmentId", (context) => {
  const sessionId = context.req.param("sessionId");
  if (!store.getSession(sessionId)) {
    return context.json({ error: "Session not found" }, 404);
  }

  const item = store.getExternalizedContent(sessionId, context.req.param("segmentId"));
  if (!item) {
    return context.json({ error: "Externalized content not found" }, 404);
  }

  return context.json({ externalized: item });
});

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Compaction Orchestrator API listening on http://localhost:${info.port}`);
});
