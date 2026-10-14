import { Suspense } from 'react';
import { connection } from 'next/server';
import { Sidebar, Topbar } from '@/components/Layout';
import { StatusPill, Skeleton, Badge } from '@/components/ui';
import { CommsToolbar } from './CommsToolbar';
import { MessageSquare, User, Sparkles, Inbox } from 'lucide-react';
import { communicationService } from '@/services';

export const instant = false;

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = '' } = await searchParams;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Topbar title="Communications" />
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <Suspense fallback={<CommsSkeleton />}>
            <CommsContent status={status} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function CommsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

type MessagePayload = {
  id: string;
  customer_id: string;
  template?: string;
  subject: string;
  body: string;
  reason?: string;
  status: 'draft' | 'approved' | 'sent' | 'rejected';
  created_by: 'agent' | 'manual';
  created_at: string;
  sent_at?: string;
};

async function CommsContent({ status }: { status: string }) {
  await connection();
  const allMessages = await communicationService.list();
  const messages = status
    ? allMessages.filter((message) => message.status === status)
    : allMessages;

  const counts = {
    draft: allMessages.filter((m) => m.status === 'draft').length,
    approved: allMessages.filter((m) => m.status === 'approved').length,
    sent: allMessages.filter((m) => m.status === 'sent').length,
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="kpi-card">
          <span className="kpi-card__label">Drafts</span>
          <span className="kpi-card__value">{counts.draft}</span>
          <span className="kpi-card__sub">Awaiting human approval</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Approved</span>
          <span className="kpi-card__value">{counts.approved}</span>
          <span className="kpi-card__sub">Ready to send (simulated)</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Sent</span>
          <span className="kpi-card__value">{counts.sent}</span>
          <span className="kpi-card__sub">Simulated + logged</span>
        </div>
      </div>

      <CommsToolbar status={status} count={messages.length} />

      <div className="space-y-3">
        {messages.length === 0 && (
          <div className="card p-10 text-center">
            <Inbox className="w-10 h-10 mx-auto text-muted mb-3" />
            <div className="text-sm text-muted">No drafts yet</div>
            <div className="text-xs text-muted mt-1">
              Run the Retention Agent after syncing to create personalised drafts for human review.
            </div>
            <a
              href="/agent"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary/10 text-primary border border-primary/20 px-4 py-2 text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Open Retention Agent
            </a>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="card p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{m.subject}</span>
                  <StatusPill status={m.status} />
                  {m.created_by === 'agent' && (
                    <Badge variant="primary"><span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI drafted</span></Badge>
                  )}
                  {m.template && <Badge variant="muted">{m.template.replace('_', ' ')}</Badge>}
                </div>
                <div className="text-xs text-muted mt-1 flex items-center gap-2">
                  <User className="w-3 h-3" />
                  {m.customer_id}
                  <span>·</span>
                  {new Date(m.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a
                  href={`/communications/${m.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface transition-colors"
                >
                  Review <MessageSquare className="w-3 h-3" />
                </a>
              </div>
            </div>
            {m.reason && (
              <div className="text-sm text-muted border-l-2 border-primary/40 pl-3 italic">
                “{m.reason}”
              </div>
            )}
            <p className="text-sm text-foreground/80 line-clamp-3 whitespace-pre-line">{m.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
