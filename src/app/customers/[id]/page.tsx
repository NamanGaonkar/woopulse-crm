import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Sidebar, Topbar } from '@/components/Layout';
import { Table, TableHead, TableHeadCell, TableRow, TableCell, StatusPill, SegmentChip, Avatar, Skeleton } from '@/components/ui';
import { ArrowLeft, Mail, Phone, MapPin, Tag as TagIcon, Clock, Package, DollarSign } from 'lucide-react';
import { customerService, orderService } from '@/services';

export const instant = false;

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Suspense fallback={<DetailSkeleton />}>
          <CustomerDetailContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

type CustomerPayload = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_created: string;
  segments: string[];
  tags: string[];
  notes: string[];
  lifetime_value: number;
  order_count: number;
  last_order_at?: string | null;
  billing_address?: {
    address_1?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

type OrderPayload = {
  id: string;
  number: number;
  financial_status: string;
  total: string;
  date_created: string;
  line_items?: Array<{ name: string; quantity: number; subtotal: string }>;
};

async function CustomerDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();

  const customer = await customerService.getById(id);

  if (!customer) {
    notFound();
  }

  const orders = await orderService.list({ customerId: id });

  const fullName = `${customer.first_name} ${customer.last_name}`.trim() || 'Unknown customer';

  return (
    <>
      <Topbar
        title="Customer detail"
        actions={
          <a
            href="/customers"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to customers
          </a>
        }
      />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Profile card */}
        <div className="card p-6">
          <div className="flex flex-wrap items-start gap-5">
            <Avatar name={fullName} size={72} />
            <div className="flex-1 min-w-[240px]">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground">{fullName}</h2>
                {customer.segments.map((s) => (
                  <SegmentChip key={s} segment={s} />
                ))}
              </div>
              <div className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2 lg:grid-cols-3">
                <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> {customer.email}</span>
                {customer.phone && (
                  <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> {customer.phone}</span>
                )}
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Joined {new Date(customer.date_created).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                {customer.billing_address && (
                  <span className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
                    <MapPin className="w-4 h-4 shrink-0" />
                    {[customer.billing_address.address_1, customer.billing_address.city, customer.billing_address.state, customer.billing_address.postcode, customer.billing_address.country].filter(Boolean).join(', ') || 'No address on file'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="kpi-card min-w-[140px]">
                <span className="kpi-card__label">Lifetime value</span>
                <span className="kpi-card__value">₹{customer.lifetime_value.toLocaleString('en-IN')}</span>
              </div>
              <div className="kpi-card min-w-[110px]">
                <span className="kpi-card__label">Orders</span>
                <span className="kpi-card__value">{customer.order_count}</span>
              </div>
            </div>
          </div>

          {customer.tags.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
              <TagIcon className="w-4 h-4 text-muted" />
              {customer.tags.map((t) => (
                <span key={t} className="segment-chip segment-chip--active">{t}</span>
              ))}
            </div>
          )}

          {customer.notes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Notes</h3>
              <ul className="space-y-1.5 text-sm text-foreground">
                {customer.notes.map((n, i) => (
                  <li key={i} className="flex gap-2"><span className="text-muted">—</span>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Order history */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
              <Package className="w-4 h-4" /> Order history
            </h3>
            <span className="text-xs text-muted">{orders.length} orders</span>
          </div>
          <Table empty={<span className="text-muted">No orders for this customer.</span>}>
            <TableHead>
              <TableHeadCell>Order</TableHeadCell>
              <TableHeadCell>Items</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell align="right">Total</TableHeadCell>
              <TableHeadCell align="right">Date</TableHeadCell>
            </TableHead>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <a href={`/orders/${o.id}`} className="hover:text-primary transition-colors">#{o.number}</a>
                </TableCell>
                <TableCell className="text-muted">
                  {(o.line_items ?? []).map((li) => `${li.name} ×${li.quantity}`).join(', ') || '—'}
                </TableCell>
                <TableCell><StatusPill status={o.financial_status} /></TableCell>
                <TableCell align="right" className="font-medium">₹{Number.parseFloat(o.total).toLocaleString('en-IN')}</TableCell>
                <TableCell align="right" className="text-muted">
                  {new Date(o.date_created).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
