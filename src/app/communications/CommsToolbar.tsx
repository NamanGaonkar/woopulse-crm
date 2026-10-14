'use client';

import { Select } from '@/components/ui';

export function CommsToolbar({ status, count }: { status: string; count: number }) {
  const statusOptions = [
    { value: '', label: 'All messages' },
    { value: 'draft', label: 'Drafts (needs approval)' },
    { value: 'approved', label: 'Approved (ready to send)' },
    { value: 'sent', label: 'Sent' },
    { value: 'rejected', label: 'Rejected' },
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
        className="w-64"
      >
        {statusOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      <div className="ml-auto text-sm text-muted">{count} messages</div>
    </div>
  );
}
