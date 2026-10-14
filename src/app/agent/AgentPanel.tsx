'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, Wrench, FileText, Brain, AlertTriangle, CheckCircle2, Bot, Tag, Users, Package } from 'lucide-react';

type AgentStep = {
  id: string;
  kind: 'tool_call' | 'tool_result' | 'reasoning' | 'draft_created' | 'error';
  tool?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  note?: string;
  timestamp: string;
};

type AgentResponse = {
  ok: boolean;
  run_id: string;
  status: string;
  fallback_used: boolean;
  drafts_created: number;
  steps: AgentStep[];
  error?: string;
};

const STEP_META: Record<AgentStep['kind'], { icon: typeof Brain; color: string; label: string }> = {
  reasoning: { icon: Brain, color: 'var(--color-info)', label: 'Reasoning' },
  tool_call: { icon: Wrench, color: 'var(--color-accent)', label: 'Tool call' },
  tool_result: { icon: CheckCircle2, color: 'var(--color-success)', label: 'Tool result' },
  draft_created: { icon: FileText, color: 'var(--color-primary)', label: 'Draft created' },
  error: { icon: AlertTriangle, color: 'var(--color-destructive)', label: 'Error' },
};

function toolIcon(tool?: string) {
  if (!tool) return Wrench;
  if (tool.includes('customer_profile')) return Users;
  if (tool.includes('customer_orders')) return Package;
  if (tool.includes('at_risk')) return AlertTriangle;
  if (tool.includes('draft')) return FileText;
  if (tool.includes('tag')) return Tag;
  return Wrench;
}

export function AgentPanel({ hasApiKey }: { hasApiKey: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function runAgent() {
    setRunning(true);
    setResult(null);
    setError(null);
    setVisibleSteps(0);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus: 'at-risk' }),
      });
      const json = (await res.json()) as AgentResponse;
      setResult(json);
      if (json.ok) router.refresh();
      if (!json.ok) {
        setError(json.error ?? 'Agent run failed.');
      }
      // Progressive reveal of steps for a live-feeling activity panel.
      const total = json.steps.length;
      let i = 0;
      const tick = () => {
        i += 1;
        setVisibleSteps(i);
        if (i < total) {
          window.setTimeout(tick, Math.max(60, Math.min(220, 1800 / Math.max(total, 1))));
        }
      };
      tick();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setRunning(false);
    }
  }

  const steps = result?.steps.slice(0, visibleSteps) ?? [];

  return (
    <div className="space-y-6">
      {/* Run controls */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted mb-1">
              <Bot className="w-4 h-4 text-primary" /> Retention Agent
            </div>
            <p className="text-sm text-foreground max-w-xl">
              The agent inspects at-risk and high-value customers using live tools, decides what
              outreach fits, and creates personalised drafts. It never sends anything — you approve
              in the queue.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`segment-chip ${hasApiKey ? 'segment-chip--active' : 'segment-chip--at-risk'}`}>
                {hasApiKey ? 'Gemini live (function calling)' : 'Fallback mode (no GEMINI_API_KEY)'}
              </span>
              <span className="segment-chip segment-chip--new">max 8 tool rounds</span>
              <span className="segment-chip segment-chip--vip">zod-validated tool args</span>
              <span className="segment-chip segment-chip--churned">human approval gate</span>
            </div>
          </div>
          <button
            type="button"
            onClick={runAgent}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-bold hover:brightness-110 border border-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 shadow-sm"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Running agent…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Run Retention Agent
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 banner border-destructive/30 text-destructive">
            {error}
          </div>
        )}
        {result && result.ok && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="kpi-card">
              <span className="kpi-card__label">Drafts created</span>
              <span className="kpi-card__value">{result.drafts_created}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label">Mode</span>
              <span className="kpi-card__value text-base">{result.fallback_used ? 'Fallback templates' : 'Gemini function calling'}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label">Next step</span>
              <a href="/communications" className="kpi-card__value text-base text-primary hover:underline">Review drafts →</a>
            </div>
          </div>
        )}
      </div>

      {/* Agent activity panel */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Agent activity
          </h3>
          {result && (
            <span className="text-xs text-muted font-mono">{result.run_id}</span>
          )}
        </div>
        <div className="p-4 space-y-3 min-h-[160px]">
          {!result && !running && (
            <div className="py-10 text-center text-sm text-muted">
              Hit “Run Retention Agent” to watch its tool calls live.
            </div>
          )}
          {running && steps.length === 0 && (
            <div className="py-10 text-center text-sm text-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Contacting agent…
            </div>
          )}
          {steps.map((step) => {
            const meta = STEP_META[step.kind];
            const Icon = step.kind === 'tool_call' ? toolIcon(step.tool) : meta.icon;
            return (
              <div
                key={step.id}
                className="flex gap-3 rounded-md border border-border bg-surface-2/60 p-3"
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 border"
                  style={{ backgroundColor: `${meta.color}1a`, borderColor: `${meta.color}40`, color: meta.color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                      {step.tool ? `${meta.label}: ${step.tool}` : meta.label}
                    </span>
                    <span className="text-xs text-muted font-mono">
                      {new Date(step.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
                    </span>
                  </div>
                  {step.note && <p className="text-sm text-foreground mt-1">{step.note}</p>}
                  {step.input && Object.keys(step.input).length > 0 && (
                    <pre className="mt-1.5 text-xs text-muted bg-background/60 border border-border rounded p-2 overflow-x-auto">
                      {JSON.stringify(step.input, null, 1)}
                    </pre>
                  )}
                  {step.output !== undefined && step.kind === 'tool_result' && (
                    <pre className="mt-1.5 text-xs text-success/90 bg-background/60 border border-border rounded p-2 overflow-x-auto max-h-36">
                      {JSON.stringify(step.output, null, 1)}
                    </pre>
                  )}
                  {step.output !== undefined && step.kind === 'draft_created' && (
                    <p className="text-xs text-muted mt-1">
                      {(step.output as { id?: string })?.id ? `Draft ${(step.output as { id: string }).id} queued for approval.` : ''}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {result && visibleSteps >= result.steps.length && result.steps.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Run complete — {result.drafts_created} draft(s) created and queued for human approval.
              <a href="/communications" className="ml-auto underline hover:no-underline">Open queue →</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
