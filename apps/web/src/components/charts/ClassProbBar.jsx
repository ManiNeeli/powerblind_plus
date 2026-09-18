/**
 * Horizontal stacked bar showing class probability breakdown.
 */
const COLORS = { Theft:'#ff3b5c', FaultyMeter:'#f59e0b', CommFailure:'#6366f1', Normal:'#10b981' };
const ORDER  = ['Theft','FaultyMeter','CommFailure','Normal'];

export default function ClassProbBar({ probabilities = {} }) {
  if (!Object.keys(probabilities).length) return null;

  // Sort by our preferred display order
  const entries = ORDER
    .filter(k => probabilities[k] != null)
    .map(k => ({ label: k, prob: probabilities[k] ?? 0 }));

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden w-full mb-3 bg-surface-border/50 p-[1px]">
        {entries.map(({ label, prob }) => (
          <div key={label} style={{ width: `${(prob * 100).toFixed(1)}%`, background: COLORS[label] }}
               className="transition-all duration-500 shadow-sm"
               title={`${label}: ${(prob*100).toFixed(1)}%`} />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {entries.map(({ label, prob }) => (
          <div key={label} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface/50 border border-surface-border">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[label] }} />
            <span className="text-[11px] text-ink-secondary">{label}</span>
            <span className="text-[11px] font-mono font-bold text-ink-primary ml-1">
              {(prob * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
