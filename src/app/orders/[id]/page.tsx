import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Sidebar, Topbar } from '@/components/Layout';
import { Table, TableHead, TableHeadCell, TableRow, TableCell, StatusPill, SegmentChip, Avatar, Skeleton } from '@/components/ui';
import { ArrowLeft, Clock, CreditCard, Package, User } from 'lucide-react';
import { orderService } from '@/services';

export const instant = false;

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Suspense fallback={<DetailSkeleton />}>
          <OrderDetailContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

type OrderPayload = {
  id: string;
  number: number;
  order_key: string;
  financial_status: string;
  fulfillment_status?: string;
  payment_method_title: string;
  total: string;
  subtotal: string;
  shipping: string;
  total_tax: string;
  date_created: string;
  date_paid?: string;
  date_completed?: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    segments: string[];
    lifetime_value: number;
    order_count: number;
  };
  line_items: Array<{
    id: string;
    name: string;
    quantity: number;
    subtotal: string;
    total: string;
  }>;
  status_timeline: Array<{
    date_created: string;
    note: string;
    status: string;
    payment_status?: string;
  }>;
};

async function OrderDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();

  const order = await orderService.getById(id);

  if (!order) {
    notFound();
  }

  const fullName = `${order.customer?.first_name ?? ''} ${order.customer?.last_name ?? ''}`.trim() || 'Unknown';

  return (
    <>
      <Topbar
        title={`Order #${order.number}`}
        actions={
          <a
            href="/orders"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to orders
          </a>
        }
      />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order summary */}
          <div className="card p-6 lg:col-span-2 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 border border-primary/20 text-primary">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">Order #{order.number}</div>
                  <div className="text-xs text-muted font-mono">{order.order_key}</div>
                </div>
              </div>
              <StatusPill status={order.financial_status} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="flex items-center gap-2 text-muted">
                <CreditCard className="w-4 h-4" />
                {order.payment_method_title || 'Payment method on file'}
              </div>
              <div className="flex items-center gap-2 text-muted">
                <Clock className="w-4 h-4" />
                Placed {new Date(order.date_created).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Line items */}
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Items</h3>
              <Table empty={<span className="text-muted">No line items.</span>}>
                <TableHead>
                  <TableHeadCell>Product</TableHeadCell>
                  <TableHeadCell align="right">Qty</TableHeadCell>
                  <TableHeadCell align="right">Subtotal</TableHeadCell>
                </TableHead>
                {(order.line_items ?? []).map((li) => (
                  <TableRow key={li.id}>
                    <TableCell>{li.name}</TableCell>
                    <TableCell align="right">{li.quantity}</TableCell>
                    <TableCell align="right" className="font-medium">₹{Number.parseFloat(li.subtotal).toLocaleString('en-IN')}</TableCell>
                  </TableRow>
                ))}
              </Table>

              <div className="mt-4 space-y-1.5 text-sm max-w-xs ml-auto">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span>₹{Number.parseFloat(order.subtotal).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Shipping</span>
                  <span>₹{Number.parseFloat(order.shipping).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Tax</span>
                  <span>₹{Number.parseFloat(order.total_tax).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-2">
                  <span>Total</span>
                  <span>₹{Number.parseFloat(order.total).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: customer + timeline */}
          <div className="space-y-6">
            {/* Customer card */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Customer
              </h3>
              <a href={`/customers/${order.customer?.id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                <Avatar name={fullName} size={44} />
                <div>
                  <div className="font-medium text-foreground">{fullName}</div>
                  <div className="text-xs text-muted">{order.customer?.email}</div>
                </div>
              </a>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(order.customer?.segments ?? []).map((s) => (
                  <SegmentChip key={s} segment={s} />
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted">Lifetime value</div>
                  <div className="font-semibold">₹{(order.customer?.lifetime_value ?? 0).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Orders</div>
                  <div className="font-semibold">{order.customer?.order_count ?? 0}</div>
                </div>
              </div>
            </div>

            {/* Status timeline */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Status timeline
              </h3>
              <ol className="relative space-y-5 border-l border-border ml-2 pl-5">
                {(order.status_timeline ?? []).map((ev, i) => (
                  <li key={i} className="relative">
                    <span
                      className="absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-background"
                      style={{
                        backgroundColor:
                          ev.status === 'completed' ? 'var(--color-success)'
                          : ev.status === 'cancelled' || ev.status === 'refunded' ? 'var(--color-destructive)'
                          : ev.status === 'processing' ? 'var(--color-info)'
                          : 'var(--color-warning)',
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={ev.status} />
                      <span className="text-xs text-muted">
                        {new Date(ev.date_created).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm text-foreground mt-1">{ev.note}</div>
                  </li>
                ))}
                {(order.status_timeline ?? []).length === 0 && (
                  <li className="text-sm text-muted">No timeline events.</li>
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
