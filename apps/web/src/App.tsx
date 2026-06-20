import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileJson,
  Gauge,
  Loader2,
  MessageSquareText,
  Play,
  Radio,
  Server,
  TerminalSquare,
  Upload,
  X
} from "lucide-react";
import { codingFixture, supportFixture, voiceFixture } from "./fixture";

type JsonRecord = Record<string, any>;
type DemoKind = "support" | "coding" | "voice" | "custom";
type LoadingAction = "compact" | "eval" | "status" | null;

const defaultApiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const demos: Record<Exclude<DemoKind, "custom">, {
  title: string;
  short: string;
  icon: ReactNode;
  proves: string;
  mustKeep: string[];
}> = {
  support: {
    title: "Customer support",
    short: "A billing handoff where policy, escalation, and invoice state matter.",
    icon: <MessageSquareText className="h-5 w-5" />,
    proves: "Generic summaries miss operational handoff details.",
    mustKeep: ["Maya Chen", "INV-2026-0441-DUP", "$5,000 approval", "billing_portal_v2=false", "5 PM UTC"]
  },
  coding: {
    title: "Coding agent",
    short: "A coding session where exact constraints and active errors matter.",
    icon: <TerminalSquare className="h-5 w-5" />,
    proves: "Recent context windows lose early implementation constraints.",
    mustKeep: ["Use Hono only", "{ ok, invoiceId, status }", "/v1/billing/:invoiceId", "billingRouter", "typecheck"]
  },
  voice: {
    title: "Voice agent",
    short: "A latency-sensitive call where consent and slot state matter.",
    icon: <Radio className="h-5 w-5" />,
    proves: "Lean voice context can drop consent or selected-slot state.",
    mustKeep: ["Priya Nair", "Do not cancel", "confirmed_reschedule_only", "2026-06-30 14:30", "under 700 runtime tokens"]
  }
};

export function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [apiBase, setApiBase] = useState(defaultApiBase);
  const [fixtureText, setFixtureText] = useState(JSON.stringify(supportFixture, null, 2));
  const [selectedDemo, setSelectedDemo] = useState<DemoKind>("support");
  const [inputName, setInputName] = useState("Customer support fixture");
  const [output, setOutput] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<JsonRecord[]>([]);
  const [externalized, setExternalized] = useState<JsonRecord[]>([]);
  const [probe, setProbe] = useState<JsonRecord | null>(null);
  const [status, setStatus] = useState<JsonRecord | null>(null);
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  const fixture = useMemo(() => {
    try {
      return JSON.parse(fixtureText);
    } catch {
      return null;
    }
  }, [fixtureText]);
  const fixtureStats = useMemo(() => summarizeFixture(fixture), [fixture]);
  const selectedCopy = selectedDemo === "custom" ? null : demos[selectedDemo];
  const metrics = output?.metrics;
  const compactDone = Boolean(output);
  const evalDone = Boolean(probe);

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

  function selectDemo(kind: "support" | "coding" | "voice") {
    const next = kind === "support" ? supportFixture : kind === "coding" ? codingFixture : voiceFixture;
    setFixtureText(JSON.stringify(next, null, 2));
    setSelectedDemo(kind);
    setInputName(`${demos[kind].title} fixture`);
    clearResults();
    setError(null);
  }

  function clearResults() {
    setOutput(null);
    setEvents([]);
    setExternalized([]);
    setProbe(null);
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setFixtureText(JSON.stringify(parsed, null, 2));
      setSelectedDemo("custom");
      setInputName(file.name);
      clearResults();
    } catch (err) {
      setError(err instanceof Error ? `Import failed: ${err.message}` : "Import failed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function checkStatus() {
    setLoading("status");
    setError(null);
    try {
      const [health, deepseek] = await Promise.all([
        request("/health"),
        request("/v1/deepseek/status")
      ]);
      setStatus({ health, deepseek });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function runCompact() {
    if (!fixture) {
      setError("Fixture JSON is invalid.");
      return;
    }

    setLoading("compact");
    setError(null);
    setProbe(null);
    try {
      const useCase = fixtureUseCase(fixture);
      const session = await request("/v1/sessions", {
        method: "POST",
        body: JSON.stringify({
          name: fixture.name,
          metadata: { useCase, source: "web-ui" }
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

      const eventList = await request(`/v1/sessions/${session.session.id}/events`);
      const externalizedList = await request(`/v1/sessions/${session.session.id}/externalized`);
      setOutput(normalizeRunOutput(result, session.session.id, fixture));
      setEvents(eventList.events);
      setExternalized(externalizedList.externalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function runEvaluation() {
    if (!fixture) {
      setError("Fixture JSON is invalid.");
      return;
    }

    setLoading("eval");
    setError(null);
    try {
      const result = await request("/v1/deepseek/probe", {
        method: "POST",
        body: JSON.stringify({
          fixture,
          candidates: ["generic_summary", "compaction_orchestrator"]
        })
      });
      setProbe(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-[#d4e4fa]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5">
        <header className="flex flex-col gap-4 border-b border-[#263547] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-medium text-[#8ea3c1]">Compaction Orchestrator</div>
            <h1 className="mt-1 max-w-3xl text-3xl font-semibold tracking-normal md:text-4xl">
              One guided demo. Pick a session, compact it, evaluate it.
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="API base URL"
              className="h-9 w-full rounded-md border border-[#2f4054] bg-[#0b1624] px-3 font-mono text-xs text-[#d4e4fa] outline-none focus:border-[#adc6ff] sm:w-72"
              value={apiBase}
              onChange={(event) => setApiBase(event.target.value)}
            />
            <Button variant="ghost" onClick={checkStatus} loading={loading === "status"} icon={<Server className="h-4 w-4" />}>Status</Button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-[#ffb4ab]/40 bg-[#2a1014] px-4 py-3 text-sm text-[#ffdad6]">
            {error}
          </div>
        )}

        <StepRail compactDone={compactDone} evalDone={evalDone} loading={loading} />

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Panel>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">1. Choose the session</h2>
                <p className="mt-1 text-sm leading-6 text-[#9fb0c8]">Start with one real use case. Everything else is hidden until needed.</p>
              </div>
              <SmallBadge>{fixtureStats.eventCount} events</SmallBadge>
            </div>

            <div className="mt-4 grid gap-2">
              {typedDemoEntries().map(([kind, copy]) => (
                <button
                  key={kind}
                  className={[
                    "rounded-lg border p-3 text-left transition",
                    selectedDemo === kind ? "border-[#adc6ff] bg-[#12243a]" : "border-[#263547] bg-[#0b1624] hover:border-[#60748d]"
                  ].join(" ")}
                  onClick={() => selectDemo(kind)}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {copy.icon}
                    {copy.title}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-[#9fb0c8]">{copy.short}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-[#263547] bg-[#0b1624] p-3">
              <div className="text-sm font-semibold">{inputName}</div>
              <p className="mt-1 text-sm text-[#9fb0c8]">{selectedCopy?.proves ?? fixture?.objective ?? "Custom imported session."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(selectedCopy?.mustKeep ?? (fixture?.expectedFacts ?? []).map((fact: JsonRecord) => fact.id).slice(0, 5)).map((item: string) => (
                  <SmallBadge key={item}>{item}</SmallBadge>
                ))}
              </div>
            </div>

            <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => importJson(event.target.files?.[0])} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()} icon={<Upload className="h-4 w-4" />}>Import JSON</Button>
              <Button variant="ghost" onClick={() => setRawOpen(true)} icon={<FileJson className="h-4 w-4" />}>Raw</Button>
            </div>
          </Panel>

          <div className="flex flex-col gap-5">
            <Panel>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">2. Compact the session</h2>
                  <p className="mt-1 text-sm leading-6 text-[#9fb0c8]">The strategy picker creates an inspectable per-segment plan.</p>
                </div>
                <Button onClick={runCompact} loading={loading === "compact"} icon={<Play className="h-4 w-4" />}>Run compact</Button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Metric label="Raw" value={metrics?.rawTokenEstimate ?? fixtureStats.rawTokens} />
                <Metric label="Runtime" value={metrics?.contextTokenEstimate ?? "-"} good={compactDone} />
                <Metric label="Saved" value={metrics?.tokenReduction ?? "-"} />
                <Metric label="Externalized" value={externalized.length || "-"} />
              </div>

              {output ? (
                <CompactSummary output={output} />
              ) : (
                <EmptyNote>Run compaction to see the token reduction and strategy choices.</EmptyNote>
              )}
            </Panel>

            <Panel>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">3. Evaluate with DeepSeek</h2>
                  <p className="mt-1 text-sm leading-6 text-[#9fb0c8]">Compare generic summary vs orchestrated context using a live model call.</p>
                </div>
                <Button variant="secondary" onClick={runEvaluation} loading={loading === "eval"} icon={<Gauge className="h-4 w-4" />}>Evaluate live</Button>
              </div>

              {probe ? (
                <EvaluationSummary probe={probe} />
              ) : (
                <EmptyNote>Run live evaluation to see what the model can actually recover.</EmptyNote>
              )}
            </Panel>
          </div>
        </section>

        <details className="rounded-lg border border-[#263547] bg-[#0d1b2b]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#9fb0c8]">
            Advanced details
          </summary>
          <div className="grid gap-4 border-t border-[#263547] p-4 lg:grid-cols-2">
            <CodeBlock title="Status" value={status ? JSON.stringify(status, null, 2) : "Click Status."} />
            <CodeBlock title="Compaction plan" value={output ? JSON.stringify(output.plan, null, 2) : "Run compact."} />
            <CodeBlock title="Runtime context" value={output?.runtimeContext?.content ?? "Run compact."} />
            <CodeBlock title="Events" value={events.length ? JSON.stringify(events, null, 2) : "Run compact."} />
          </div>
        </details>
      </div>

      <RawDrawer
        open={rawOpen}
        value={fixtureText}
        onChange={(value) => {
          setFixtureText(value);
          setSelectedDemo("custom");
          setInputName("Custom JSON");
          clearResults();
        }}
        onClose={() => setRawOpen(false)}
      />
    </main>
  );
}

function StepRail({ compactDone, evalDone, loading }: { compactDone: boolean; evalDone: boolean; loading: LoadingAction }) {
  const steps = [
    { label: "Choose session", done: true, active: false },
    { label: "Compact", done: compactDone, active: loading === "compact" },
    { label: "Evaluate", done: evalDone, active: loading === "eval" }
  ];

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {steps.map((step, index) => (
        <div className="rounded-lg border border-[#263547] bg-[#0d1b2b] p-3" key={step.label}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {step.active ? <Loader2 className="h-4 w-4 animate-spin text-[#adc6ff]" /> : step.done ? <CheckCircle2 className="h-4 w-4 text-[#4edea3]" /> : <ChevronRight className="h-4 w-4 text-[#60748d]" />}
            {index + 1}. {step.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompactSummary({ output }: { output: JsonRecord }) {
  const segments = output.plan?.segments ?? [];
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-lg border border-[#263547] bg-[#0b1624] p-3">
        <div className="text-sm font-semibold">Strategy choices</div>
        <div className="mt-3 space-y-2">
          {segments.slice(0, 6).map((segment: JsonRecord, index: number) => (
            <div className="flex items-center justify-between gap-3 rounded-md bg-[#101f31] px-3 py-2" key={segment.segmentId ?? index}>
              <div>
                <div className="font-mono text-xs text-[#adc6ff]">{segment.operation}</div>
                <div className="text-xs text-[#9fb0c8]">{segment.semanticType}</div>
              </div>
              <SmallBadge>{segment.result?.tokenEstimate ?? "-"} tokens</SmallBadge>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[#263547] bg-[#0b1624] p-4">
        <div className="text-sm font-semibold">What changed</div>
        <div className="mt-3 space-y-3 text-sm leading-6 text-[#9fb0c8]">
          <p>The app did not make one generic summary. It split the session into segments, chose a strategy for each segment, and built a smaller runtime context.</p>
          <p>Full runtime context, events, and the raw compaction plan stay in Advanced details.</p>
        </div>
        <div className="mt-4 grid gap-2">
          <SmallBadge>{segments.length} segments planned</SmallBadge>
          <SmallBadge>{output.metrics?.contextTokenEstimate ?? "-"} runtime tokens</SmallBadge>
        </div>
      </div>
    </div>
  );
}

function EvaluationSummary({ probe }: { probe: JsonRecord }) {
  const results = probe.deepseekNextTurnProbe ?? [];
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {results.map((result: JsonRecord) => {
        const isWinner = result.candidate === "compaction_orchestrator";
        const failed = result.score?.facts?.filter((fact: JsonRecord) => !fact.passed) ?? [];
        return (
          <div className={["rounded-lg border p-4", isWinner ? "border-[#4edea3]/50 bg-[#10241f]" : "border-[#ffb4ab]/40 bg-[#241416]"].join(" ")} key={result.candidate}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{candidateLabel(result.candidate)}</div>
                <p className="mt-1 text-sm text-[#9fb0c8]">{result.tokenEstimate} context tokens sent to DeepSeek</p>
              </div>
              <SmallBadge>{result.latencyMs} ms</SmallBadge>
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-semibold">{result.score?.passed}/{result.score?.total}</span>
              <span className="pb-2 text-sm text-[#9fb0c8]">facts recovered</span>
            </div>
            <div className="mt-4 rounded-md border border-[#263547] bg-[#0b1624] p-3 text-sm">
              {failed.length ? (
                <div className="flex items-center gap-2 text-[#ffb4ab]">
                  <AlertTriangle className="h-4 w-4" />
                  Missed: {failed.map((fact: JsonRecord) => fact.id).join(", ")}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[#4edea3]">
                  <CheckCircle2 className="h-4 w-4" />
                  All checked facts recovered.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-[#263547] bg-[#0d1b2b] p-4">{children}</section>;
}

function Metric({ label, value, good }: { label: string; value: string | number; good?: boolean }) {
  return (
    <div className="rounded-lg border border-[#263547] bg-[#0b1624] p-3">
      <div className="font-mono text-[11px] uppercase tracking-wide text-[#7f92ad]">{label}</div>
      <div className={["mt-2 text-2xl font-semibold", good ? "text-[#4edea3]" : "text-[#d4e4fa]"].join(" ")}>{value}</div>
    </div>
  );
}

function SmallBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-md border border-[#2f4054] bg-[#0b1624] px-2 py-1 font-mono text-[11px] text-[#9fb0c8]">{children}</span>;
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded-lg border border-dashed border-[#2f4054] bg-[#0b1624] p-5 text-sm text-[#9fb0c8]">{children}</div>;
}

function Button({ children, onClick, icon, loading, variant = "primary" }: { children: ReactNode; onClick?: () => void; icon?: ReactNode; loading?: boolean; variant?: "primary" | "secondary" | "ghost" }) {
  const classes = variant === "primary"
    ? "border-[#adc6ff] bg-[#adc6ff] text-[#07111f] hover:bg-[#c7d7ff]"
    : variant === "secondary"
      ? "border-[#4edea3]/60 bg-[#153428] text-[#6ffbbe] hover:bg-[#1d4636]"
      : "border-[#2f4054] bg-transparent text-[#d4e4fa] hover:border-[#60748d]";

  return (
    <button className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:opacity-60 ${classes}`} onClick={onClick} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

function CodeBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#263547] bg-black">
      <div className="border-b border-[#263547] bg-[#101f31] px-3 py-2 text-sm font-semibold">{title}</div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5 text-[#d4e4fa]">{value}</pre>
    </div>
  );
}

function RawDrawer({ open, value, onChange, onClose }: { open: boolean; value: string; onChange: (value: string) => void; onClose: () => void }) {
  return (
    <>
      <div className={["fixed inset-0 bg-[#07111f]/80 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0"].join(" ")} onClick={onClose} />
      <aside className={["fixed right-0 top-0 flex h-screen w-full max-w-2xl flex-col border-l border-[#263547] bg-[#0d1b2b] transition-transform duration-300", open ? "translate-x-0" : "translate-x-full"].join(" ")}>
        <div className="flex items-center justify-between border-b border-[#263547] p-4">
          <div>
            <div className="font-semibold">Raw session JSON</div>
            <div className="mt-1 text-sm text-[#9fb0c8]">Advanced edit/import surface</div>
          </div>
          <button aria-label="Close raw JSON drawer" className="rounded-md p-2 text-[#9fb0c8] hover:bg-[#101f31]" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea className="flex-1 resize-none bg-black p-4 font-mono text-xs leading-5 text-[#d4e4fa] outline-none" value={value} onChange={(event) => onChange(event.target.value)} />
      </aside>
    </>
  );
}

function typedDemoEntries() {
  return Object.entries(demos) as Array<[Exclude<DemoKind, "custom">, (typeof demos)[Exclude<DemoKind, "custom">]]>;
}

function summarizeFixture(fixture: JsonRecord | null) {
  const events = Array.isArray(fixture?.events) ? fixture.events : [];
  const expectedFacts = Array.isArray(fixture?.expectedFacts) ? fixture.expectedFacts : [];
  const rawText = events.map((event: JsonRecord) => String(event?.content ?? "")).join("\n\n");
  return {
    eventCount: events.length,
    factCount: expectedFacts.length,
    rawTokens: events.length ? estimateTokens(rawText) : "-"
  };
}

function normalizeRunOutput(result: JsonRecord, sessionId: string, fixture: JsonRecord): JsonRecord {
  if (result.contextPackage) {
    return {
      kind: "customer_support",
      sessionId,
      contextPackage: result.contextPackage,
      runtimeContext: result.contextPackage.runtimeContext,
      plan: result.contextPackage.compactionPlan,
      metrics: result.contextPackage.metrics
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
    }
  };
}

function fixtureUseCase(fixture: JsonRecord): "customer_support" | "generic" {
  return fixture.events?.some((event: JsonRecord) => event.metadata?.useCase === "customer_support") ? "customer_support" : "generic";
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function candidateLabel(candidate: string) {
  const labels: Record<string, string> = {
    generic_summary: "Generic summary",
    compaction_orchestrator: "Compaction Orchestrator"
  };
  return labels[candidate] ?? candidate;
}
