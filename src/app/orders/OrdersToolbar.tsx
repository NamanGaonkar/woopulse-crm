'use client';

import { Select } from '@/components/ui';

export function OrdersToolbar({ status, count }: { status: string; count: number }) {
  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'refunded', label: 'Refunded' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={status}
        onChange={(e) => {
          const url = new URL(window.location.href);
          if (e.target.value) url.searchParams.set('status', e.target.value);
          else url.searchParams.delete('status');
          window.location.href = url.pathname + url.search;
        }}
        className="w-44"
      >
        {statusOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      <div className="ml-auto text-sm text-muted">{count} orders</div>
    </div>
  );
}
