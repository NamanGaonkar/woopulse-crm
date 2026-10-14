'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Check, X, Loader2 } from 'lucide-react';

export function ActionButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: 'approve' | 'reject' | 'send') {
    setBusy(true);
    try {
      const res = await fetch(`/api/communications/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const destination = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'sent';
        router.push(`/communications?status=${destination}`);
        router.refresh();
        return;
      }
      const json = await res.json().catch(() => null);
      alert(json?.error ?? 'Action failed.');
    } catch {
      alert('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'draft') {
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={() => act('approve')}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 border border-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act('reject')}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
      </>
    );
  }

  if (status === 'approved') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => act('send')}
        className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 border border-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send (simulated)
      </button>
    );
  }

  return null;
}
