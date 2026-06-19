import { useMemo, useRef, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Database,
  FileJson,
  Gauge,
  PackageCheck,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  TerminalSquare,
  Upload
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Tabs, Textarea } from "./components/ui";
import { codingFixture, supportFixture } from "./fixture";

type JsonRecord = Record<string, any>;

const defaultApiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [apiBase, setApiBase] = useState(defaultApiBase);
  const [fixtureText, setFixtureText] = useState(JSON.stringify(supportFixture, null, 2));
  const [inputName, setInputName] = useState("Built-in customer support fixture");
  const [activeTab, setActiveTab] = useState("Package");
  const [status, setStatus] = useState<JsonRecord | null>(null);
  const [output, setOutput] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<JsonRecord[]>([]);
  const [externalized, setExternalized] = useState<JsonRecord[]>([]);
  const [evaluation, setEvaluation] = useState<JsonRecord | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedFixture = useMemo(() => {
    try {
      return JSON.parse(fixtureText);
    } catch {
      return null;
    }
  }, [fixtureText]);

  async function request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {})
      }
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(`${response.status}: ${JSON.stringify(body)}`);
    }
    return body;
  }

  async function checkStatus() {
    setError(null);
    const [health, openai] = await Promise.all([
      request("/health"),
      request("/v1/openai/status")
    ]);
    setStatus({ health, openai });
    addLog("Checked API and OpenAI status.");
  }

  async function importJsonFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setFixtureText(JSON.stringify(parsed, null, 2));
      setInputName(file.name);
      clearOutput();
      setEvents([]);
      setExternalized([]);
      setEvaluation(null);
      setActiveTab("Package");
      addLog(`Imported ${file.name}.`);
    } catch (err) {
      setError(err instanceof Error ? `Could not import JSON: ${err.message}` : "Could not import JSON.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function runSupportPackage() {
    if (!parsedFixture) {
      setError("Fixture JSON is invalid.");
      return;
    }

    setLoading(true);
    setError(null);
    setEvaluation(null);
    try {
      const useCase = fixtureUseCase(parsedFixture);
      addLog(`Creating ${useCase} session.`);
      const session = await request("/v1/sessions", {
        method: "POST",
        body: JSON.stringify({
          name: parsedFixture.name,
          metadata: { useCase, source: "web-ui" }
        })
      });

      for (const event of parsedFixture.events) {
        await request(`/v1/sessions/${session.session.id}/events`, {
          method: "POST",
          body: JSON.stringify(event)
        });
      }
      addLog(`Ingested ${parsedFixture.events.length} events.`);

      const endpoint = useCase === "customer_support" ? "context-package" : "compact";
      const result = await request(`/v1/sessions/${session.session.id}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({
          objective: parsedFixture.objective,
          desiredBudget: parsedFixture.desiredBudget,
          policy: parsedFixture.policy
        })
      });

      const eventList = await request(`/v1/sessions/${session.session.id}/events`);
      const externalizedList = await request(`/v1/sessions/${session.session.id}/externalized`);
      setOutput(normalizeRunOutput(result, session.session.id, parsedFixture));
      setEvents(eventList.events);
      setExternalized(externalizedList.externalized);
      setActiveTab("Package");
      addLog(useCase === "customer_support" ? `Built context package ${result.contextPackage.id}.` : `Built runtime context ${result.contextView.id}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function runEvaluation() {
    if (!parsedFixture) {
      setError("Fixture JSON is invalid.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const adaptive = output ?? await createOutputForEvaluation(parsedFixture);
      const adaptiveText = adaptiveTextFor(adaptive);
      const goldfishText = buildGoldfishSummary(parsedFixture);

      const result = {
        adaptive: scoreText("Adaptive context package", adaptiveText, parsedFixture.expectedFacts),
        goldfish: scoreText("Goldfish generic summary", goldfishText, parsedFixture.expectedFacts),
        goldfishText
      };
      setEvaluation(result);
      setActiveTab("Evaluation");
      addLog("Ran recall evaluation.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function createOutputForEvaluation(fixture: JsonRecord) {
    const useCase = fixtureUseCase(fixture);
    const session = await request("/v1/sessions", {
      method: "POST",
      body: JSON.stringify({
        name: `${fixture.name}-web-eval`,
        metadata: { useCase, source: "web-ui-eval" }
      })
    });

    for (const event of fixture.events) {
      await request(`/v1/sessions/${session.session.id}/events`, {
        method: "POST",
        body: JSON.stringify(event)
      });
    }

    const endpoint = useCase === "customer_support" ? "context-package" : "compact";
    const result = await request(`/v1/sessions/${session.session.id}/${endpoint}`, {
      method: "POST",
      body: JSON.stringify({
        objective: fixture.objective,
        desiredBudget: fixture.desiredBudget,
        policy: fixture.policy
      })
    });
    return normalizeRunOutput(result, session.session.id, fixture);
  }

  function addLog(message: string) {
    setLog((items) => [`${new Date().toLocaleTimeString()} ${message}`, ...items].slice(0, 8));
  }

  function loadBuiltInFixture(kind: "support" | "coding") {
    const fixture = kind === "support" ? supportFixture : codingFixture;
    setFixtureText(JSON.stringify(fixture, null, 2));
    setInputName(kind === "support" ? "Built-in customer support fixture" : "Built-in coding-agent fixture");
    clearOutput();
    setActiveTab("Package");
    addLog(`Loaded ${kind === "support" ? "customer-support" : "coding-agent"} fixture.`);
  }

  function clearOutput() {
    setOutput(null);
    setEvents([]);
    setExternalized([]);
    setEvaluation(null);
  }

  const operations = output?.plan?.segments?.map((segment: JsonRecord) => segment.operation) ?? [];
  const metrics = output?.metrics;
  const useCase = parsedFixture ? fixtureUseCase(parsedFixture) : "unknown";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-5 lg:px-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="h-6 w-6" />
              <h1 className="text-2xl font-semibold">Compaction Orchestrator</h1>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Control which compaction strategies your agent chooses per turn and context segment.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(240px,340px)_auto_auto_auto]">
            <Input aria-label="API base URL" value={apiBase} onChange={(event) => setApiBase(event.target.value)} />
            <Button variant="outline" onClick={checkStatus}>
              <Server className="h-4 w-4" />
              Status
            </Button>
            <Button onClick={runSupportPackage} disabled={loading || !parsedFixture}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {useCase === "customer_support" ? "Run package" : "Run compact"}
            </Button>
            <Button variant="secondary" onClick={runEvaluation} disabled={loading || !parsedFixture}>
              <Gauge className="h-4 w-4" />
              Evaluate
            </Button>
          </div>
        </header>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(720px,1.65fr)_minmax(500px,1fr)]">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Input Session</CardTitle>
                  <CardDescription>Choose a demo or import JSON, then inspect the per-segment strategy choices.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{inputName}</Badge>
                  <Badge>{useCase}</Badge>
                  <Badge>{parsedFixture ? `${parsedFixture.events?.length ?? 0} events` : "Invalid JSON"}</Badge>
                  <Button variant="secondary" size="sm" onClick={() => loadBuiltInFixture("support")}>
                    <PackageCheck className="h-4 w-4" />
                    Support
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => loadBuiltInFixture("coding")}>
                    <TerminalSquare className="h-4 w-4" />
                    Coding
                  </Button>
                  <input
                    ref={fileInputRef}
                    className="hidden"
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => void importJsonFile(event.target.files?.[0])}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Import JSON
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={fixtureText}
                onChange={(event) => setFixtureText(event.target.value)}
                className="min-h-[68vh] text-[13px] leading-6"
              />
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                <StatusPill icon={<Database className="h-3.5 w-3.5" />} label="SQLite canonical log" />
                <StatusPill icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Per-turn strategy control" />
              </div>
            </CardContent>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <section className="grid gap-3 md:grid-cols-4">
              <MetricCard label="Raw tokens" value={metrics?.rawTokenEstimate ?? "-"} />
              <MetricCard label="Context tokens" value={metrics?.contextTokenEstimate ?? "-"} />
              <MetricCard label="Saved" value={metrics?.tokenReduction ?? "-"} />
              <MetricCard label="Externalized" value={externalized.length || "-"} />
            </section>

            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Output</CardTitle>
                  <CardDescription>Inspect output, runtime context, strategy choices, and eval.</CardDescription>
                </div>
                <Tabs tabs={["Package", "Runtime", "Plan", "Evaluation", "Events", "Logs"]} value={activeTab} onChange={setActiveTab} />
              </CardHeader>
              <CardContent>
                {activeTab === "Package" && <PackageView output={output} operations={operations} />}
                {activeTab === "Runtime" && <CodeBlock value={output?.runtimeContext?.content ?? "Run package/compact to see compacted runtime context."} />}
                {activeTab === "Plan" && <CodeBlock value={output ? JSON.stringify(output.plan, null, 2) : "Run package/compact to see the compaction plan."} />}
                {activeTab === "Evaluation" && <EvaluationView evaluation={evaluation} />}
                {activeTab === "Events" && <CodeBlock value={events.length ? JSON.stringify(events, null, 2) : "Run package to see persisted events."} />}
                {activeTab === "Logs" && <LogView status={status} log={log} />}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs font-medium text-zinc-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2">{icon}{label}</div>;
}

function PackageView({ output, operations }: { output: JsonRecord | null; operations: string[] }) {
  if (!output) {
    return <EmptyState title="No output yet" detail="Run package or compact to create a session, ingest events, and generate output." />;
  }

  if (output.kind === "generic") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoBlock title="Runtime context" rows={{
          sessionId: output.sessionId,
          contextViewId: output.runtimeContext.id,
          tokenEstimate: output.runtimeContext.tokenEstimate,
          warnings: output.runtimeContext.warnings?.length ?? 0
        }} />
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="mb-2 text-sm font-semibold">Strategies</div>
          <div className="flex flex-wrap gap-2">
            {operations.map((operation, index) => <Badge key={`${operation}-${index}`}>{operation}</Badge>)}
          </div>
        </div>
        <ListBlock title="Preserved facts" items={output.factIds} />
        <ListBlock title="External references" items={output.runtimeContext.externalReferences} />
      </div>
    );
  }

  const contextPackage = output.contextPackage;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InfoBlock title="Customer" rows={contextPackage.customer} />
      <InfoBlock title="Issue" rows={contextPackage.issue} />
      <InfoBlock title="Escalation" rows={contextPackage.escalation} />
      <div className="rounded-md border border-zinc-200 p-3">
        <div className="mb-2 text-sm font-semibold">Strategies</div>
        <div className="flex flex-wrap gap-2">
          {operations.map((operation, index) => <Badge key={`${operation}-${index}`}>{operation}</Badge>)}
        </div>
      </div>
      <ListBlock title="Policy constraints" items={contextPackage.policyConstraints} />
      <ListBlock title="Next actions" items={contextPackage.nextActions} />
      <ListBlock title="Decisions" items={contextPackage.decisions} />
      <ListBlock title="External references" items={contextPackage.externalReferences} />
    </div>
  );
}

function InfoBlock({ title, rows }: { title: string; rows: JsonRecord }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <dl className="space-y-1 text-sm">
        {Object.entries(rows ?? {}).map(([key, value]) => (
          <div className="grid grid-cols-[120px_1fr] gap-2" key={key}>
            <dt className="text-zinc-500">{key}</dt>
            <dd className="font-medium">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="space-y-2 text-sm text-zinc-700">
        {(items?.length ? items : ["None"]).map((item, index) => <p key={index}>{item}</p>)}
      </div>
    </div>
  );
}

function EvaluationView({ evaluation }: { evaluation: JsonRecord | null }) {
  if (!evaluation) {
    return <EmptyState title="No evaluation yet" detail="Run Evaluate to compare adaptive package recall against Goldfish." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <ScoreCard name="Adaptive context package" score={evaluation.adaptive} />
        <ScoreCard name="Goldfish generic summary" score={evaluation.goldfish} />
      </div>
      <div className="rounded-md border border-zinc-200 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <BadgeCheck className="h-4 w-4" />
          Recall facts
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-2">Fact</th>
                <th>Adaptive</th>
                <th>Goldfish</th>
                <th>Required terms</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.adaptive.facts.map((fact: JsonRecord, index: number) => (
                <tr className="border-t border-zinc-100" key={fact.id}>
                  <td className="py-2 font-medium">{fact.id}</td>
                  <td>{fact.passed ? "pass" : "fail"}</td>
                  <td>{evaluation.goldfish.facts[index]?.passed ? "pass" : "fail"}</td>
                  <td className="text-zinc-500">{fact.requiredTerms.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold">Goldfish summary text</div>
        <CodeBlock value={evaluation.goldfishText} />
      </div>
    </div>
  );
}

function ScoreCard({ name, score }: { name: string; score: JsonRecord }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <div className="text-sm font-semibold">{name}</div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-semibold">{score.passed}/{score.total}</span>
        <span className="pb-1 text-sm text-zinc-500">recall {score.recall}</span>
      </div>
    </div>
  );
}

function LogView({ status, log }: { status: JsonRecord | null; log: string[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4" />Activity</div>
        <div className="space-y-2 text-sm text-zinc-600">
          {log.length ? log.map((item) => <div className="rounded-md bg-zinc-50 px-2 py-2" key={item}>{item}</div>) : <p>No activity yet.</p>}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileJson className="h-4 w-4" />Status JSON</div>
        <CodeBlock value={status ? JSON.stringify(status, null, 2) : "Click Status to check API and OpenAI configuration."} />
      </div>
    </div>
  );
}

function CodeBlock({ value }: { value: string }) {
  return <pre className="max-h-[520px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-950 p-3 text-xs leading-5 text-zinc-50">{value}</pre>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 text-center">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-sm text-zinc-500">{detail}</div>
      </div>
    </div>
  );
}

function normalizeRunOutput(result: JsonRecord, sessionId: string, fixture: JsonRecord): JsonRecord {
  if (result.contextPackage) {
    return {
      kind: "customer_support",
      sessionId,
      contextPackage: result.contextPackage,
      runtimeContext: result.contextPackage.runtimeContext,
      plan: result.contextPackage.compactionPlan,
      metrics: result.contextPackage.metrics,
      factIds: (fixture.expectedFacts ?? []).map((fact: JsonRecord) => fact.id)
    };
  }

  const rawTokenEstimate = estimateTokens(fixture.events?.map((event: JsonRecord) => event.content).join("\n\n") ?? "");
  const contextTokenEstimate = result.contextView?.tokenEstimate ?? 0;
  return {
    kind: "generic",
    sessionId,
    runtimeContext: result.contextView,
    plan: result.plan,
    segments: result.segments,
    metrics: {
      rawTokenEstimate,
      contextTokenEstimate,
      tokenReduction: Math.max(0, rawTokenEstimate - contextTokenEstimate),
      eventCount: fixture.events?.length ?? 0,
      segmentCount: result.segments?.length ?? 0
    },
    factIds: (fixture.expectedFacts ?? []).map((fact: JsonRecord) => fact.id)
  };
}

function fixtureUseCase(fixture: JsonRecord): "customer_support" | "generic" {
  return fixture.events?.some((event: JsonRecord) => event.metadata?.useCase === "customer_support") ? "customer_support" : "generic";
}

function adaptiveTextFor(output: JsonRecord) {
  if (output.kind === "customer_support") {
    const contextPackage = output.contextPackage;
    return [
      JSON.stringify(contextPackage.customer),
      JSON.stringify(contextPackage.issue),
      contextPackage.preservedInstructions?.join("\n"),
      contextPackage.policyConstraints?.join("\n"),
      contextPackage.troubleshooting?.join("\n"),
      contextPackage.decisions?.join("\n"),
      JSON.stringify(contextPackage.escalation),
      contextPackage.nextActions?.join("\n"),
      contextPackage.runtimeContext?.content
    ].join("\n\n");
  }

  return [
    output.runtimeContext?.content,
    output.plan?.segments?.map((segment: JsonRecord) => `${segment.semanticType}: ${segment.operation}. ${segment.reason}`).join("\n")
  ].join("\n\n");
}

function buildGoldfishSummary(fixture: JsonRecord) {
  const raw = fixture.events.map((event: JsonRecord) => `${event.role}/${event.type}: ${event.content}`).join("\n\n");
  const words = raw.split(/\s+/);
  const budgetWords = 190;
  return [
    "Generic summary baseline:",
    words.slice(0, Math.floor(budgetWords * 0.55)).join(" "),
    "...",
    words.slice(-Math.floor(budgetWords * 0.45)).join(" ")
  ].join("\n");
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function scoreText(name: string, text: string, expectedFacts: JsonRecord[]) {
  const facts = expectedFacts.map((fact) => {
    const foundTerms = fact.requiredTerms.filter((term: string) => text.includes(term));
    return {
      ...fact,
      foundTerms,
      passed: foundTerms.length === fact.requiredTerms.length
    };
  });
  const passed = facts.filter((fact) => fact.passed).length;
  return {
    name,
    passed,
    total: facts.length,
    recall: Number((passed / facts.length).toFixed(3)),
    facts
  };
}
