import { useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { usePageMeta } from '../../hooks/usePageMeta';

export default function PageShell({
  title,
  subtitle,
  actions,
  children,
  className,
  onRefresh,
  showLastUpdated = true,
}) {
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [refreshing, setRefreshing]   = useState(false);

  // Automatically update page title & meta description for SEO
  usePageMeta({
    title,
    description: subtitle || `${title} — PowerBlind+ Grid Analytics and Smart Meter Non-Technical Loss Inspection Console.`,
  });

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setLastUpdated(new Date());
    if (onRefresh) {
      try {
        await onRefresh();
      } catch {
        // Handled in caller
      }
    }
    setTimeout(() => setRefreshing(false), 500);
  };

  const formattedTime = lastUpdated.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className={cn('flex flex-col min-h-full max-w-full overflow-x-hidden', className)}>
      {/* Sticky Sub-Header */}
      <header className="sticky top-14 z-20 flex items-start justify-between gap-4 px-4 sm:px-6 py-4 border-b border-surface-border bg-canvas/80 backdrop-blur-md shrink-0 flex-wrap transition-colors">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-base font-bold text-ink-primary tracking-tight">{title}</h1>
            {showLastUpdated && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface border border-surface-border text-[10px] font-mono text-ink-muted hover:border-accent/40 transition-colors"
                title={`Last updated at ${lastUpdated.toLocaleDateString()} ${formattedTime}`}
              >
                <Clock className="w-3 h-3 text-accent" />
                <span>Synced {formattedTime}</span>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  aria-label="Refresh view data"
                  title="Refresh view data"
                  className="hover:text-accent transition-colors ml-0.5 p-0.5 rounded focus-visible:ring-1 focus-visible:ring-accent"
                >
                  <RefreshCw className={cn('w-2.5 h-2.5', refreshing && 'animate-spin text-accent')} />
                </button>
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </header>

      {/* Main View Area */}
      <div className="flex-1 p-4 sm:p-6 max-w-full overflow-x-hidden">{children}</div>
    </div>
  );
}
