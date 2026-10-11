import { cn } from '../../lib/utils';

/**
 * SHAP-style waterfall / horizontal bar chart.
 * Shows top N features and their direction of impact on the prediction.
 */
export default function XAIWaterfall({ features = [], label = 'Unknown', className }) {
  if (!features.length) return null;

  const maxImpact = Math.max(...features.map(f => Math.abs(f.impact)));

  const COLORS = {
    positive: { bar: 'var(--color-risk-theft)', bg: 'var(--color-risk-theft-muted)',  text: 'var(--color-risk-theft)'  },
    negative: { bar: 'var(--color-risk-normal)', bg: 'var(--color-risk-normal-muted)',  text: 'var(--color-risk-normal)'  },
  };

  return (
    <div className={cn('space-y-2', className)}>
      {features.map((f, i) => {
        const dir     = f.direction === 'positive' ? 'positive' : 'negative';
        const colors  = COLORS[dir];
        const pct     = maxImpact > 0 ? (Math.abs(f.impact) / maxImpact) * 100 : 0;
        const sign    = dir === 'positive' ? '+' : '−';

        return (
          <div key={i} className="group">
            {/* Feature name + value */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xs font-mono text-ink-secondary truncate max-w-[160px]" title={f.description || f.feature}>
                  {f.feature}
                </span>
                {f.description && (
                  <span className="hidden group-hover:inline text-2xs text-ink-muted italic truncate">
                    — {f.description}
                  </span>
                )}
              </div>
              <span className="text-xs font-mono font-bold ml-3 shrink-0" style={{ color: colors.text }}>
                {sign}{(Math.abs(f.impact) * 100).toFixed(0)}%
              </span>
            </div>

            {/* Bar */}
            <div className="relative h-5 rounded overflow-hidden" style={{ background: colors.bg }}>
              <div
                className="absolute top-0 h-full rounded transition-all duration-700 ease-out"
                style={{
                  width:      `${pct}%`,
                  background: colors.bar,
                  opacity:    0.75,
                  [dir === 'positive' ? 'left' : 'right']: 0,
                }}
              />
              {/* Value label */}
              {f.value != null && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs font-mono text-ink-muted">
                  {typeof f.value === 'number' ? f.value.toFixed(2) : f.value}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-1 border-t border-surface-border mt-3">
        <div className="flex items-center gap-3 text-2xs text-ink-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-risk-theft inline-block" />
            Pushes toward anomaly
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-risk-normal inline-block" />
            Pushes toward normal
          </span>
        </div>
      </div>
    </div>
  );
}
