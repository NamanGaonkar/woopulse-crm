import { Suspense } from 'react';
import { connection } from 'next/server';
import { Sidebar, Topbar } from '@/components/Layout';
import { Table, TableHead, TableHeadCell, TableRow, TableCell, SegmentChip, Avatar, Skeleton } from '@/components/ui';
import { CustomersToolbar } from './CustomersToolbar';
import { SyncButton } from '@/components/SyncButton';
import { customerService } from '@/services';

export const instant = false;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; segment?: string }>;
}) {
  const { q = '', segment = '' } = await searchParams;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Topbar title="Customers" actions={<SyncButton />} />
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <Suspense fallback={<CustomersSkeleton />}>
            <CustomersContent q={q} segment={segment} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function CustomersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

async function CustomersContent({ q, segment }: { q: string; segment: string }) {
  await connection();
  const customers = await customerService.list({
    query: q || undefined,
    segment: segment || undefined,
  });

  return (
    <div className="space-y-4">
      <CustomersToolbar q={q} segment={segment} count={customers.length} />

      <Table empty={<span className="text-muted">No customers found. Hit Sync to load data.</span>}>
        <TableHead>
          <TableHeadCell>Customer</TableHeadCell>
          <TableHeadCell>Email</TableHeadCell>
          <TableHeadCell>Segments</TableHeadCell>
          <TableHeadCell>Orders</TableHeadCell>
          <TableHeadCell align="right">Lifetime value</TableHeadCell>
          <TableHeadCell>Last order</TableHeadCell>
        </TableHead>
        {customers.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <a href={`/customers/${c.id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                <Avatar name={`${c.first_name} ${c.last_name}`} size={36} />
                <div>
                  <div className="font-medium text-foreground">{c.first_name} {c.last_name}</div>
                  <div className="text-xs text-muted">{c.tags.slice(0, 2).join(', ') || 'No tags'}</div>
                </div>
              </a>
            </TableCell>
            <TableCell className="text-muted">{c.email}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1.5">
                {c.segments.map((s) => (
                  <SegmentChip key={s} segment={s} />
                ))}
              </div>
            </TableCell>
            <TableCell className="font-medium">{c.order_count}</TableCell>
            <TableCell align="right" className="font-medium">₹{c.lifetime_value.toLocaleString('en-IN')}</TableCell>
            <TableCell className="text-muted">
              {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
