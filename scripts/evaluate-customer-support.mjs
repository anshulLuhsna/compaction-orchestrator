import { readFile } from "node:fs/promises";

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const fixturePath = process.argv[2] ?? "examples/customer-support-session.json";
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function adaptiveRun() {
  const session = await request("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({
      name: `${fixture.name}-adaptive-eval`,
      metadata: { useCase: "customer_support", evaluator: "adaptive" }
    })
  });

  for (const event of fixture.events) {
    await request(`/v1/sessions/${session.session.id}/events`, {
      method: "POST",
      body: JSON.stringify(event)
    });
  }

  const packaged = await request(`/v1/sessions/${session.session.id}/context-package`, {
    method: "POST",
    body: JSON.stringify({
      objective: fixture.objective,
      desiredBudget: fixture.desiredBudget,
      policy: fixture.policy
    })
  });

  return {
    sessionId: session.session.id,
    text: [
      JSON.stringify(packaged.contextPackage.customer),
      JSON.stringify(packaged.contextPackage.issue),
      packaged.contextPackage.preservedInstructions.join("\n"),
      packaged.contextPackage.policyConstraints.join("\n"),
      packaged.contextPackage.troubleshooting.join("\n"),
      packaged.contextPackage.decisions.join("\n"),
      JSON.stringify(packaged.contextPackage.escalation),
      packaged.contextPackage.nextActions.join("\n"),
      packaged.contextPackage.runtimeContext.content
    ].join("\n\n"),
    package: packaged.contextPackage
  };
}

function goldfishRun() {
  const raw = fixture.events.map((event) => `${event.role}/${event.type}: ${event.content}`).join("\n\n");
  const words = raw.split(/\s+/);
  const budgetWords = 190;
  const firstHalf = words.slice(0, Math.floor(budgetWords * 0.55));
  const lastHalf = words.slice(-Math.floor(budgetWords * 0.45));
  const text = [
    "Generic summary baseline:",
    firstHalf.join(" "),
    "...",
    lastHalf.join(" ")
  ].join("\n");

  return {
    text,
    tokenEstimate: Math.ceil(text.length / 4)
  };
}

function scoreText(name, text) {
  const factScores = fixture.expectedFacts.map((fact) => {
    const foundTerms = fact.requiredTerms.filter((term) => text.includes(term));
    return {
      id: fact.id,
      category: fact.category,
      question: fact.question,
      expected: fact.expected,
      requiredTerms: fact.requiredTerms,
      foundTerms,
      passed: foundTerms.length === fact.requiredTerms.length
    };
  });

  const passed = factScores.filter((score) => score.passed).length;
  return {
    name,
    passed,
    total: factScores.length,
    recall: Number((passed / factScores.length).toFixed(3)),
    byCategory: summarizeByCategory(factScores),
    facts: factScores
  };
}

function summarizeByCategory(factScores) {
  const categories = new Map();
  for (const fact of factScores) {
    const current = categories.get(fact.category) ?? { passed: 0, total: 0 };
    current.total += 1;
    if (fact.passed) {
      current.passed += 1;
    }
    categories.set(fact.category, current);
  }

  return Object.fromEntries(Array.from(categories.entries()).map(([category, result]) => [
    category,
    {
      ...result,
      recall: Number((result.passed / result.total).toFixed(3))
    }
  ]));
}

const adaptive = await adaptiveRun();
const goldfish = goldfishRun();
const adaptiveScore = scoreText("adaptive_context_package", adaptive.text);
const goldfishScore = scoreText("goldfish_generic_summary", goldfish.text);

console.log(JSON.stringify({
  fixture: fixturePath,
  adaptive: {
    sessionId: adaptive.sessionId,
    score: adaptiveScore,
    metrics: adaptive.package.metrics,
    operations: adaptive.package.compactionPlan.segments.map((segment) => segment.operation)
  },
  goldfish: {
    score: goldfishScore,
    tokenEstimate: goldfish.tokenEstimate
  },
  winner: adaptiveScore.recall >= goldfishScore.recall ? "adaptive_context_package" : "goldfish_generic_summary"
}, null, 2));
