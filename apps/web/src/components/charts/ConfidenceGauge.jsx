import { cn } from '../../lib/utils';

const LABEL_COLORS = {
  Theft:       { stroke:'#ff3b5c', text:'#ff3b5c', bg:'rgba(255,59,92,0.15)'   },
  FaultyMeter: { stroke:'#f59e0b', text:'#f59e0b', bg:'rgba(245,158,11,0.15)'  },
  CommFailure: { stroke:'#6366f1', text:'#6366f1', bg:'rgba(99,102,241,0.15)'  },
  Normal:      { stroke:'#10b981', text:'#10b981', bg:'rgba(16,185,129,0.15)'  },
};

/**
 * Circular confidence gauge using SVG arc.
 */
export default function ConfidenceGauge({ confidence = 0, label = 'Normal', size = 120 }) {
  const colors  = LABEL_COLORS[label] ?? LABEL_COLORS.Normal;
  const radius  = 42;
  const cx      = size / 2;
  const cy      = size / 2;
  const stroke  = 8;
  const circumf = 2 * Math.PI * radius;
  // Use 75% of circle (270 degrees)
  const arcLen  = circumf * 0.75;
  const filled  = arcLen * confidence;
  const gap     = arcLen - filled;
  const rotate  = -225; // start at bottom-left

  const pct     = Math.round(confidence * 100);
  const tier    = pct >= 90 ? 'Critical' : pct >= 75 ? 'High' : pct >= 60 ? 'Moderate' : 'Low';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth={stroke}
            strokeDasharray={`${arcLen} ${circumf - arcLen}`}
            strokeDashoffset={circumf * 0.125}
            strokeLinecap="round"
            transform={`rotate(${rotate} ${cx} ${cy})`}
          />
          {/* Filled arc */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none" stroke={colors.stroke} strokeWidth={stroke}
            strokeDasharray={`${filled} ${circumf - filled}`}
            strokeDashoffset={circumf * 0.125}
            strokeLinecap="round"
            transform={`rotate(${rotate} ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.8s ease-out', filter: `drop-shadow(0 0 6px ${colors.stroke}80)` }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold font-mono tracking-tight" style={{ color: colors.text }}>{pct}%</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">{tier}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.text }}>{label}</p>
        <p className="text-[10px] font-mono text-ink-muted">AI Model Confidence</p>
      </div>
    </div>
  );
}
