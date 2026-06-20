import { compact, type CompactMessage } from "./sdk.js";
import type { CompactionPlan, RuntimeContextView, SegmentPlan, SessionEventInput } from "./types.js";
import { estimateTokens } from "./utils.js";

export type EvalFact = {
  id: string;
  category?: string;
  expected?: string;
  requiredTerms: string[];
  weight?: number;
  exact?: boolean;
};

export type EvalFixture = {
  name: string;
  objective?: string;
  desiredBudget?: number;
  policy?: Record<string, unknown>;
  useCase?: "generic" | "customer_support" | "customer-support";
  events: SessionEventInput[];
  expectedFacts: EvalFact[];
};

export type EvalCandidateName =
  | "raw_full_context"
  | "last_n_messages"
  | "recent_token_window"
  | "front_truncation"
  | "generic_summary"
  | "rolling_summary_recent"
  | "compaction_orchestrator";

export type EvalCandidate = {
  name: EvalCandidateName;
  runtimeContext: string;
  tokenEstimate: number;
  plan?: CompactionPlan;
  contextView?: RuntimeContextView;
  externalizedContent?: string;
  metadata?: Record<string, unknown>;
};

export type FactScore = EvalFact & {
  foundInlineTerms: string[];
  foundRecoverableTerms: string[];
  passedInline: boolean;
  passedWithRecovery: boolean;
  missingTerms: string[];
};

export type AccsBreakdown = {
  accs: number;
  criticalStateRecall: number;
  exactnessPreservation: number;
  downstreamReadiness: number;
  retrievalRecoverability: number;
  planInspectability: number;
  tokenReduction: number;
  hallucinationPenalty: number;
  irrelevantContextPenalty: number;
};

export type EvalCandidateResult = {
  candidate: EvalCandidateName;
  tokenEstimate: number;
  tokenReductionPercent: number;
  operations: string[];
  breakdown: AccsBreakdown;
  facts: FactScore[];
};

export type EvalComparison = {
  fixture: string;
  rawTokenEstimate: number;
  winner: EvalCandidateName;
  results: EvalCandidateResult[];
};

export type AccsWeights = {
  criticalStateRecall: number;
  exactnessPreservation: number;
  downstreamReadiness: number;
  retrievalRecoverability: number;
  planInspectability: number;
  tokenReduction: number;
  hallucinationPenalty: number;
  irrelevantContextPenalty: number;
};

const defaultWeights: AccsWeights = {
  criticalStateRecall: 0.34,
  exactnessPreservation: 0.18,
  downstreamReadiness: 0.16,
  retrievalRecoverability: 0.1,
  planInspectability: 0.08,
  tokenReduction: 0.14,
  hallucinationPenalty: 0.18,
  irrelevantContextPenalty: 0.1
};

export function evaluateCompactionFixture(
  fixture: EvalFixture,
  options: {
    weights?: Partial<AccsWeights>;
    lastN?: number;
    truncationTokens?: number;
    summaryTokens?: number;
  } = {}
): EvalComparison {
  const rawText = fixture.events.map(formatEvent).join("\n\n");
  const rawTokenEstimate = estimateTokens(rawText);
  const candidates = buildCandidates(fixture, {
    lastN: options.lastN ?? 3,
    truncationTokens: options.truncationTokens ?? Math.min(220, Math.max(80, Math.floor(rawTokenEstimate * 0.45))),
    summaryTokens: options.summaryTokens ?? Math.min(220, Math.max(100, Math.floor(rawTokenEstimate * 0.45)))
  });
  const weights = { ...defaultWeights, ...(options.weights ?? {}) };
  const results = candidates.map((candidate) => scoreCandidate(fixture, candidate, rawTokenEstimate, weights));
  const winner = [...results].sort((a, b) => b.breakdown.accs - a.breakdown.accs)[0].candidate;

  return {
    fixture: fixture.name,
    rawTokenEstimate,
    winner,
    results
  };
}

export function buildCandidates(
  fixture: EvalFixture,
  options: {
    lastN: number;
    truncationTokens: number;
    summaryTokens: number;
  }
): EvalCandidate[] {
  const rawText = fixture.events.map(formatEvent).join("\n\n");
  const orchestrated = compact({
    messages: fixture.events.map(eventToMessage),
    objective: fixture.objective,
    desiredBudget: fixture.desiredBudget,
    policy: fixture.policy as never,
    useCase: fixture.useCase ?? inferUseCase(fixture)
  });
  const orchestratedContext = orchestrated.contextPackage
    ? contextPackageText(orchestrated.contextPackage)
    : orchestrated.contextView.content;
  const orchestratedTokenEstimate = orchestrated.contextPackage
    ? orchestrated.contextPackage.metrics.contextTokenEstimate
    : orchestrated.contextView.tokenEstimate;
  const externalizedContent = orchestrated.plan.segments
    .filter((segment) => segment.result.externalReference)
    .map((segment) => {
      const source = orchestrated.segments.find((item) => item.id === segment.segmentId);
      return source?.content ?? "";
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      name: "raw_full_context",
      runtimeContext: rawText,
      tokenEstimate: estimateTokens(rawText)
    },
    {
      name: "last_n_messages",
      runtimeContext: fixture.events.slice(-options.lastN).map(formatEvent).join("\n\n"),
      tokenEstimate: estimateTokens(fixture.events.slice(-options.lastN).map(formatEvent).join("\n\n")),
      metadata: { lastN: options.lastN }
    },
    {
      name: "recent_token_window",
      runtimeContext: recentTokenWindow(rawText, orchestratedTokenEstimate),
      tokenEstimate: estimateTokens(recentTokenWindow(rawText, orchestratedTokenEstimate)),
      metadata: { tokenBudget: orchestratedTokenEstimate }
    },
    {
      name: "front_truncation",
      runtimeContext: truncateToTokens(rawText, options.truncationTokens),
      tokenEstimate: estimateTokens(truncateToTokens(rawText, options.truncationTokens)),
      metadata: { truncationTokens: options.truncationTokens }
    },
    {
      name: "generic_summary",
      runtimeContext: genericSummary(rawText, options.summaryTokens),
      tokenEstimate: estimateTokens(genericSummary(rawText, options.summaryTokens)),
      metadata: { summaryTokens: options.summaryTokens }
    },
    {
      name: "rolling_summary_recent",
      runtimeContext: rollingSummaryWithRecent(fixture.events, {
        summaryTokens: options.summaryTokens,
        recentEvents: options.lastN
      }),
      tokenEstimate: estimateTokens(rollingSummaryWithRecent(fixture.events, {
        summaryTokens: options.summaryTokens,
        recentEvents: options.lastN
      })),
      metadata: { summaryTokens: options.summaryTokens, recentEvents: options.lastN }
    },
    {
      name: "compaction_orchestrator",
      runtimeContext: orchestratedContext,
      tokenEstimate: orchestratedTokenEstimate,
      plan: orchestrated.plan,
      contextView: orchestrated.contextView,
      externalizedContent,
      metadata: {
        externalReferences: orchestrated.contextView.externalReferences
      }
    }
  ];
}

function scoreCandidate(
  fixture: EvalFixture,
  candidate: EvalCandidate,
  rawTokenEstimate: number,
  weights: AccsWeights
): EvalCandidateResult {
  const facts = fixture.expectedFacts.map((fact) => scoreFact(fact, candidate.runtimeContext, candidate.externalizedContent ?? ""));
  const criticalStateRecall = weightedAverage(facts, (fact) => fact.passedWithRecovery ? 1 : 0);
  const exactnessPreservation = exactnessScore(facts);
  const downstreamReadiness = readinessScore(facts);
  const retrievalRecoverability = recoverabilityScore(facts);
  const planInspectability = inspectabilityScore(candidate.plan);
  const tokenReduction = clamp01((rawTokenEstimate - candidate.tokenEstimate) / Math.max(1, rawTokenEstimate));
  const hallucinationPenalty = hallucinationPenaltyScore(candidate.runtimeContext, fixture.events);
  const irrelevantContextPenalty = irrelevantContextPenaltyScore(candidate.runtimeContext, fixture.expectedFacts);

  const positive =
    weights.criticalStateRecall * criticalStateRecall +
    weights.exactnessPreservation * exactnessPreservation +
    weights.downstreamReadiness * downstreamReadiness +
    weights.retrievalRecoverability * retrievalRecoverability +
    weights.planInspectability * planInspectability +
    weights.tokenReduction * tokenReduction;
  const penalties =
    weights.hallucinationPenalty * hallucinationPenalty +
    weights.irrelevantContextPenalty * irrelevantContextPenalty;
  const maxPositive =
    weights.criticalStateRecall +
    weights.exactnessPreservation +
    weights.downstreamReadiness +
    weights.retrievalRecoverability +
    weights.planInspectability +
    weights.tokenReduction;
  const accs = clamp01((positive - penalties) / maxPositive);

  return {
    candidate: candidate.name,
    tokenEstimate: candidate.tokenEstimate,
    tokenReductionPercent: Number((tokenReduction * 100).toFixed(1)),
    operations: candidate.plan?.segments.map((segment) => segment.operation) ?? [],
    breakdown: {
      accs: round3(accs),
      criticalStateRecall: round3(criticalStateRecall),
      exactnessPreservation: round3(exactnessPreservation),
      downstreamReadiness: round3(downstreamReadiness),
      retrievalRecoverability: round3(retrievalRecoverability),
      planInspectability: round3(planInspectability),
      tokenReduction: round3(tokenReduction),
      hallucinationPenalty: round3(hallucinationPenalty),
      irrelevantContextPenalty: round3(irrelevantContextPenalty)
    },
    facts
  };
}

function scoreFact(fact: EvalFact, runtimeContext: string, externalizedContent: string): FactScore {
  const foundInlineTerms = fact.requiredTerms.filter((term) => includesTerm(runtimeContext, term));
  const foundRecoverableTerms = fact.requiredTerms.filter((term) => includesTerm(externalizedContent, term));
  const allFound = new Set([...foundInlineTerms, ...foundRecoverableTerms]);
  const missingTerms = fact.requiredTerms.filter((term) => !allFound.has(term));

  return {
    ...fact,
    foundInlineTerms,
    foundRecoverableTerms,
    passedInline: foundInlineTerms.length === fact.requiredTerms.length,
    passedWithRecovery: missingTerms.length === 0,
    missingTerms
  };
}

function exactnessScore(facts: FactScore[]): number {
  const exactFacts = facts.filter((fact) => exactnessRequired(fact));
  return weightedAverage(exactFacts.length ? exactFacts : facts, (fact) => fact.passedInline ? 1 : 0);
}

function readinessScore(facts: FactScore[]): number {
  const readinessFacts = facts.filter((fact) => {
    const category = fact.category ?? "";
    return /active|error|next|decision|instruction|exact/.test(category) || /error|next|constraint|decision|route|shape/.test(fact.id);
  });
  return weightedAverage(readinessFacts.length ? readinessFacts : facts, (fact) => fact.passedInline ? 1 : 0);
}

function recoverabilityScore(facts: FactScore[]): number {
  const missingInlineTerms = facts.flatMap((fact) => fact.requiredTerms.filter((term) => !fact.foundInlineTerms.includes(term)));
  if (missingInlineTerms.length === 0) {
    return 1;
  }

  const recoveredTerms = facts.flatMap((fact) => fact.foundRecoverableTerms.filter((term) => !fact.foundInlineTerms.includes(term)));
  return recoveredTerms.length / missingInlineTerms.length;
}

function inspectabilityScore(plan?: CompactionPlan): number {
  if (!plan || plan.segments.length === 0) {
    return 0;
  }

  const complete = plan.segments.filter(isInspectableSegment).length;
  const mixedStrategyBonus = new Set(plan.segments.map((segment) => segment.operation)).size > 1 ? 0.1 : 0;
  return clamp01(complete / plan.segments.length + mixedStrategyBonus);
}

function isInspectableSegment(segment: SegmentPlan): boolean {
  return Boolean(
    segment.segmentId &&
    segment.eventId &&
    segment.semanticType &&
    segment.operation &&
    segment.reason &&
    segment.estimate &&
    segment.validation
  );
}

function hallucinationPenaltyScore(runtimeContext: string, events: SessionEventInput[]): number {
  const source = events.map((event) => event.content).join("\n").toLowerCase();
  const suspicious = importantTokens(runtimeContext)
    .filter((token) => !source.includes(token.toLowerCase()));

  if (suspicious.length === 0) {
    return 0;
  }

  return clamp01(suspicious.length / 30);
}

function irrelevantContextPenaltyScore(runtimeContext: string, facts: EvalFact[]): number {
  const contextTokens = estimateTokens(runtimeContext);
  if (contextTokens === 0) {
    return 1;
  }

  const usefulTerms = new Set(facts.flatMap((fact) => fact.requiredTerms.map(normalizeForMatch)));
  const signalHits = [...usefulTerms].filter((term) => normalizeForMatch(runtimeContext).includes(term)).length;
  const density = signalHits / Math.max(1, contextTokens);

  if (density >= 0.04) {
    return 0;
  }

  return clamp01((0.04 - density) / 0.04);
}

function weightedAverage(facts: FactScore[], scorer: (fact: FactScore) => number): number {
  if (facts.length === 0) {
    return 0;
  }

  const totalWeight = facts.reduce((sum, fact) => sum + factWeight(fact), 0);
  const score = facts.reduce((sum, fact) => sum + factWeight(fact) * scorer(fact), 0);
  return score / Math.max(1, totalWeight);
}

function factWeight(fact: EvalFact): number {
  if (typeof fact.weight === "number") {
    return fact.weight;
  }

  if (exactnessRequired(fact)) {
    return 1.4;
  }

  return 1;
}

function exactnessRequired(fact: EvalFact): boolean {
  const category = fact.category ?? "";
  return fact.exact === true || /instruction|exact|active|next/.test(category) || /constraint|error|route|shape|next/.test(fact.id);
}

function importantTokens(text: string): string[] {
  return [...new Set(text.match(/\b[A-Z][A-Za-z0-9_-]{3,}\b|[$][0-9][0-9,]*|\b[A-Z]{2,}[-_][A-Z0-9_-]+\b|\/[A-Za-z0-9_/:.-]+/g) ?? [])];
}

function formatEvent(event: SessionEventInput): string {
  return `${event.role}/${event.type}: ${event.content}`;
}

function eventToMessage(event: SessionEventInput): CompactMessage {
  return {
    role: event.role,
    type: event.type,
    content: event.content,
    metadata: event.metadata
  };
}

function inferUseCase(fixture: EvalFixture): "customer_support" | "generic" {
  return fixture.events.some((event) => event.metadata?.useCase === "customer_support") ? "customer_support" : "generic";
}

function genericSummary(text: string, tokenBudget: number): string {
  const words = text.trim().split(/\s+/);
  const budgetWords = Math.max(20, Math.floor(tokenBudget * 0.75));
  const frontWords = Math.floor(budgetWords * 0.55);
  const backWords = Math.floor(budgetWords * 0.45);

  if (words.length <= budgetWords) {
    return `Generic summary baseline:\n${text.trim()}`;
  }

  return [
    "Generic summary baseline:",
    words.slice(0, frontWords).join(" "),
    "...",
    words.slice(-backWords).join(" ")
  ].join("\n");
}

function rollingSummaryWithRecent(
  events: SessionEventInput[],
  options: {
    summaryTokens: number;
    recentEvents: number;
  }
): string {
  const oldEvents = events.slice(0, Math.max(0, events.length - options.recentEvents));
  const recentEvents = events.slice(-options.recentEvents);
  const oldText = oldEvents.map(formatEvent).join("\n\n");
  const recentText = recentEvents.map(formatEvent).join("\n\n");

  if (oldEvents.length === 0) {
    return recentText;
  }

  return [
    "Rolling summary memory baseline:",
    genericSummary(oldText, options.summaryTokens),
    "",
    "Recent messages:",
    recentText
  ].join("\n");
}

function contextPackageText(contextPackage: NonNullable<ReturnType<typeof compact>["contextPackage"]>): string {
  return [
    "Customer:",
    JSON.stringify(contextPackage.customer),
    "Issue:",
    JSON.stringify(contextPackage.issue),
    "Preserved instructions:",
    contextPackage.preservedInstructions.join("\n"),
    "Policy constraints:",
    contextPackage.policyConstraints.join("\n"),
    "Troubleshooting:",
    contextPackage.troubleshooting.join("\n"),
    "Decisions:",
    contextPackage.decisions.join("\n"),
    "Escalation:",
    JSON.stringify(contextPackage.escalation),
    "Next actions:",
    contextPackage.nextActions.join("\n"),
    "Runtime context:",
    contextPackage.runtimeContext.content
  ].join("\n");
}

function truncateToTokens(text: string, tokenBudget: number): string {
  return text.slice(0, tokenBudget * 4);
}

function recentTokenWindow(text: string, tokenBudget: number): string {
  return text.slice(Math.max(0, text.length - tokenBudget * 4));
}

function includesTerm(text: string, term: string): boolean {
  return normalizeForMatch(text).includes(normalizeForMatch(term));
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[“”]/g, "\"").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}
