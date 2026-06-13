export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function estimateTokens(content: string): number {
  return Math.ceil(content.trim().length / 4);
}

export function truncateWords(content: string, maxWords: number): string {
  const words = content.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return content.trim();
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}

export function metadataStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
