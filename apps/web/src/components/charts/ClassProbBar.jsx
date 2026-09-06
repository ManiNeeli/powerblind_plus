/**
 * Horizontal stacked bar showing class probability breakdown.
 */
const COLORS = { Theft:'#ef4444', FaultyMeter:'#f59e0b', CommFailure:'#6366f1', Normal:'#22c55e' };
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
      <div className="flex h-3 rounded-full overflow-hidden w-full mb-2">
        {entries.map(({ label, prob }) => (
          <div key={label} style={{ width: `${(prob * 100).toFixed(1)}%`, background: COLORS[label] }}
               title={`${label}: ${(prob*100).toFixed(1)}%`} />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {entries.map(({ label, prob }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[label] }} />
            <span className="text-2xs text-ink-secondary">{label}</span>
            <span className="text-2xs font-mono font-semibold text-ink-primary">
              {(prob * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
