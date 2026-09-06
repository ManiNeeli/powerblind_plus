import { cn } from '../../lib/utils';

export default function PageShell({ title, subtitle, actions, children, className }) {
  return (
    <div className={cn('flex flex-col min-h-full', className)}>
      <header className="flex items-start justify-between gap-4 px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 border-b border-surface-border shrink-0 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-ink-primary">{title}</h1>
          {subtitle && <p className="text-xs text-ink-secondary mt-0.5">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </header>
      <div className="flex-1 p-4 sm:p-6">{children}</div>
    </div>
  );
}
