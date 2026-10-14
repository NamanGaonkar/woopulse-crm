'use client';

import { Input, Select } from '@/components/ui';

export function CustomersToolbar({
  q,
  segment,
  count,
}: {
  q: string;
  segment: string;
  count: number;
}) {
  const segments = [
    { value: '', label: 'All segments' },
    { value: 'new', label: 'New' },
    { value: 'active', label: 'Active' },
    { value: 'vip', label: 'VIP' },
    { value: 'at-risk', label: 'At-risk' },
    { value: 'churned', label: 'Churned' },
  ];

  function go(params: { q?: string; segment?: string }) {
    const url = new URL(window.location.href);
    if (params.q !== undefined) {
      if (params.q) url.searchParams.set('q', params.q);
      else url.searchParams.delete('q');
    }
    if (params.segment !== undefined) {
      if (params.segment) url.searchParams.set('segment', params.segment);
      else url.searchParams.delete('segment');
    }
    window.location.href = url.pathname + url.search;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="search"
        placeholder="Search by name, email, or tag..."
        defaultValue={q}
        className="w-72"
        onChange={(e) => go({ q: e.target.value })}
      />
      <Select value={segment} onChange={(e) => go({ segment: e.target.value })} className="w-44">
        {segments.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </Select>
      <div className="ml-auto text-sm text-muted">{count} customers</div>
    </div>
  );
}
