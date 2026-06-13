import type {
  CompactionEnvironment,
  CompactionStrategy,
  ContextSegment,
  StrategyEstimate,
  StrategyExecution,
  StrategyValidation
} from "./types.js";
import { estimateTokens, truncateWords } from "./utils.js";

function baseEstimate(segment: ContextSegment, tokenSavings: number, confidence = 0.85): StrategyEstimate {
  return {
    tokenSavings,
    preservationRisk: segment.exactnessRequired ? "medium" : "low",
    latency: "low",
    confidence
  };
}

function validation(passed: boolean, checks: string[], warnings: string[] = []): StrategyValidation {
  return { passed, checks, warnings };
}

export const keepVerbatimStrategy: CompactionStrategy = {
  name: "keep_verbatim",
  supports(segment) {
    return segment.exactnessRequired || segment.importance > 0.9;
  },
  estimate() {
    return {
      tokenSavings: 0,
      preservationRisk: "low",
      latency: "low",
      confidence: 0.99
    };
  },
  execute(segment) {
    return {
      content: segment.content,
      provenance: ["preserved original content verbatim"],
      tokenEstimate: estimateTokens(segment.content)
    };
  },
  validate(original, transformed) {
    return validation(original.content === transformed.content, ["verbatim equality"]);
  }
};

export const extractActiveErrorStrategy: CompactionStrategy = {
  name: "extract_active_error",
  supports(segment) {
    return segment.semanticType === "active_error";
  },
  estimate(segment) {
    return baseEstimate(segment, Math.max(0, estimateTokens(segment.content) - 120), 0.88);
  },
  execute(segment) {
    const lines = segment.content.split(/\r?\n/).filter(Boolean);
    const relevant = lines.filter((line) => /(error|exception|failed|trace|at |caused by|cannot find|enoent|eaddrinuse)/i.test(line));
    const extracted = relevant.length > 0 ? relevant.slice(0, 12).join("\n") : lines.slice(0, 12).join("\n");

    return {
      content: `Active error extracted from ${segment.eventId}:\n${extracted}`,
      provenance: ["extracted error-bearing lines", `source segment ${segment.id}`],
      tokenEstimate: estimateTokens(extracted)
    };
  },
  validate(_original, transformed) {
    const hasErrorSignal = /(error|exception|failed|cannot find|trace)/i.test(transformed.content);
    return validation(hasErrorSignal, ["active error signal retained"], hasErrorSignal ? [] : ["No error signal found after extraction"]);
  }
};

export const maskToolOutputStrategy: CompactionStrategy = {
  name: "mask_tool_output",
  supports(segment) {
    return segment.semanticType === "tool_observation";
  },
  estimate(segment) {
    return baseEstimate(segment, Math.max(0, estimateTokens(segment.content) - 40), 0.9);
  },
  execute(segment) {
    const artifacts = segment.artifacts.length > 0 ? ` Artifacts mentioned: ${segment.artifacts.join(", ")}.` : "";
    const content = `[Masked tool output from ${segment.eventId}. Original token estimate: ${estimateTokens(segment.content)}.${artifacts}]`;

    return {
      content,
      provenance: ["masked low-relevance tool observation"],
      tokenEstimate: estimateTokens(content)
    };
  },
  validate() {
    return validation(true, ["tool output intentionally masked"]);
  }
};

export const structuredSummaryStrategy: CompactionStrategy = {
  name: "structured_summary",
  supports(segment) {
    return !segment.exactnessRequired;
  },
  estimate(segment) {
    return baseEstimate(segment, Math.max(0, estimateTokens(segment.content) - 80), 0.76);
  },
  execute(segment) {
    const artifactLine = segment.artifacts.length > 0 ? `\nArtifacts: ${segment.artifacts.join(", ")}` : "";
    const content = `Summary of ${segment.semanticType} from ${segment.eventId}:\n${truncateWords(segment.content, 80)}${artifactLine}`;

    return {
      content,
      provenance: ["deterministic structured summary"],
      tokenEstimate: estimateTokens(content)
    };
  },
  validate(original, transformed) {
    const artifactWarnings = original.artifacts.filter((artifact) => !transformed.content.includes(artifact));
    return validation(artifactWarnings.length === 0, ["artifact mentions retained"], artifactWarnings.map((artifact) => `Missing artifact ${artifact}`));
  }
};

export const externalizeLargeSegmentStrategy: CompactionStrategy = {
  name: "externalize_for_retrieval",
  supports(segment, environment) {
    return environment.policy.allowExternalRetrieval !== false && segment.retrievable && estimateTokens(segment.content) > 180;
  },
  estimate(segment) {
    return baseEstimate(segment, Math.max(0, estimateTokens(segment.content) - 35), 0.82);
  },
  execute(segment) {
    const reference = `memory://${segment.sessionId}/${segment.id}`;
    const content = `[Externalized ${segment.semanticType} from ${segment.eventId}. Retrieve ${reference} if this exact content becomes relevant.]`;

    return {
      content,
      externalReference: reference,
      provenance: ["stored full content outside active context", `source segment ${segment.id}`],
      tokenEstimate: estimateTokens(content)
    };
  },
  validate() {
    return validation(true, ["external reference created"]);
  }
};

export function defaultStrategies(): CompactionStrategy[] {
  return [
    keepVerbatimStrategy,
    extractActiveErrorStrategy,
    externalizeLargeSegmentStrategy,
    maskToolOutputStrategy,
    structuredSummaryStrategy
  ];
}

export function chooseStrategy(
  segment: ContextSegment,
  environment: CompactionEnvironment,
  strategies: CompactionStrategy[]
): CompactionStrategy {
  const supported = strategies.filter((strategy) => strategy.supports(segment, environment));
  if (supported.length === 0) {
    return structuredSummaryStrategy;
  }

  if (environment.policy.mode === "cost_first") {
    return supported
      .map((strategy) => ({ strategy, estimate: strategy.estimate(segment, environment) }))
      .sort((a, b) => b.estimate.tokenSavings - a.estimate.tokenSavings)[0].strategy;
  }

  if (segment.semanticType === "active_error" && environment.policy.preserveActiveErrorsVerbatim === false) {
    const extractor = supported.find((strategy) => strategy.name === "extract_active_error");
    if (extractor) {
      return extractor;
    }
  }

  if (segment.semanticType === "user_instruction" || segment.exactnessRequired) {
    const exactStrategy = supported.find((strategy) => strategy.name === "keep_verbatim");
    if (exactStrategy) {
      return exactStrategy;
    }
  }

  return supported[0];
}
