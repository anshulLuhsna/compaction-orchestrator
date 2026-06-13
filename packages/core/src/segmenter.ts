import type { ContextSegment, SemanticType, SessionEvent, TaskStage } from "./types.js";
import { createId, estimateTokens, metadataStringArray } from "./utils.js";

const errorPattern = /(error|exception|failed|stack trace|traceback|cannot find|enoent|eaddrinuse)/i;
const instructionPattern = /(must|should|do not|don't|preserve|require|constraint|use |avoid|never|always)/i;
const artifactPattern = /(?:[\w.-]+\/)+[\w.-]+\.(?:ts|tsx|js|jsx|py|md|json|yml|yaml|css|html|go|rs|java|sql)|\b[\w.-]+\.(?:ts|tsx|js|jsx|py|md|json|yml|yaml|css|html|go|rs|java|sql)\b/g;

export function segmentEvents(events: SessionEvent[]): ContextSegment[] {
  return events.map((event) => {
    const semanticType = classifySemanticType(event);
    const artifacts = extractArtifacts(event);
    const tokenEstimate = estimateTokens(event.content);

    return {
      id: createId("seg"),
      eventId: event.id,
      sessionId: event.sessionId,
      content: event.content,
      contentType: event.type,
      semanticType,
      taskStage: inferTaskStage(event, semanticType),
      status: semanticType === "active_error" ? "active" : "unknown",
      artifacts,
      importance: scoreImportance(event, semanticType, artifacts.length),
      futureRelevance: scoreFutureRelevance(semanticType, tokenEstimate),
      exactnessRequired: semanticType === "user_instruction" || semanticType === "active_error",
      retrievable: event.type === "tool_output" || tokenEstimate > 500,
      reconstructionCost: semanticType === "user_instruction" || semanticType === "active_error" ? "high" : "medium",
      metadata: event.metadata
    };
  });
}

function classifySemanticType(event: SessionEvent): SemanticType {
  if (event.type === "decision") {
    return "decision";
  }

  if (event.type === "artifact") {
    return "artifact_reference";
  }

  if (event.role === "user" && instructionPattern.test(event.content)) {
    return "user_instruction";
  }

  if (event.type === "tool_output" && errorPattern.test(event.content)) {
    return "active_error";
  }

  if (event.type === "tool_output") {
    return "tool_observation";
  }

  if (/explor|inspect|read|scan|search/i.test(event.content)) {
    return "completed_exploration";
  }

  return "general_context";
}

function inferTaskStage(event: SessionEvent, semanticType: SemanticType): TaskStage {
  if (semanticType === "active_error") {
    return "debugging";
  }

  if (semanticType === "completed_exploration") {
    return "exploration";
  }

  if (/handoff|continue in a new agent|fresh agent/i.test(event.content)) {
    return "handoff";
  }

  if (/implement|edit|patch|build|create|modify/i.test(event.content)) {
    return "implementation";
  }

  if (/install|setup|scaffold|init/i.test(event.content)) {
    return "setup";
  }

  return "unknown";
}

function extractArtifacts(event: SessionEvent): string[] {
  const fromMetadata = metadataStringArray(event.metadata.artifacts);
  const fromContent = event.content.match(artifactPattern) ?? [];
  return Array.from(new Set([...fromMetadata, ...fromContent]));
}

function scoreImportance(event: SessionEvent, semanticType: SemanticType, artifactCount: number): number {
  if (semanticType === "user_instruction") {
    return 0.98;
  }

  if (semanticType === "active_error") {
    return 0.92;
  }

  if (semanticType === "decision") {
    return 0.88;
  }

  if (artifactCount > 0) {
    return 0.78;
  }

  if (event.type === "tool_output") {
    return 0.35;
  }

  return 0.55;
}

function scoreFutureRelevance(semanticType: SemanticType, tokenEstimate: number): number {
  if (semanticType === "user_instruction" || semanticType === "active_error") {
    return 0.9;
  }

  if (semanticType === "decision" || semanticType === "artifact_reference") {
    return 0.8;
  }

  if (semanticType === "tool_observation" && tokenEstimate > 300) {
    return 0.25;
  }

  return 0.5;
}
