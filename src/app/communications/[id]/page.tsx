import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Sidebar, Topbar } from '@/components/Layout';
import { StatusPill, Skeleton } from '@/components/ui';
import { ActionButtons } from './ActionButtons';
import { ArrowLeft, User, Sparkles, Send, FileText, Clock } from 'lucide-react';
import { communicationService } from '@/services';

export const instant = false;

export default function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Suspense fallback={<DetailSkeleton />}>
          <MessageDetailContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-6">
      <Skeleton className="h-10 w-72" />
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

async function MessageDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const message = await communicationService.getById(id);

  if (!message) {
    notFound();
  }

  return (
    <>
      <Topbar
        title="Review message"
        actions={
          <a
            href="/communications"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to queue
          </a>
        }
      />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-6 lg:col-span-2 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={message.status} />
              {message.created_by === 'agent' && (
                <span className="segment-chip segment-chip--vip"><Sparkles className="w-3 h-3" /> AI drafted</span>
              )}
              {message.template && <span className="segment-chip segment-chip--new">{message.template.replace('_', ' ')}</span>}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Subject</div>
              <h2 className="text-xl font-bold text-foreground">{message.subject}</h2>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Body</div>
              <div className="rounded-md border border-border bg-surface-2 p-4 text-sm text-foreground whitespace-pre-line leading-relaxed">
                {message.body}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {message.customer_id}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Created {new Date(message.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {message.sent_at && (
                <span className="flex items-center gap-1"><Send className="w-3.5 h-3.5" /> Sent (simulated) {new Date(message.sent_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>

            {message.status !== 'sent' && message.status !== 'rejected' && (
              <div className="pt-4 border-t border-border">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Human approval required</div>
                <div className="flex flex-wrap gap-3">
                  <ActionButtons id={message.id} status={message.status} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {message.reason && (
              <div className="card p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Why this draft was created
                </div>
                <p className="text-sm text-foreground leading-relaxed italic">“{message.reason}”</p>
              </div>
            )}
            <div className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Workflow
              </div>
              <ol className="space-y-2 text-sm text-muted">
                <li className={message.status !== 'rejected' ? 'text-success' : 'text-destructive'}>
                  1. Drafted {message.created_by === 'agent' ? 'by Retention Agent' : 'manually'} → status <strong>draft</strong>
                </li>
                <li className={['approved', 'sent'].includes(message.status) ? 'text-success' : message.status === 'rejected' ? 'text-destructive' : ''}>
                  2. Human approves → status <strong>approved</strong>
                </li>
                <li className={message.status === 'sent' ? 'text-success' : ''}>
                  3. Send (simulated) → status <strong>sent</strong>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
