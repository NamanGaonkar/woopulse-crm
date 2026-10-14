import { Suspense } from 'react';
import { connection } from 'next/server';
import { Sidebar, Topbar } from '@/components/Layout';
import { Table, TableHead, TableHeadCell, TableRow, TableCell, StatusPill, Skeleton } from '@/components/ui';
import { OrdersToolbar } from './OrdersToolbar';
import { ExternalLink } from 'lucide-react';
import { orderService } from '@/services';

export const instant = false;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = '' } = await searchParams;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Topbar title="Orders" />
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <Suspense fallback={<OrdersSkeleton />}>
            <OrdersContent status={status} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

async function OrdersContent({ status }: { status: string }) {
  await connection();
  const orders = await orderService.list({
    status: status ? (status as 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded') : undefined,
  });

  return (
    <div className="space-y-4">
      <OrdersToolbar status={status} count={orders.length} />

      <div className="card">
        <Table empty={<span className="text-muted">No orders found. Hit Sync to load data.</span>}>
          <TableHead>
            <TableHeadCell>Order</TableHeadCell>
            <TableHeadCell>Customer</TableHeadCell>
            <TableHeadCell>Items</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
            <TableHeadCell align="right">Total</TableHeadCell>
            <TableHeadCell align="right">Date</TableHeadCell>
            <TableHeadCell align="right"> </TableHeadCell>
          </TableHead>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-medium">#{o.number}</TableCell>
              <TableCell>{o.customer?.first_name} {o.customer?.last_name}</TableCell>
              <TableCell className="text-muted max-w-[240px] truncate">
                {(o.line_items ?? []).map((li) => `${li.name} ×${li.quantity}`).join(', ') || '—'}
              </TableCell>
              <TableCell><StatusPill status={o.financial_status} /></TableCell>
              <TableCell align="right" className="font-medium">
                ₹{Number.parseFloat(o.total).toLocaleString('en-IN')}
              </TableCell>
              <TableCell align="right" className="text-muted">
                {new Date(o.date_created).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </TableCell>
              <TableCell align="right">
                <a
                  href={`/orders/${o.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </div>
    </div>
  );
}
