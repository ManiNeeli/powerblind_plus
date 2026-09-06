import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Skeleton, ErrorAlert } from '../ui/index.jsx';

const CLASS_COLORS = { Normal:'#22c55e', Theft:'#ef4444', FaultyMeter:'#f59e0b', CommFailure:'#6366f1' };
const CLASSES = ['Normal','Theft','FaultyMeter','CommFailure'];

/**
 * Global SHAP feature importance fetched from /api/model/shap.
 * Shows top 8 features per class as horizontal bars.
 */
export default function GlobalSHAP({ className = '' }) {
  const [activeClass, setActiveClass] = useState('Theft');
  const { data, loading, error } = useApi('/api/model/shap');

  if (loading) return <Skeleton className={`h-64 w-full ${className}`} />;
  if (error)   return <ErrorAlert message={`SHAP data unavailable: ${error}`} className={className} />;
  if (!data)   return null;

  const classData = data[activeClass];
  if (!classData) return null;

  const sorted  = Object.entries(classData).sort((a,b) => b[1]-a[1]).slice(0, 10);
  const maxVal  = sorted[0]?.[1] || 1;
  const color   = CLASS_COLORS[activeClass];

  return (
    <div className={className}>
      {/* Class tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {CLASSES.map(cls => (
          <button key={cls} onClick={() => setActiveClass(cls)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              activeClass === cls
                ? 'text-white border-transparent'
                : 'text-ink-secondary border-surface-border hover:bg-surface hover:text-ink-primary'
            }`}
            style={activeClass === cls ? { background: CLASS_COLORS[cls], borderColor: CLASS_COLORS[cls] } : {}}>
            {cls}
          </button>
        ))}
      </div>

      {/* Bars */}
      <div className="space-y-2">
        {sorted.map(([feat, val]) => (
          <div key={feat} className="flex items-center gap-3">
            <span className="text-2xs font-mono text-ink-secondary truncate" style={{ width: 160 }}
                  title={feat}>{feat}</span>
            <div className="flex-1 h-3 bg-surface-border rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width:`${(val/maxVal)*100}%`, backgroundColor: color, opacity: 0.8 }} />
            </div>
            <span className="text-2xs font-mono text-ink-muted w-12 text-right">{val.toFixed(4)}</span>
          </div>
        ))}
      </div>
      <p className="text-2xs text-ink-muted mt-3">
        Mean |SHAP| value — higher = more influential for predicting {activeClass}.
      </p>
    </div>
  );
}
