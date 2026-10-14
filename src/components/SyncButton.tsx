'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

type SyncResult = {
  ok: boolean;
  mode?: string;
  customersImported?: number;
  ordersImported?: number;
  customersUpdated?: number;
  ordersUpdated?: number;
  note?: string;
  error?: string;
};

export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'mock' }),
      });
      const json = (await res.json()) as SyncResult;
      setResult(json);
      if (json.ok) router.refresh();
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md bg-primary/10 text-primary border border-primary/20 px-4 py-2 text-sm font-semibold hover:bg-primary/20 transition-all active:scale-[0.98] disabled:opacity-60"
      >
        <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Syncing…' : 'Sync from WooCommerce'}
      </button>
      {result && (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${result.ok ? 'text-success' : 'text-destructive'}`}
          role="status"
        >
          {result.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {result.ok
            ? `${result.note ?? 'Sync complete'} ${result.customersImported ?? 0} new customers, ${result.ordersImported ?? 0} new orders; ${result.customersUpdated ?? 0} customers and ${result.ordersUpdated ?? 0} orders refreshed`
            : result.error ?? 'Sync failed'}
        </span>
      )}
    </div>
  );
}
