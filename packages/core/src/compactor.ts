import type {
  CompactionEnvironment,
  CompactionPlan,
  CompactionPolicy,
  CompactionStrategy,
  ContextSegment,
  RuntimeContextView,
  SegmentPlan,
  SessionEvent
} from "./types.js";
import { segmentEvents } from "./segmenter.js";
import { chooseStrategy, defaultStrategies } from "./strategies.js";
import { createId, estimateTokens, nowIso } from "./utils.js";

export type CompactSessionInput = {
  sessionId: string;
  events: SessionEvent[];
  objective: string;
  desiredBudget?: number;
  policy?: CompactionPolicy;
  strategies?: CompactionStrategy[];
};

export type CompactSessionOutput = {
  segments: ContextSegment[];
  plan: CompactionPlan;
  contextView: RuntimeContextView;
};

export function compactSession(input: CompactSessionInput): CompactSessionOutput {
  const policy = normalizePolicy(input.policy);
  const environment: CompactionEnvironment = {
    objective: input.objective,
    desiredBudget: input.desiredBudget,
    policy
  };
  const strategies = input.strategies ?? defaultStrategies();
  const segments = segmentEvents(input.events);
  const segmentPlans = segments.map((segment) => planSegment(segment, environment, strategies));
  const warnings = segmentPlans.flatMap((segment) => segment.validation.warnings);
  const planId = createId("plan");

  const plan: CompactionPlan = {
    id: planId,
    sessionId: input.sessionId,
    objective: input.objective,
    createdAt: nowIso(),
    policy,
    segments: segmentPlans,
    warnings
  };

  const content = segmentPlans
    .map((segment) => segment.result.content)
    .filter(Boolean)
    .join("\n\n---\n\n");

  const contextView: RuntimeContextView = {
    id: createId("ctx"),
    sessionId: input.sessionId,
    planId,
    createdAt: nowIso(),
    content,
    tokenEstimate: estimateTokens(content),
    externalReferences: segmentPlans.flatMap((segment) => segment.result.externalReference ? [segment.result.externalReference] : []),
    warnings
  };

  return { segments, plan, contextView };
}

function normalizePolicy(policy: CompactionPolicy = {}): CompactionPolicy {
  return {
    mode: policy.mode ?? "balanced",
    preserveUserMessagesVerbatim: policy.preserveUserMessagesVerbatim ?? true,
    preserveActiveErrorsVerbatim: policy.preserveActiveErrorsVerbatim ?? true,
    allowExternalRetrieval: policy.allowExternalRetrieval ?? true,
    allowHandoff: policy.allowHandoff ?? true,
    requireApprovalForHighRiskChanges: policy.requireApprovalForHighRiskChanges ?? true
  };
}

function planSegment(
  segment: ContextSegment,
  environment: CompactionEnvironment,
  strategies: CompactionStrategy[]
): SegmentPlan {
  const strategy = chooseStrategy(segment, environment, strategies);
  const estimate = strategy.estimate(segment, environment);
  const result = strategy.execute(segment, environment);
  const validation = strategy.validate(segment, result);

  return {
    segmentId: segment.id,
    eventId: segment.eventId,
    semanticType: segment.semanticType,
    operation: strategy.name,
    reason: reasonFor(segment, strategy.name),
    requiresHumanApproval: environment.policy.requireApprovalForHighRiskChanges === true && estimate.preservationRisk === "high",
    estimate,
    result,
    validation
  };
}

function reasonFor(segment: ContextSegment, strategyName: string): string {
  if (strategyName === "keep_verbatim") {
    return `${segment.semanticType} requires exact preservation.`;
  }

  if (strategyName === "extract_active_error") {
    return "Active debugging context needs exact error signal without full noisy output.";
  }

  if (strategyName === "externalize_for_retrieval") {
    return "Large retrievable context can move out of the active window while preserving provenance.";
  }

  if (strategyName === "mask_tool_output") {
    return "Low-relevance tool output can be represented as metadata instead of verbatim logs.";
  }

  return "Segment can be compacted into a structured summary.";
}
