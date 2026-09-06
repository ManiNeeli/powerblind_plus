import { X, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_CLS = {
  Theft:'badge-theft', FaultyMeter:'badge-fault', CommFailure:'badge-comm', Normal:'badge-normal',
  CONFIRMED:'badge-theft', FALSE_POSITIVE:'badge-normal', QUEUED:'badge-comm',
  ADMIN:'badge-comm', OPERATOR:'badge-normal', Active:'badge-normal', Locked:'badge-theft',
  Unreviewed:'badge-comm',
};
export function Badge({ label, className }) {
  return <span className={cn('badge', BADGE_CLS[label] ?? 'badge-comm', className)}>{label}</span>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className, style }) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden="true" />;
}
export function SkeletonRows({ cols = [60,80,70,60,50], rows = 8 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {cols.map((w, j) => (
        <td key={j} className="px-4 py-3 border-b border-surface-border/50">
          <Skeleton style={{ width:`${w}%`, height:13 }} />
        </td>
      ))}
    </tr>
  ));
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 'max-w-sm' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
         role="dialog" aria-modal="true" aria-labelledby="modal-title"
         onClick={onClose}>
      <div className={cn('w-full card p-6 animate-slide-up', width)} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="modal-title" className="text-sm font-semibold text-ink-primary">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-ink-muted hover:text-ink-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, colorClass, loading, sub }) {
  return (
    <div className="stat-card" role="figure" aria-label={label}>
      <div className="flex items-center justify-between">
        <span className="stat-card-label">{label}</span>
        {Icon && <Icon className={cn('w-4 h-4', colorClass)} aria-hidden />}
      </div>
      {loading
        ? <Skeleton className="h-7 w-24 mt-1" />
        : <span className={cn('stat-card-value', colorClass)}>{value ?? '—'}</span>}
      {sub && !loading && <span className="text-[10px] text-ink-secondary mt-0.5">{sub}</span>}
    </div>
  );
}

// ── FormField ─────────────────────────────────────────────────────────────────
export function FormField({ label, hint, error, children, htmlFor }) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="block text-[10px] font-semibold uppercase tracking-wider text-ink-secondary mb-1.5">
          {label}
        </label>
      )}
      {children}
      {hint  && <p className="text-[10px] text-ink-muted mt-1">{hint}</p>}
      {error && <p className="text-[10px] text-red-400 mt-1" role="alert">{error}</p>}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-md px-3 py-2 text-sm outline-none transition-colors',
        'bg-canvas border border-surface-border text-ink-primary placeholder-ink-muted',
        'focus:border-accent/60 focus:ring-1 focus:ring-accent/30',
        className,
      )}
      {...props}
    />
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
const BTN = {
  primary: 'bg-accent text-[#0d1117] hover:bg-[#009e80] active:scale-[0.98]',
  danger:  'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
  ghost:   'bg-transparent text-ink-secondary border border-surface-border hover:bg-surface hover:text-ink-primary',
  accent:  'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20',
};
export function Button({ variant = 'primary', className, disabled, loading, icon: Icon, children, ...props }) {
  const { Loader2 } = require('lucide-react');
  return (
    <button disabled={disabled || loading}
      className={cn('flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed', BTN[variant], className)}
      {...props}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center" role="status">
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
          <Icon className="w-5 h-5 text-ink-muted" aria-hidden />
        </div>
      )}
      <p className="text-sm font-medium text-ink-secondary">{title}</p>
      {sub    && <p className="text-xs text-ink-muted max-w-xs">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ── ErrorAlert ────────────────────────────────────────────────────────────────
export function ErrorAlert({ message, className }) {
  if (!message) return null;
  return (
    <div role="alert" className={cn('flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400', className)}>
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      {message}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
import { ChevronLeft, ChevronRight } from 'lucide-react';
export function Pagination({ page, totalPages, total, onPrev, onNext, limit }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between px-5 py-3 border-t border-surface-border">
      <p className="text-xs text-ink-secondary">
        Page {page} of {totalPages}
        {total != null && <span className="text-ink-muted"> · {total.toLocaleString()} total</span>}
      </p>
      <div className="flex gap-1">
        <button onClick={onPrev} disabled={page <= 1} aria-label="Previous page"
          className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={onNext} disabled={page >= totalPages} aria-label="Next page"
          className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ label }) {
  if (!label) return <hr className="border-surface-border my-4" />;
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-surface-border" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
      <div className="flex-1 border-t border-surface-border" />
    </div>
  );
}
