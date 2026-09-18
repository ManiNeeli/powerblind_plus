import { X, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_CLS = {
  Theft:'badge-theft', FaultyMeter:'badge-fault', CommFailure:'badge-comm', Normal:'badge-normal',
  CONFIRMED:'badge-theft', FALSE_POSITIVE:'badge-normal', QUEUED:'badge-comm',
  ADMIN:'badge-comm', OPERATOR:'badge-normal', Active:'badge-normal', Locked:'badge-theft',
  Unreviewed:'badge-comm',
};

const BADGE_DOT = {
  Theft:'bg-[#ff3b5c] shadow-[0_0_8px_#ff3b5c]',
  FaultyMeter:'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]',
  CommFailure:'bg-[#6366f1] shadow-[0_0_8px_#6366f1]',
  Normal:'bg-[#10b981] shadow-[0_0_8px_#10b981]',
  CONFIRMED:'bg-[#ff3b5c] shadow-[0_0_8px_#ff3b5c]',
  FALSE_POSITIVE:'bg-[#10b981] shadow-[0_0_8px_#10b981]',
  QUEUED:'bg-[#6366f1] shadow-[0_0_8px_#6366f1]',
  ADMIN:'bg-[#6366f1] shadow-[0_0_8px_#6366f1]',
  OPERATOR:'bg-[#10b981] shadow-[0_0_8px_#10b981]',
  Active:'bg-[#10b981] shadow-[0_0_8px_#10b981]',
  Locked:'bg-[#ff3b5c] shadow-[0_0_8px_#ff3b5c]',
  Unreviewed:'bg-[#6366f1] shadow-[0_0_8px_#6366f1]',
};

export function Badge({ label, className, dot = true }) {
  const dotCls = BADGE_DOT[label] ?? 'bg-accent shadow-glow-accent';
  return (
    <span className={cn('badge inline-flex items-center gap-1.5', BADGE_CLS[label] ?? 'badge-comm', className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 animate-pulse', dotCls)} />}
      <span>{label}</span>
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className, style }) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden="true" />;
}
export function SkeletonRows({ cols = [60,80,70,60,50], rows = 8 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {cols.map((w, j) => (
        <td key={j} className="px-4 py-3 border-b border-surface-border/40">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4"
         role="dialog" aria-modal="true" aria-labelledby="modal-title"
         onClick={onClose}>
      <div className={cn('w-full card-glass p-6 animate-slide-up border border-white/10 shadow-glass', width)} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="modal-title" className="text-sm font-semibold text-ink-primary tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-ink-muted hover:text-ink-primary transition-colors p-1 rounded hover:bg-surface">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── StatCard (Bento Box KPI) ──────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, colorClass, loading, sub }) {
  return (
    <div className="stat-card group hover:border-surface-borderLight transition-all duration-300" role="figure" aria-label={label}>
      <div className="flex items-center justify-between gap-2">
        <span className="stat-card-label">{label}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-surface/80 border border-surface-border flex items-center justify-center group-hover:scale-110 group-hover:border-accent/40 group-hover:bg-accent/10 transition-all duration-300">
            <Icon className={cn('w-4 h-4', colorClass)} aria-hidden />
          </div>
        )}
      </div>
      {loading
        ? <Skeleton className="h-8 w-24 mt-3" />
        : <span className={cn('stat-card-value mt-2', colorClass)}>{value ?? '—'}</span>}
      {sub && !loading && (
        <span className="text-[11px] text-ink-muted mt-1.5 font-medium flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-surface-borderLight" />
          {sub}
        </span>
      )}
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
        'form-input',
        className,
      )}
      {...props}
    />
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
const BTN = {
  primary: 'bg-gradient-to-r from-accent to-[#00d69d] text-[#080c14] font-semibold shadow-glow-accent hover:brightness-105 active:scale-[0.98]',
  danger:  'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50',
  ghost:   'bg-transparent text-ink-secondary border border-surface-border hover:bg-surface hover:text-ink-primary hover:border-surface-borderLight',
  accent:  'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 hover:border-accent/50',
};

export function Button({ variant = 'primary', className, disabled, loading, icon: Icon, children, ...props }) {
  return (
    <button disabled={disabled || loading}
      className={cn('flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed', BTN[variant], className)}
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
        <div className="w-12 h-12 rounded-xl bg-surface/80 border border-surface-border flex items-center justify-center shadow-card">
          <Icon className="w-6 h-6 text-ink-muted" aria-hidden />
        </div>
      )}
      <p className="text-sm font-semibold text-ink-secondary">{title}</p>
      {sub    && <p className="text-xs text-ink-muted max-w-xs">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ── ErrorAlert ────────────────────────────────────────────────────────────────
export function ErrorAlert({ message, className }) {
  if (!message) return null;
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400 backdrop-blur-sm', className)}>
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ page, totalPages, total, onPrev, onNext, limit }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between px-5 py-3.5 border-t border-surface-border/60 bg-surface/30">
      <p className="text-xs text-ink-secondary">
        Page <span className="font-semibold text-ink-primary">{page}</span> of <span className="font-semibold text-ink-primary">{totalPages}</span>
        {total != null && <span className="text-ink-muted"> · {total.toLocaleString()} total</span>}
      </p>
      <div className="flex gap-1.5">
        <button onClick={onPrev} disabled={page <= 1} aria-label="Previous page"
          className="p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface border border-transparent hover:border-surface-border disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={onNext} disabled={page >= totalPages} aria-label="Next page"
          className="p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface border border-transparent hover:border-surface-border disabled:opacity-30 disabled:cursor-not-allowed transition-all">
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
