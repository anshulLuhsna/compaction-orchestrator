import { readFile } from "node:fs/promises";
import {
  buildCandidates,
  evaluateCompactionFixture
} from "../packages/core/dist/index.js";

const apiKey = process.env.DEEPSEEK_API_KEY;
const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const fixturePath = process.argv[2] ?? "examples/coding-agent-session.json";

if (!apiKey) {
  console.log(JSON.stringify({
    skipped: true,
    reason: "DEEPSEEK_API_KEY is not configured.",
    howToRun: "DEEPSEEK_API_KEY=... npm run eval:deepseek -- examples/coding-agent-session.json",
    model,
    baseUrl
  }, null, 2));
  process.exit(0);
}

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const comparison = evaluateCompactionFixture(fixture);
const rawTokenEstimate = comparison.rawTokenEstimate;
const candidates = buildCandidates(fixture, {
  lastN: 3,
  truncationTokens: Math.min(220, Math.max(80, Math.floor(rawTokenEstimate * 0.45))),
  summaryTokens: Math.min(220, Math.max(100, Math.floor(rawTokenEstimate * 0.45)))
});

const selected = candidates.filter((candidate) =>
  candidate.name === "generic_summary" || candidate.name === "compaction_orchestrator"
);

const results = [];
for (const candidate of selected) {
  const judged = await askDeepSeek(fixture, candidate.runtimeContext);
  results.push({
    candidate: candidate.name,
    tokenEstimate: candidate.tokenEstimate,
    model,
    score: scoreAnswers(fixture.expectedFacts, judged.answers),
    rawResponse: judged
  });
}

console.log(JSON.stringify({
  fixture: fixture.name,
  model,
  baseUrl,
  deterministicAccs: comparison.results.map((result) => ({
    candidate: result.candidate,
    accs: result.breakdown.accs
  })),
  deepseekNextTurnProbe: results
}, null, 2));

async function askDeepSeek(fixture, runtimeContext) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
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
            JSON.stringify(fixture.expectedFacts.map((fact) => ({
              id: fact.id,
              question: fact.question ?? fact.expected,
              requiredTerms: fact.requiredTerms
            })), null, 2),
            "",
            "Return JSON in this shape:",
            "{\"answers\":[{\"id\":\"fact id\",\"answer\":\"short answer using only runtime context\"}]}"
          ].join("\n")
        }
      ]
    })
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status} ${JSON.stringify(body)}`);
  }

  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`DeepSeek response missing content: ${JSON.stringify(body)}`);
  }

  return JSON.parse(content);
}

function scoreAnswers(expectedFacts, answers = []) {
  const byId = new Map(answers.map((answer) => [answer.id, String(answer.answer ?? "")]));
  const facts = expectedFacts.map((fact) => {
    const answer = byId.get(fact.id) ?? "";
    const normalizedAnswer = answer.toLowerCase();
    const foundTerms = fact.requiredTerms.filter((term) => normalizedAnswer.includes(term.toLowerCase()));
    return {
      id: fact.id,
      answer,
      foundTerms,
      passed: foundTerms.length === fact.requiredTerms.length
    };
  });
  const passed = facts.filter((fact) => fact.passed).length;

  return {
    passed,
    total: facts.length,
    recall: Number((passed / facts.length).toFixed(3)),
    facts
  };
}
