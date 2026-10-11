import React from 'react';
import { cn } from '../../lib/utils';

const LABEL_COLORS = {
  Theft:       { stroke: 'var(--color-risk-theft)', text: 'var(--color-risk-theft)', bg: 'var(--color-risk-theft-muted)', glow: 'var(--color-risk-theft-glow)' },
  FaultyMeter: { stroke: 'var(--color-risk-fault)', text: 'var(--color-risk-fault)', bg: 'var(--color-risk-fault-muted)', glow: 'var(--color-risk-fault-glow)' },
  CommFailure: { stroke: 'var(--color-risk-comm)',  text: 'var(--color-risk-comm)',  bg: 'var(--color-risk-comm-muted)',  glow: 'var(--color-risk-comm-glow)' },
  Normal:      { stroke: 'var(--color-risk-normal)', text: 'var(--color-risk-normal)', bg: 'var(--color-risk-normal-muted)', glow: 'var(--color-risk-normal-glow)' },
};

/**
 * Animated Circular confidence gauge using SVG arc with spring animation and glowing pulses.
 */
export default function ConfidenceGauge({ confidence = 0, label = 'Normal', size = 135 }) {
  const colors  = LABEL_COLORS[label] ?? LABEL_COLORS.Normal;
  const radius  = 46;
  const cx      = size / 2;
  const cy      = size / 2;
  const stroke  = 9;
  const circumf = 2 * Math.PI * radius;
  // Use 75% of circle (270 degrees)
  const arcLen  = circumf * 0.75;
  const filled  = arcLen * Math.min(1.0, Math.max(0, confidence));
  const rotate  = -225; // start at bottom-left

  const pct     = Math.round(confidence * 100);
  const tier    = pct >= 90 ? 'Critical Match' : pct >= 75 ? 'High Confidence' : pct >= 60 ? 'Moderate' : 'Low Confidence';

  return (
    <div className="flex flex-col items-center gap-2 relative select-none">
      {/* Outer ambient glow */}
      <div
        className="absolute inset-0 rounded-full blur-xl opacity-30 pointer-events-none transition-all duration-700 animate-pulse"
        style={{ background: colors.glow }}
      />

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Subtle Outer Pulsing Ring */}
          <circle
            cx={cx} cy={cy} r={radius + 8}
            fill="none" stroke={colors.stroke} strokeWidth="1"
            strokeDasharray="4 6" opacity="0.25"
            className="animate-spin-slow origin-center"
          />

          {/* Background Track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none" stroke="var(--color-surface-border, rgba(0, 0, 0, 0.08))" strokeWidth={stroke}
            strokeDasharray={`${arcLen} ${circumf - arcLen}`}
            strokeDashoffset={circumf * 0.125}
            strokeLinecap="round"
            transform={`rotate(${rotate} ${cx} ${cy})`}
          />

          {/* Filled Animated Arc */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none" stroke={colors.stroke} strokeWidth={stroke}
            strokeDasharray={`${filled} ${circumf - filled}`}
            strokeDashoffset={circumf * 0.125}
            strokeLinecap="round"
            transform={`rotate(${rotate} ${cx} ${cy})`}
            style={{
              transition: 'stroke-dasharray 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              filter: `drop-shadow(0 0 8px ${colors.stroke}aa)`,
            }}
          />
        </svg>

        {/* Center Animated Metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-extrabold font-mono tracking-tight transition-colors duration-500"
            style={{ color: colors.text }}
          >
            {pct}%
          </span>
          <span className="text-[9px] font-mono uppercase tracking-wider text-ink-muted mt-0.5">
            {tier}
          </span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider transition-colors duration-500" style={{ color: colors.text }}>
          {label}
        </p>
        <p className="text-[10px] font-mono text-ink-muted">AI & Physics Model Score</p>
      </div>
    </div>
  );
}
