import { buildCustomerSupportContextPackage } from "./context-package.js";
import { compactSession, type CompactSessionOutput } from "./compactor.js";
import type {
  CompactionPolicy,
  CompactionStrategy,
  ContextPackage,
  EventRole,
  EventType,
  SessionEvent,
  SessionEventInput
} from "./types.js";
import { createId, nowIso } from "./utils.js";

export type CompactMessage = {
  role: EventRole;
  content: string;
  type?: EventType;
  metadata?: Record<string, unknown>;
};

export type CompactInput = {
  messages: CompactMessage[];
  objective?: string;
  desiredBudget?: number;
  policy?: CompactionPolicy;
  strategies?: CompactionStrategy[];
  useCase?: "customer_support" | "customer-support" | "generic";
  sessionId?: string;
  sessionName?: string;
  metadata?: Record<string, unknown>;
};

export type CompactOutput = CompactSessionOutput & {
  sessionId: string;
  contextPackage?: ContextPackage;
};

export function compact(input: CompactInput): CompactOutput {
  const sessionId = input.sessionId ?? createId("ses");
  const events = messagesToEvents(input.messages, {
    sessionId,
    useCase: normalizeUseCase(input.useCase),
    sessionName: input.sessionName,
    metadata: input.metadata
  });

  const objective = input.objective ?? defaultObjective(input.useCase);

  if (normalizeUseCase(input.useCase) === "customer_support") {
    const packaged = buildCustomerSupportContextPackage({
      sessionId,
      events,
      objective,
      desiredBudget: input.desiredBudget,
      policy: input.policy,
      strategies: input.strategies
    });

    return {
      sessionId,
      segments: packaged.segments,
      plan: packaged.contextPackage.compactionPlan,
      contextView: packaged.contextPackage.runtimeContext,
      contextPackage: packaged.contextPackage
    };
  }

  return {
    sessionId,
    ...compactSession({
      sessionId,
      events,
      objective,
      desiredBudget: input.desiredBudget,
      policy: input.policy,
      strategies: input.strategies
    })
  };
}

export function compactCustomerSupport(
  input: Omit<CompactInput, "useCase">
): CompactOutput & { contextPackage: ContextPackage } {
  const output = compact({ ...input, useCase: "customer_support" });

  if (!output.contextPackage) {
    throw new Error("Customer-support compaction did not produce a context package.");
  }

  return {
    ...output,
    contextPackage: output.contextPackage
  };
}

export function messagesToEvents(
  messages: CompactMessage[],
  options: {
    sessionId?: string;
    useCase?: "customer_support" | "generic";
    sessionName?: string;
    metadata?: Record<string, unknown>;
  } = {}
): SessionEvent[] {
  const sessionId = options.sessionId ?? createId("ses");
  const createdAt = nowIso();

  return messages.map((message, index) => {
    const input = normalizeMessage(message, options);
    return {
      ...input,
      id: createId("evt"),
      sessionId,
      createdAt,
      sequence: index + 1
    };
  });
}

function normalizeMessage(
  message: CompactMessage,
  options: {
    useCase?: "customer_support" | "generic";
    sessionName?: string;
    metadata?: Record<string, unknown>;
  }
): SessionEventInput {
  const metadata = {
    ...(options.metadata ?? {}),
    ...(message.metadata ?? {})
  };

  if (options.useCase === "customer_support" && metadata.useCase === undefined) {
    metadata.useCase = "customer_support";
  }

  if (options.sessionName && metadata.sessionName === undefined) {
    metadata.sessionName = options.sessionName;
  }

  return {
    role: message.role,
    type: message.type ?? (message.role === "tool" ? "tool_output" : "message"),
    content: message.content,
    metadata
  };
}

function normalizeUseCase(useCase: CompactInput["useCase"]): "customer_support" | "generic" {
  return useCase === "customer-support" || useCase === "customer_support" ? "customer_support" : "generic";
}

function defaultObjective(useCase: CompactInput["useCase"]): string {
  if (normalizeUseCase(useCase) === "customer_support") {
    return "Prepare a reliable handoff package for the next support agent.";
  }

  return "Build a compact runtime context for the next agent turn.";
}
