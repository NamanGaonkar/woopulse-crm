'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Package, MessageSquare, Bot, RefreshCw } from 'lucide-react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/communications', label: 'Communications', icon: MessageSquare },
  { href: '/agent', label: 'Retention Agent', icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar w-56 shrink-0 flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-3 text-foreground hover:text-primary transition-colors"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 border border-primary/20 text-primary text-sm font-bold">
            W
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">WooPulse</div>
            <div className="text-xs text-muted">CRM for WooCommerce</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-foreground hover:bg-surface-2 hover:text-primary border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
          <span>WooPulse CRM — Kilowott hackathon build</span>
        </Link>
      </div>
    </aside>
  );
}

export function Topbar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface/40 px-6 py-4 backdrop-blur-sm">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      {actions}
    </header>
  );
}
