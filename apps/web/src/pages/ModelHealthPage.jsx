import { useState } from 'react';
import { Activity, RefreshCw, CheckCircle, Loader2, Zap, BarChart2, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useApi, useMutation } from '../hooks/useApi';
import { api } from '../lib/api';
import PageShell from '../components/layout/PageShell';
import { StatCard, Skeleton, ErrorAlert, Badge, EmptyState } from '../components/ui/index.jsx';
import { cn } from '../lib/utils';

const CLASS_COLORS = {
  Normal:      'var(--color-risk-normal)',
  Theft:       'var(--color-risk-theft)',
  FaultyMeter: 'var(--color-risk-fault)',
  CommFailure: 'var(--color-risk-comm)',
};
const CLASSES = ['Normal','Theft','FaultyMeter','CommFailure'];

function MetricBar({ value, color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-ink-muted w-6">{label}</span>
      <div className="flex-1 h-2 bg-surface-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width:`${value*100}%`, backgroundColor: color }} />
      </div>
      <span className="text-2xs font-mono text-ink-primary w-10 text-right">{(value*100).toFixed(1)}%</span>
    </div>
  );
}

function SHAPPanel({ version }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useApi(open ? '/api/model/shap' : null, { skip: !open });

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-hover transition-colors">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-ink-muted" />
          <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
            Global SHAP Feature Importance
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-ink-muted" /> : <ChevronDown className="w-4 h-4 text-ink-muted" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-surface-border">
          {loading && <Skeleton className="h-48 w-full mt-4" />}
          {error && <ErrorAlert message={error} className="mt-4" />}
          {!loading && !error && !data && (
            <p className="text-sm text-ink-muted text-center py-8">
              No SHAP data available. Train the XGBoost model to generate global feature importance.
            </p>
          )}
          {data && Object.entries(data).map(([cls, feats]) => {
            const sorted = Object.entries(feats).sort((a,b) => b[1]-a[1]).slice(0, 8);
            const maxVal = sorted[0]?.[1] || 1;
            return (
              <div key={cls} className="mt-5 first:mt-4">
                <p className="text-xs font-semibold mb-2" style={{ color: CLASS_COLORS[cls] }}>{cls}</p>
                <div className="space-y-1.5">
                  {sorted.map(([feat, val]) => (
                    <div key={feat} className="flex items-center gap-2">
                      <span className="text-2xs font-mono text-ink-secondary truncate" style={{ width:160 }}>{feat}</span>
                      <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width:`${(val/maxVal)*100}%`, backgroundColor: CLASS_COLORS[cls] }} />
                      </div>
                      <span className="text-2xs font-mono text-ink-muted w-12 text-right">{val.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ModelHealthPage() {
  const { toastSuccess, toastError } = useToast();
  const { data, loading, error, refetch } = useApi('/api/model/versions');
  const { mutate, loading: acting } = useMutation();

  const active  = data?.activeVersion;
  const mlOk    = data?.mlService?.status === 'ok';
  const mlMode  = data?.mlService?.mode ?? 'unknown';
  const metrics = active ? (() => { try { return JSON.parse(active.metricsJson); } catch { return null; } })() : null;

  const seedVersion = async () => {
    try {
      await mutate(() => api.post('/api/model/seed-version', {}));
      toastSuccess('Model version seeded.'); refetch();
    } catch (e) { toastError(e.message); }
  };

  const retrain = async () => {
    try {
      const r = await mutate(() => api.post('/api/model/retrain', {}));
      toastSuccess(r.message || 'Retrain triggered.');
    } catch (e) { toastError(e.message); }
  };

  const activate = async (id) => {
    try {
      await mutate(() => api.patch(`/api/model/versions/${id}/activate`, {}));
      toastSuccess('Version activated.'); refetch();
    } catch (e) { toastError(e.message); }
  };

  return (
    <PageShell title="Model Health" subtitle="XGBoost model versioning, SHAP explainability and retraining"
      actions={
        <div className="flex gap-2 flex-wrap">
          {!active && !loading && (
            <button onClick={seedVersion} disabled={acting}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-risk-comm-muted text-risk-comm border border-risk-comm/30 text-sm hover:bg-risk-comm/20 transition-colors disabled:opacity-60">
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Seed v0.3
            </button>
          )}
          <button onClick={retrain} disabled={acting || data?.mlService?.retrain_running}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/10 text-accent border border-accent/30 text-sm hover:bg-accent/20 transition-colors disabled:opacity-60">
            {acting || data?.mlService?.retrain_running
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            {data?.mlService?.retrain_running ? 'Training…' : 'Trigger Retrain'}
          </button>
        </div>
      }>

      <ErrorAlert message={error} className="mb-4" />

      {/* ML Service status */}
      <div className={cn('card p-3 mb-4 flex items-center gap-3 flex-wrap',
        mlOk ? 'border-risk-normal/30' : 'border-risk-fault/30')}>
        <div className={cn('w-2 h-2 rounded-full shrink-0', mlOk ? 'bg-risk-normal animate-pulse-slow' : 'bg-risk-fault')} />
        <span className="text-sm text-ink-secondary">
          ML Service: <span className="font-medium text-ink-primary">{data?.mlService?.status ?? (loading ? '…' : 'unavailable')}</span>
          {data?.mlService?.model && <span className="ml-2 text-2xs font-mono text-ink-muted">({data.mlService.model})</span>}
        </span>
        {mlMode && mlMode !== 'unknown' && (
          <span className={cn('ml-2 badge', mlMode === 'xgboost' ? 'badge-normal' : 'badge-comm')}>
            {mlMode === 'xgboost' ? 'Real XGBoost' : 'Mock Mode'}
          </span>
        )}
        {data?.mlService?.retrain_running && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-risk-fault">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Training in progress…
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-20 rounded-card" />)}</div>
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      ) : !active ? (
        <div className="card p-10">
          <EmptyState icon={Activity} title="No model version seeded yet"
            sub="Click 'Seed v0.3' above or train the real model with the training script." />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active version card */}
          <div className="card p-5 flex items-center gap-4 flex-wrap">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="font-mono font-bold text-ink-primary">{active.version}</p>
                <Badge label="Active" />
                {metrics?.feature_count && (
                  <span className="text-2xs text-ink-muted">{metrics.feature_count} features</span>
                )}
              </div>
              <p className="text-xs text-ink-secondary">Trained {new Date(active.trainedAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Metrics */}
          {metrics && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label:'Accuracy',    value:`${(metrics.accuracy*100).toFixed(1)}%`, colorClass:'text-accent' },
                  { label:'Macro F1',    value:metrics.macro_f1?.toFixed(3),             colorClass:'text-accent' },
                  { label:'CV Accuracy', value:metrics.cv_accuracy ? `${(metrics.cv_accuracy*100).toFixed(1)}%` : '—', colorClass:'text-ink-primary' },
                  { label:'CV Macro F1', value:metrics.cv_macro_f1?.toFixed(3) ?? '—',   colorClass:'text-ink-primary' },
                ].map(s => <StatCard key={s.label} {...s} loading={false} />)}
              </div>

              {/* Per-class */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart2 className="w-4 h-4 text-ink-muted" />
                  <h3 className="text-2xs font-semibold uppercase tracking-wider text-ink-secondary">Per-Class Performance</h3>
                </div>
                <div className="space-y-5">
                  {CLASSES.map(cls => {
                    const m = metrics.per_class?.[cls];
                    if (!m) return null;
                    return (
                      <div key={cls}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: CLASS_COLORS[cls] }} />
                            <span className="text-sm font-medium text-ink-primary">{cls}</span>
                            {m.support && <span className="text-2xs text-ink-muted">({m.support?.toLocaleString()} samples)</span>}
                          </div>
                          <span className="text-2xs font-mono font-bold" style={{ color: CLASS_COLORS[cls] }}>
                            F1: {m.f1?.toFixed(3)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <MetricBar value={m.precision} color={CLASS_COLORS[cls]} label="P" />
                          <MetricBar value={m.recall}    color={CLASS_COLORS[cls]} label="R" />
                          <MetricBar value={m.f1}        color={CLASS_COLORS[cls]} label="F1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confusion matrix */}
              {metrics.confusion_matrix && (
                <div className="card p-5">
                  <h3 className="text-2xs font-semibold uppercase tracking-wider text-ink-secondary mb-4">
                    Confusion Matrix
                    <span className="ml-2 normal-case font-normal text-ink-muted">(rows = actual, cols = predicted)</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full text-center">
                      <thead>
                        <tr>
                          <th className="text-left px-3 py-2 text-ink-muted font-normal text-2xs">Actual ↓ / Predicted →</th>
                          {CLASSES.map(c => <th key={c} className="px-3 py-2 font-semibold" style={{ color: CLASS_COLORS[c] }}>{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {CLASSES.map((cls, r) => {
                          const row      = metrics.confusion_matrix[r];
                          const rowTotal = row?.reduce((a,b) => a+b, 0) || 1;
                          return (
                            <tr key={cls}>
                              <td className="text-left px-3 py-2 font-semibold text-xs" style={{ color: CLASS_COLORS[cls] }}>{cls}</td>
                              {(row ?? []).map((v, c) => {
                                const pct = ((v / rowTotal) * 100).toFixed(0);
                                return (
                                  <td key={c}
                                    className={cn('px-3 py-2 font-mono transition-colors',
                                      r === c ? 'font-bold text-risk-normal bg-risk-normal-muted' : 'text-ink-muted')}
                                    title={`${pct}% of actual ${cls} predicted as ${CLASSES[c]}`}>
                                    {v}
                                    {r === c && <span className="text-2xs ml-1 opacity-60">({pct}%)</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* SHAP panel (lazy loaded) */}
          <SHAPPanel version={active.version} />

          {/* Version history */}
          {data?.versions?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-2xs font-semibold uppercase tracking-wider text-ink-secondary mb-3">Version History</h3>
              <div className="space-y-2">
                {data.versions.map(v => {
                  const m = (() => { try { return JSON.parse(v.metricsJson); } catch { return null; } })();
                  return (
                    <div key={v.id} className="flex items-center gap-3 py-2 border-b border-surface-border/50 last:border-b-0">
                      <span className="font-mono text-xs text-ink-primary">{v.version}</span>
                      {v.isActive && <Badge label="Active" />}
                      {m?.accuracy && <span className="text-2xs text-ink-muted">acc {(m.accuracy*100).toFixed(1)}%</span>}
                      {m?.macro_f1 && <span className="text-2xs text-ink-muted">f1 {m.macro_f1.toFixed(3)}</span>}
                      <span className="ml-auto text-2xs text-ink-muted">{new Date(v.trainedAt).toLocaleDateString()}</span>
                      {!v.isActive && (
                        <button onClick={() => activate(v.id)}
                          className="text-2xs text-accent hover:text-accent-dim transition-colors">
                          Activate
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
