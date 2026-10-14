import { Suspense } from 'react';
import { connection } from 'next/server';
import { Sidebar, Topbar } from '@/components/Layout';
import { KPICard, Table, TableHead, TableHeadCell, TableRow, TableCell, StatusPill, SegmentChip, Skeleton } from '@/components/ui';
import { ArrowRight } from 'lucide-react';
import { SyncButton } from '@/components/SyncButton';
import { dashboardService } from '@/services';

export const instant = false;

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Topbar title="Dashboard" actions={<SyncButton />} />
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="kpi-card">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

async function DashboardContent() {
  await connection();
  const data = await dashboardService.metrics();

  const { customers, orders, revenue, at_risk_count, segment_breakdown, recent_orders } = data;

  const segments: Array<{ key: string; label: string; color: string }> = [
    { key: 'new', label: 'New', color: 'var(--color-info)' },
    { key: 'active', label: 'Active', color: 'var(--color-success)' },
    { key: 'vip', label: 'VIP', color: 'var(--color-accent)' },
    { key: 'at-risk', label: 'At-risk', color: '#fcd34d' },
    { key: 'churned', label: 'Churned', color: 'var(--color-destructive)' },
  ];

  const maxSegment = Math.max(1, ...Object.values(segment_breakdown));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Customers" value={customers} sub="Across all segments" trend={{ label: 'Live from WooCommerce', positive: true }} />
        <KPICard label="Orders" value={orders} sub="All statuses" trend={{ label: `${at_risk_count} at-risk`, positive: at_risk_count === 0 }} />
        <KPICard label="Revenue" value={`₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} sub="Completed + processing" trend={{ label: 'INR', positive: true }} />
        <KPICard label="At-risk" value={at_risk_count} sub="Needs outreach" trend={{ label: at_risk_count > 0 ? 'Action needed' : 'All clear', positive: at_risk_count === 0 }} />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Segment breakdown</h2>
          <a href="/customers" className="text-xs text-primary hover:underline flex items-center gap-1">
            View customers <ArrowRight className="w-3 h-3" />
          </a>
        </div>
        <div className="space-y-3">
          {segments.map(({ key, label, color }) => {
            const val = segment_breakdown[key as keyof typeof segment_breakdown] ?? 0;
            const pct = Math.round((val / maxSegment) * 100);
            return (
              <div key={key} className="flex items-center gap-4">
                <span className="w-20 text-sm text-muted">{label}</span>
                <div className="flex-1 h-6 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="segment-bar-fill h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-semibold text-foreground">{val}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Recent orders</h2>
          <a href="/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </a>
        </div>
        <Table empty={<span className="text-muted">No orders yet. Hit Sync to load.</span>}>
          <TableHead>
            <TableHeadCell>Order</TableHeadCell>
            <TableHeadCell>Customer</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
            <TableHeadCell align="right">Total</TableHeadCell>
            <TableHeadCell align="right">Date</TableHeadCell>
          </TableHead>
          {recent_orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">#{order.number}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-semibold text-muted">
                    {order.customer.first_name?.[0]}{order.customer.last_name?.[0]}
                  </div>
                  <span>{order.customer.first_name} {order.customer.last_name}</span>
                </div>
              </TableCell>
              <TableCell><StatusPill status={order.financial_status} /></TableCell>
              <TableCell align="right" className="font-medium">₹{Number.parseFloat(order.total).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
              <TableCell align="right" className="text-muted">
                {new Date(order.date_created).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </div>
    </div>
  );
}
