import { z } from "zod";

export const eventRoleSchema = z.enum(["user", "assistant", "tool", "system"]);
export const eventTypeSchema = z.enum(["message", "tool_call", "tool_output", "decision", "artifact", "compaction"]);

export const sessionEventInputSchema = z.object({
  role: eventRoleSchema,
  type: eventTypeSchema,
  content: z.string().min(1),
  metadata: z.record(z.unknown()).default({})
});

export type SessionEventInput = z.infer<typeof sessionEventInputSchema>;
export type EventRole = z.infer<typeof eventRoleSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;

export type SessionEvent = SessionEventInput & {
  id: string;
  sessionId: string;
  createdAt: string;
  sequence: number;
};

export type Session = {
  id: string;
  name?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type SemanticType =
  | "user_instruction"
  | "active_error"
  | "tool_observation"
  | "artifact_reference"
  | "decision"
  | "completed_exploration"
  | "customer_profile"
  | "support_issue"
  | "support_policy"
  | "troubleshooting_step"
  | "escalation_state"
  | "next_action"
  | "general_context";

export type TaskStage = "setup" | "exploration" | "implementation" | "debugging" | "handoff" | "unknown";
export type SegmentStatus = "active" | "resolved" | "superseded" | "unknown";

export type ContextSegment = {
  id: string;
  eventId: string;
  sessionId: string;
  content: string;
  contentType: EventType;
  semanticType: SemanticType;
  taskStage: TaskStage;
  status: SegmentStatus;
  artifacts: string[];
  importance: number;
  futureRelevance: number;
  exactnessRequired: boolean;
  retrievable: boolean;
  reconstructionCost: "low" | "medium" | "high";
  metadata: Record<string, unknown>;
};

export type CompactionPolicy = {
  mode?: "accuracy_first" | "balanced" | "cost_first" | "long_horizon" | "human_controlled";
  preserveUserMessagesVerbatim?: boolean;
  preserveActiveErrorsVerbatim?: boolean;
  allowExternalRetrieval?: boolean;
  allowHandoff?: boolean;
  requireApprovalForHighRiskChanges?: boolean;
};

export type CompactionEnvironment = {
  objective: string;
  desiredBudget?: number;
  policy: CompactionPolicy;
};

export type StrategyEstimate = {
  tokenSavings: number;
  preservationRisk: "low" | "medium" | "high";
  latency: "low" | "medium" | "high";
  confidence: number;
};

export type StrategyExecution = {
  content: string;
  externalReference?: string;
  provenance: string[];
  tokenEstimate: number;
};

export type StrategyValidation = {
  passed: boolean;
  checks: string[];
  warnings: string[];
};

export type CompactionStrategy = {
  name: string;
  supports(segment: ContextSegment, environment: CompactionEnvironment): boolean;
  estimate(segment: ContextSegment, environment: CompactionEnvironment): StrategyEstimate;
  execute(segment: ContextSegment, environment: CompactionEnvironment): StrategyExecution;
  validate(original: ContextSegment, transformed: StrategyExecution): StrategyValidation;
};

export type SegmentPlan = {
  segmentId: string;
  eventId: string;
  semanticType: SemanticType;
  operation: string;
  reason: string;
  requiresHumanApproval: boolean;
  estimate: StrategyEstimate;
  result: StrategyExecution;
  validation: StrategyValidation;
};

export type CompactionPlan = {
  id: string;
  sessionId: string;
  objective: string;
  createdAt: string;
  policy: CompactionPolicy;
  segments: SegmentPlan[];
  warnings: string[];
};

export type RuntimeContextView = {
  id: string;
  sessionId: string;
  planId: string;
  createdAt: string;
  content: string;
  tokenEstimate: number;
  externalReferences: string[];
  warnings: string[];
};

export type ExternalizedContent = {
  reference: string;
  sessionId: string;
  segmentId: string;
  eventId: string;
  semanticType: SemanticType;
  content: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type ContextPackage = {
  id: string;
  sessionId: string;
  useCase: "customer_support";
  objective: string;
  createdAt: string;
  customer: {
    name?: string;
    email?: string;
    accountId?: string;
    plan?: string;
    region?: string;
  };
  issue: {
    summary: string;
    productArea?: string;
    severity?: "low" | "medium" | "high" | "critical";
    status: "open" | "waiting_on_customer" | "waiting_on_internal" | "resolved" | "escalated";
  };
  preservedInstructions: string[];
  policyConstraints: string[];
  troubleshooting: string[];
  decisions: string[];
  escalation: {
    required: boolean;
    reason?: string;
    targetTeam?: string;
  };
  nextActions: string[];
  runtimeContext: RuntimeContextView;
  compactionPlan: CompactionPlan;
  externalReferences: string[];
  metrics: {
    rawTokenEstimate: number;
    contextTokenEstimate: number;
    tokenReduction: number;
    eventCount: number;
    segmentCount: number;
  };
};
