import { basename } from "node:path";
import type { CompactionPolicy, EventRole, EventType, SessionEventInput } from "./types.js";

type UnknownRecord = Record<string, unknown>;

export type ImportedFixture = {
  name: string;
  objective: string;
  desiredBudget: number;
  policy: CompactionPolicy;
  useCase: "generic";
  events: SessionEventInput[];
  expectedFacts: Array<{
    id: string;
    category: string;
    requiredTerms: string[];
  }>;
  metadata: Record<string, unknown>;
};

export type ClaudeCodeImportOptions = {
  name?: string;
  sourcePath?: string;
  objective?: string;
  desiredBudget?: number;
  maxToolOutputChars?: number;
};

type ClaudeCodeEntry = {
  type?: string;
  uuid?: string;
  parentUuid?: string;
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  message?: {
    role?: string;
    content?: unknown;
  };
  content?: unknown;
  toolUseResult?: unknown;
};

type ClaudeContentBlock = {
  type?: string;
  text?: unknown;
  id?: unknown;
  name?: unknown;
  input?: unknown;
  tool_use_id?: unknown;
  content?: unknown;
};

export function claudeCodeJsonlToFixture(text: string, options: ClaudeCodeImportOptions = {}): ImportedFixture {
  const events: SessionEventInput[] = [];
  const warnings: string[] = [];
  let sessionId: string | undefined;
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let version: string | undefined;
  let skipped = 0;

  for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;

    let entry: ClaudeCodeEntry;
    try {
      entry = JSON.parse(line) as ClaudeCodeEntry;
    } catch {
      skipped += 1;
      warnings.push(`line ${lineIndex + 1}: invalid json`);
      continue;
    }

    sessionId ??= asString(entry.sessionId);
    cwd ??= asString(entry.cwd);
    gitBranch ??= asString(entry.gitBranch);
    version ??= asString(entry.version);

    const converted = convertClaudeEntry(entry, {
      maxToolOutputChars: options.maxToolOutputChars ?? 12000
    });

    if (converted.length === 0 && entry.type !== "queue-operation" && entry.type !== "last-prompt") {
      skipped += 1;
    }

    events.push(...converted);
  }

  const fallbackName = options.sourcePath ? basename(options.sourcePath).replace(/\.jsonl$/i, "") : "claude-code-session";

  return {
    name: options.name ?? `claude-code-${fallbackName}`,
    objective: options.objective ?? "prepare context for the next coding-agent turn.",
    desiredBudget: options.desiredBudget ?? 1200,
    policy: {
      mode: "balanced",
      preserveUserMessagesVerbatim: true,
      preserveActiveErrorsVerbatim: false,
      allowExternalRetrieval: true
    },
    useCase: "generic",
    events,
    expectedFacts: [],
    metadata: {
      importer: "claude_code_jsonl",
      sourcePath: options.sourcePath,
      sourceSessionId: sessionId,
      cwd,
      gitBranch,
      claudeCodeVersion: version,
      importedEventCount: events.length,
      skippedEntryCount: skipped,
      warnings
    }
  };
}

function convertClaudeEntry(
  entry: ClaudeCodeEntry,
  options: { maxToolOutputChars: number }
): SessionEventInput[] {
  const role = normalizeRole(entry.message?.role ?? entry.type);
  const content = entry.message?.content ?? entry.content;

  if (!role || content === undefined) {
    return [];
  }

  const baseMetadata = baseEntryMetadata(entry);

  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed ? [{
      role,
      type: role === "tool" ? "tool_output" : "message",
      content: trimmed,
      metadata: removeUndefined({
        ...baseMetadata,
        semanticType: role === "user" ? "user_instruction" : undefined
      })
    }] : [];
  }

  if (!Array.isArray(content)) {
    const text = stringifyUnknown(content);
    return text ? [{
      role,
      type: role === "tool" ? "tool_output" : "message",
      content: text,
      metadata: baseMetadata
    }] : [];
  }

  return content.flatMap((block, blockIndex) => convertClaudeBlock(block as ClaudeContentBlock, {
    entry,
    baseMetadata,
    fallbackRole: role,
    blockIndex,
    maxToolOutputChars: options.maxToolOutputChars
  }));
}

function convertClaudeBlock(
  block: ClaudeContentBlock,
  options: {
    entry: ClaudeCodeEntry;
    baseMetadata: Record<string, unknown>;
    fallbackRole: EventRole;
    blockIndex: number;
    maxToolOutputChars: number;
  }
): SessionEventInput[] {
  const metadata = {
    ...options.baseMetadata,
    claudeBlockType: block.type,
    claudeBlockIndex: options.blockIndex
  };

  if (block.type === "text") {
    const text = asString(block.text)?.trim();
    return text ? [{
      role: options.fallbackRole,
      type: "message",
      content: text,
      metadata
    }] : [];
  }

  if (block.type === "tool_use") {
    const toolName = asString(block.name) ?? "unknown_tool";
    const input = stringifyUnknown(block.input);
    return [{
      role: "assistant",
      type: "tool_call",
      content: input ? `${toolName}\n${input}` : toolName,
      metadata: {
        ...metadata,
        toolName,
        toolUseId: asString(block.id),
        semanticType: "completed_exploration"
      }
    }];
  }

  if (block.type === "tool_result") {
    const content = truncateToolOutput(stringifyUnknown(block.content), options.maxToolOutputChars);
    return content ? [{
      role: "tool",
      type: "tool_output",
      content,
      metadata: {
        ...metadata,
        toolUseId: asString(block.tool_use_id),
        semanticType: looksLikeError(content) ? "active_error" : "tool_observation"
      }
    }] : [];
  }

  if (block.type === "thinking") {
    return [];
  }

  const content = stringifyUnknown(block).trim();
  return content ? [{
    role: options.fallbackRole,
    type: "message",
    content,
    metadata
  }] : [];
}

function normalizeRole(role: string | undefined): EventRole | null {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }

  if (role === "tool") {
    return "tool";
  }

  return null;
}

function baseEntryMetadata(entry: ClaudeCodeEntry): Record<string, unknown> {
  return removeUndefined({
    source: "claude_code_jsonl",
    claudeType: entry.type,
    claudeUuid: entry.uuid,
    claudeParentUuid: entry.parentUuid,
    claudeTimestamp: entry.timestamp,
    claudeSessionId: entry.sessionId,
    cwd: entry.cwd,
    gitBranch: entry.gitBranch,
    claudeCodeVersion: entry.version
  });
}

function stringifyUnknown(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stringifyUnknown).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function truncateToolOutput(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, maxChars)}\n\n[truncated ${content.length - maxChars} chars from claude tool output]`;
}

function looksLikeError(content: string): boolean {
  return /(error|failed|exception|traceback|cannot find|enoent|eaddrinuse)/i.test(content);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function removeUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
