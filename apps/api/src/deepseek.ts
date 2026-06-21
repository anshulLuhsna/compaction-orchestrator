import {
  buildCandidates,
  evaluateCompactionFixture,
  type EvalCandidateName,
  type EvalFact,
  type EvalFixture
} from "@anshulluhsna/compaction-orchestrator";

type DeepSeekConfig = {
  configured: boolean;
  model: string;
  baseUrl: string;
};

type ProbeAnswer = {
  id: string;
  answer: string;
};

type DeepSeekJsonResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: Record<string, unknown>;
};

const defaultProbeCandidates: EvalCandidateName[] = ["generic_summary", "compaction_orchestrator"];

export function getDeepSeekConfig(): DeepSeekConfig {
  return {
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"
  };
}

export async function runDeepSeekProbe(
  fixture: EvalFixture,
  options: {
    candidates?: EvalCandidateName[];
  } = {}
) {
  const config = getDeepSeekConfig();
  if (!config.configured) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }

  const comparison = evaluateCompactionFixture(fixture);
  const rawTokenEstimate = comparison.rawTokenEstimate;
  const candidates = buildCandidates(fixture, {
    lastN: 3,
    truncationTokens: Math.min(220, Math.max(80, Math.floor(rawTokenEstimate * 0.45))),
    summaryTokens: Math.min(220, Math.max(100, Math.floor(rawTokenEstimate * 0.45)))
  });
  const selectedNames = new Set(options.candidates?.length ? options.candidates : defaultProbeCandidates);
  const selected = candidates.filter((candidate) => selectedNames.has(candidate.name));

  const startedAt = new Date().toISOString();
  const results = [];
  for (const candidate of selected) {
    const started = Date.now();
    const judged = await askDeepSeek(config, fixture, candidate.runtimeContext);
    results.push({
      candidate: candidate.name,
      tokenEstimate: candidate.tokenEstimate,
      latencyMs: Date.now() - started,
      score: scoreAnswers(fixture.expectedFacts, judged.answers),
      rawResponse: judged.rawResponse,
      answers: judged.answers
    });
  }

  return {
    provider: "deepseek",
    model: config.model,
    baseUrl: config.baseUrl,
    startedAt,
    deterministicAccs: comparison.results.map((result) => ({
      candidate: result.candidate,
      accs: result.breakdown.accs,
      tokenEstimate: result.tokenEstimate
    })),
    deepseekNextTurnProbe: results
  };
}

async function askDeepSeek(config: DeepSeekConfig, fixture: EvalFixture, runtimeContext: string) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are evaluating whether compacted agent context preserves the facts needed for the next turn.",
            "Use only the supplied runtime context.",
            "Preserve exact strings for code identifiers, file paths, route paths, commands, error messages, account IDs, invoice IDs, policies, and times.",
            "If the context contains an exact required term, copy that exact term into the answer instead of paraphrasing it.",
            "Answer only valid JSON."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            "Runtime context:",
            runtimeContext,
            "",
            "Expected fact probes:",
            JSON.stringify(factProbes(fixture.expectedFacts), null, 2),
            "",
            "Return JSON in this shape:",
            "{\"answers\":[{\"id\":\"fact id\",\"answer\":\"short answer using only runtime context\"}]}"
          ].join("\n")
        }
      ]
    })
  });

  const body = await response.json() as DeepSeekJsonResponse & { error?: unknown };
  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status} ${JSON.stringify(body)}`);
  }

  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`DeepSeek response missing content: ${JSON.stringify(body)}`);
  }

  const parsed = parseJsonContent(content) as { answers?: ProbeAnswer[] };
  return {
    answers: Array.isArray(parsed.answers) ? parsed.answers : [],
    rawResponse: {
      id: body.id,
      model: body.model,
      usage: body.usage,
      content
    }
  };
}

function factProbes(expectedFacts: EvalFact[]) {
  return expectedFacts.map((fact) => ({
    id: fact.id,
    question: factQuestion(fact),
    requiredTerms: fact.requiredTerms
  }));
}

function factQuestion(fact: EvalFact) {
  const question = (fact as EvalFact & { question?: string }).question;
  if (typeof question === "string" && question.trim()) {
    return question;
  }

  if (typeof fact.expected === "string" && fact.expected.trim()) {
    return fact.expected;
  }

  return `Which context details preserve ${fact.id}?`;
}

function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error(`DeepSeek returned non-JSON content: ${content}`);
  }
}

function scoreAnswers(expectedFacts: EvalFact[], answers: ProbeAnswer[] = []) {
  const byId = new Map(answers.map((answer) => [answer.id, String(answer.answer ?? "")]));
  const facts = expectedFacts.map((fact) => {
    const answer = byId.get(fact.id) ?? "";
    const normalizedAnswer = answer.toLowerCase();
    const foundTerms = fact.requiredTerms.filter((term) => normalizedAnswer.includes(term.toLowerCase()));
    return {
      id: fact.id,
      answer,
      foundTerms,
      missingTerms: fact.requiredTerms.filter((term) => !foundTerms.includes(term)),
      passed: foundTerms.length === fact.requiredTerms.length
    };
  });
  const passed = facts.filter((fact) => fact.passed).length;

  return {
    passed,
    total: facts.length,
    recall: Number((passed / Math.max(1, facts.length)).toFixed(3)),
    facts
  };
}
