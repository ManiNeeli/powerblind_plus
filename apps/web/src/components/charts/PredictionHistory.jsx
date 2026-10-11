import { cn } from '../../lib/utils';
import { Badge } from '../ui/index.jsx';

const LABEL_HEX = {
  Theft:       'var(--color-risk-theft)',
  FaultyMeter: 'var(--color-risk-fault)',
  CommFailure: 'var(--color-risk-comm)',
  Normal:      'var(--color-risk-normal)',
};

/**
 * Timeline of past predictions for a consumer.
 */
export default function PredictionHistory({ predictions = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({length:3}).map((_,i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-canvas border border-surface-border animate-pulse">
            <div className="w-2 h-2 rounded-full bg-surface-border shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-surface-border rounded w-24" />
              <div className="h-2.5 bg-surface-border rounded w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!predictions.length) {
    return <p className="text-sm text-ink-muted text-center py-6">No prediction history yet. Run a prediction to get started.</p>;
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-surface-border" />

      <div className="space-y-3 pl-6">
        {predictions.map((p, i) => {
          const hex = LABEL_HEX[p.predictedLabel] ?? '#8b949e';
          return (
            <div key={p.id} className={cn(
              'relative p-3 rounded-lg border transition-colors',
              i === 0 ? 'border-accent/30 bg-accent/5' : 'border-surface-border bg-canvas hover:bg-surface',
            )}>
              {/* Timeline dot */}
              <div className="absolute -left-[18px] top-4 w-3 h-3 rounded-full border-2 border-canvas"
                   style={{ background: hex }} />

              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge label={p.predictedLabel} />
                  {p.predictedSubtype && (
                    <span className="text-2xs font-mono text-ink-muted">{p.predictedSubtype}</span>
                  )}
                  {i === 0 && <span className="text-2xs text-accent font-semibold">Latest</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold font-mono" style={{ color: hex }}>
                    {(p.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="text-2xs font-mono text-ink-muted">
                    {p.source === 'fallback' ? '⚠ fallback' : p.modelVersion}
                  </span>
                </div>
              </div>

              <p className="text-2xs text-ink-secondary mt-1.5 line-clamp-2">
                {p.recommendation?.slice(0, 140)}{p.recommendation?.length > 140 ? '…' : ''}
              </p>

              <p className="text-2xs text-ink-muted mt-1.5">
                {new Date(p.createdAt).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
