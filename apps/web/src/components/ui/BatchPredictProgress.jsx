import { cn } from '../../lib/utils';

/**
 * Progress bar shown during batch prediction runs.
 */
export default function BatchPredictProgress({ progress = 0, total = 0, done = 0, visible = false }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-20 right-4 z-40 w-72 card p-4 animate-slide-up shadow-card-hover">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-ink-primary">Batch Prediction Running</p>
        <span className="text-xs font-mono text-accent">{progress}%</span>
      </div>
      <div className="h-2 bg-surface-border rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-300"
             style={{ width: `${progress}%` }} />
      </div>
      {total > 0 && (
        <p className="text-2xs text-ink-muted mt-1.5">{done} / {total} consumers processed</p>
      )}
    </div>
  );
}
