import type {
  CompactionPolicy,
  CompactionStrategy,
  ContextPackage,
  ContextSegment,
  RuntimeContextView,
  SessionEvent
} from "./types.js";
import { compactSession } from "./compactor.js";
import { createId, estimateTokens, nowIso, truncateWords } from "./utils.js";

export type BuildContextPackageInput = {
  sessionId: string;
  events: SessionEvent[];
  objective: string;
  desiredBudget?: number;
  policy?: CompactionPolicy;
  strategies?: CompactionStrategy[];
};

export function buildCustomerSupportContextPackage(input: BuildContextPackageInput): {
  segments: ContextSegment[];
  contextPackage: ContextPackage;
} {
  const compacted = compactSession(input);
  const supportEvents = input.events.filter((event) => event.metadata.useCase === "customer_support");
  const customer = extractCustomer(supportEvents);
  const issue = extractIssue(supportEvents, compacted.segments);
  const preservedInstructions = contentFor(compacted.segments, ["user_instruction"]);
  const policyConstraints = contentFor(compacted.segments, ["support_policy"]);
  const troubleshooting = contentFor(compacted.segments, ["troubleshooting_step", "active_error", "tool_observation"]);
  const decisions = contentFor(compacted.segments, ["decision"]);
  const nextActions = contentFor(compacted.segments, ["next_action"]);
  const escalation = extractEscalation(supportEvents, compacted.segments);
  const rawTokenEstimate = estimateTokens(input.events.map((event) => event.content).join("\n\n"));

  return {
    segments: compacted.segments,
    contextPackage: {
      id: createId("pkg"),
      sessionId: input.sessionId,
      useCase: "customer_support",
      objective: input.objective,
      createdAt: nowIso(),
      customer,
      issue,
      preservedInstructions,
      policyConstraints,
      troubleshooting,
      decisions,
      escalation,
      nextActions,
      runtimeContext: compacted.contextView,
      compactionPlan: compacted.plan,
      externalReferences: compacted.contextView.externalReferences,
      metrics: {
        rawTokenEstimate,
        contextTokenEstimate: compacted.contextView.tokenEstimate,
        tokenReduction: Math.max(0, rawTokenEstimate - compacted.contextView.tokenEstimate),
        eventCount: input.events.length,
        segmentCount: compacted.segments.length
      }
    }
  };
}

function contentFor(segments: ContextSegment[], semanticTypes: ContextSegment["semanticType"][]): string[] {
  return segments
    .filter((segment) => semanticTypes.includes(segment.semanticType))
    .map((segment) => truncateWords(segment.content, 70));
}

function extractCustomer(events: SessionEvent[]): ContextPackage["customer"] {
  const merged = Object.assign({}, ...events.map((event) => event.metadata.customer).filter(isRecord));
  return {
    name: stringValue(merged.name),
    email: stringValue(merged.email),
    accountId: stringValue(merged.accountId),
    plan: stringValue(merged.plan),
    region: stringValue(merged.region)
  };
}

function extractIssue(events: SessionEvent[], segments: ContextSegment[]): ContextPackage["issue"] {
  const metadataIssue = Object.assign({}, ...events.map((event) => event.metadata.issue).filter(isRecord));
  const supportIssue = segments.find((segment) => segment.semanticType === "support_issue");
  return {
    summary: stringValue(metadataIssue.summary) ?? (supportIssue ? truncateWords(supportIssue.content, 35) : "Support issue summary unavailable"),
    productArea: stringValue(metadataIssue.productArea),
    severity: severityValue(metadataIssue.severity) ?? inferSeverity(events),
    status: statusValue(metadataIssue.status) ?? inferStatus(events, segments)
  };
}

function extractEscalation(events: SessionEvent[], segments: ContextSegment[]): ContextPackage["escalation"] {
  const escalationMetadata = Object.assign({}, ...events.map((event) => event.metadata.escalation).filter(isRecord));
  const escalationSegment = segments.find((segment) => segment.semanticType === "escalation_state");
  const required = Boolean(escalationMetadata.required) || Boolean(escalationSegment) || events.some((event) => /escalat/i.test(event.content));
  return {
    required,
    reason: stringValue(escalationMetadata.reason) ?? (escalationSegment ? truncateWords(escalationSegment.content, 30) : undefined),
    targetTeam: stringValue(escalationMetadata.targetTeam)
  };
}

function inferSeverity(events: SessionEvent[]): ContextPackage["issue"]["severity"] {
  const all = events.map((event) => event.content).join("\n").toLowerCase();
  if (/sev[ -]?1|critical|outage|cannot access|blocked for all/.test(all)) {
    return "critical";
  }
  if (/urgent|high|blocked|production|enterprise/.test(all)) {
    return "high";
  }
  if (/medium|degraded|intermittent/.test(all)) {
    return "medium";
  }
  return "low";
}

function inferStatus(events: SessionEvent[], segments: ContextSegment[]): ContextPackage["issue"]["status"] {
  const all = events.map((event) => event.content).join("\n").toLowerCase();
  if (/resolved|fixed|closed/.test(all)) {
    return "resolved";
  }
  if (/waiting on customer|ask customer|need customer/.test(all)) {
    return "waiting_on_customer";
  }
  if (/waiting on engineering|internal|backend team|billing ops/.test(all)) {
    return "waiting_on_internal";
  }
  if (segments.some((segment) => segment.semanticType === "escalation_state")) {
    return "escalated";
  }
  return "open";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function severityValue(value: unknown): ContextPackage["issue"]["severity"] | undefined {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : undefined;
}

function statusValue(value: unknown): ContextPackage["issue"]["status"] | undefined {
  return value === "open" ||
    value === "waiting_on_customer" ||
    value === "waiting_on_internal" ||
    value === "resolved" ||
    value === "escalated"
    ? value
    : undefined;
}
