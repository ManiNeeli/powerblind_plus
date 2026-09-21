import React from 'react';

/**
 * Horizontal stacked bar showing multi-class probability breakdown with smooth animations.
 */
const COLORS = {
  Theft:       { bg: '#ff3b5c', glow: 'rgba(255, 59, 92, 0.4)' },
  FaultyMeter: { bg: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  CommFailure: { bg: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' },
  Normal:      { bg: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
};

const ORDER = ['Theft', 'FaultyMeter', 'CommFailure', 'Normal'];

export default function ClassProbBar({ probabilities = {} }) {
  if (!probabilities || !Object.keys(probabilities).length) return null;

  // Ensure all 4 classes are represented in ordered entries
  const entries = ORDER.map(k => ({
    label: k,
    prob: typeof probabilities[k] === 'number' ? probabilities[k] : 0,
    color: COLORS[k]?.bg || '#8b949e',
    glow: COLORS[k]?.glow || 'rgba(139, 148, 158, 0.3)',
  }));

  const total = entries.reduce((sum, e) => sum + e.prob, 0);

  return (
    <div className="space-y-2.5">
      {/* Stacked Animated Bar */}
      <div className="flex h-3.5 rounded-full overflow-hidden w-full bg-surface-border/60 p-[1.5px] shadow-inner">
        {entries.map(({ label, prob, color, glow }) => {
          const pct = total > 0 ? (prob / total) * 100 : 0;
          if (pct <= 0) return null;

          return (
            <div
              key={label}
              style={{
                width: `${pct.toFixed(2)}%`,
                background: color,
                boxShadow: `0 0 8px ${glow}`,
              }}
              className="h-full transition-all duration-700 ease-out relative group first:rounded-l-full last:rounded-r-full"
              title={`${label}: ${(prob * 100).toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Legend with Interactive Hover & Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {entries.map(({ label, prob, color }) => {
          const pct = (prob * 100).toFixed(1);
          const isDominant = prob >= 0.5;

          return (
            <div
              key={label}
              className={`flex items-center justify-between px-2.5 py-1 rounded-lg border transition-all duration-200 ${
                isDominant
                  ? 'bg-surface border-surface-borderLight shadow-sm'
                  : 'bg-surface/30 border-surface-border/60 opacity-80'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span className="text-[11px] text-ink-secondary truncate">{label}</span>
              </div>
              <span
                className="text-[11px] font-mono font-bold ml-1 shrink-0"
                style={{ color: isDominant ? color : undefined }}
              >
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
