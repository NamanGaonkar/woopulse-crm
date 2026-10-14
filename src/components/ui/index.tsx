import Link from 'next/link';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
  type PropsWithChildren,
  forwardRef,
} from 'react';

// ---- Button -----------------------------------------------------------------

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' }
>(function Button({ className = '', variant = 'primary', children, disabled, ...props }, ref) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:
      'bg-primary text-primary-foreground shadow-sm hover:brightness-110 active:scale-[0.98] border border-primary/20',
    secondary:
      'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 active:scale-[0.98]',
    ghost:
      'bg-transparent text-foreground hover:bg-surface-2 border border-transparent hover:border-border active:scale-[0.98]',
    destructive:
      'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 active:scale-[0.98]',
  };
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
});
Button.displayName = 'Button';

// ---- Input -----------------------------------------------------------------

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className}`}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

// ---- Select -----------------------------------------------------------------

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={`select-control flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-[border-color,box-shadow,background-color,transform] duration-200 hover:border-primary/50 focus:scale-[1.01] active:scale-[0.99] appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

// ---- Card -------------------------------------------------------------------

export const Card = forwardRef<HTMLDivElement, PropsWithChildren<{ className?: string }>>(function Card({ children, className = '', ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`rounded-md border border-border bg-surface ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, PropsWithChildren<{ className?: string }>>(function CardHeader({ children, className = '', ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`flex items-center justify-between gap-4 rounded-t-md border-b border-border px-5 py-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
CardHeader.displayName = 'CardHeader';

export const CardBody = forwardRef<HTMLDivElement, PropsWithChildren<{ className?: string }>>(function CardBody({ children, className = '', ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`px-5 py-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
CardBody.displayName = 'CardBody';

// ---- Badge / Chip ----------------------------------------------------------

export const Badge = forwardRef<
  HTMLSpanElement,
  { children: ReactNode; variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'muted' }
>(function Badge({ children, variant = 'default' }, ref) {
  const variants = {
    default: 'bg-surface-2 text-foreground border-border',
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    muted: 'bg-surface text-muted border-border',
  };
  return (
    <span
      ref={ref}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]}`}
    >
      {children}
    </span>
  );
});
Badge.displayName = 'Badge';

// ---- Status & segment chips (styling is in globals.css) --------------------

export function StatusPill({ status }: { status: string }) {
  const cls = `status-pill status-pill--${status}`;
  return <span className={cls}>{status}</span>;
}

export function SegmentChip({ segment }: { segment: string }) {
  const cls = `segment-chip segment-chip--${segment}`;
  return <span className={cls}>{segment}</span>;
}

// ---- Avatar -----------------------------------------------------------------

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const sizeCls = size >= 48 ? 'text-lg' : size >= 32 ? 'text-base' : 'text-sm';
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-surface-2 border border-border text-${sizeCls} font-semibold shrink-0`}
      style={{ width: size, height: size, fontSize: size >= 48 ? 16 : size >= 32 ? 13 : 11 }}
    >
      {initials}
    </div>
  );
}

// ---- KPI card --------------------------------------------------------------

export function KPICard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { label: string; positive: boolean };
}) {
  return (
    <div className="kpi-card">
      <span className="kpi-card__label">{label}</span>
      <span className="kpi-card__value">{value}</span>
      {sub && <span className="kpi-card__sub">{sub}</span>}
      {trend && (
        <span
          className={`kpi-card__sub ${trend.positive ? 'text-success' : 'text-destructive'}`}
        >
          {trend.label}
        </span>
      )}
    </div>
  );
}

// ---- Skeleton --------------------------------------------------------------

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

// ---- Table (headless-ish) --------------------------------------------------

export const Table = forwardRef<
  HTMLTableElement,
  {
    children?: ReactNode;
    className?: string;
    empty?: ReactNode;
  }
>(function Table({ children, className = '', empty }, ref) {
  if (!children) {
    return (
      <div className={`card p-8 text-center text-muted text-sm ${className}`}>
        {empty ?? 'No data.'}
      </div>
    );
  }
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table ref={ref} className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  );
});
Table.displayName = 'Table';

export function TableHead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <thead className={`${className}`}>
      <tr className="border-b border-border">
        {children}
      </tr>
    </thead>
  );
}

export function TableHeadCell({
  children,
  className = '',
  width,
  align,
}: {
  children?: ReactNode;
  className?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted ${className}`}
      style={{ width, textAlign: align }}
    >
      {children}
    </th>
  );
}

export function TableRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tbody>
      <tr className={`border-b border-border/60 hover:bg-surface-2/60 transition-colors ${className}`}>
        {children}
      </tr>
    </tbody>
  );
}

export function TableCell({
  children,
  className = '',
  align,
}: {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <td className={`px-4 py-3 text-foreground ${className}`} style={{ textAlign: align }}>
      {children}
    </td>
  );
}

// ---- Link-like button for in-app nav ---------------------------------------

export function AppLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`cursor-pointer text-foreground underline-offset-2 hover:text-primary transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}
