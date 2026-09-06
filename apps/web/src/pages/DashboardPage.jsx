import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Gauge, Wifi, CheckCircle, Zap, Loader2 } from 'lucide-react';
import { useDashboard }       from '../hooks/useDashboard';
import { useBatchPredict }    from '../hooks/usePrediction';
import { useToast }           from '../contexts/ToastContext';
import PageShell              from '../components/layout/PageShell';
import ExportButton           from '../components/ui/ExportButton';
import { StatCard, SkeletonRows, ErrorAlert, Badge, EmptyState } from '../components/ui/index.jsx';
import { cn } from '../lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const LABEL_COLOR = { Theft:'#ef4444', FaultyMeter:'#f59e0b', CommFailure:'#6366f1', Normal:'#22c55e' };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-card-hover">
      <p className="text-ink-secondary mb-1">{label}</p>
      {payload.map(p => <p key={p.dataKey} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>)}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { toastSuccess, toastError }   = useToast();
  const { counts, topRisk, trend, inspectionStats, totalConsumers, loading, error, refetch } = useDashboard();
  const { runBatch, loading: batching, progress } = useBatchPredict();

  const handleBatchPredict = async () => {
    const ids = topRisk.map(c => c.id);
    if (!ids.length) { toastError('No risk consumers to predict on yet.'); return; }
    try {
      const done = await runBatch(ids);
      toastSuccess(`Batch predictions complete: ${done} consumers processed.`);
      refetch();
    } catch (e) { toastError(e.message); }
  };

  const stats = [
    { icon: AlertTriangle, label:'Theft Detected',  value: counts?.Theft?.toLocaleString(),       colorClass:'text-red-400'   },
    { icon: Gauge,         label:'Faulty Meters',   value: counts?.FaultyMeter?.toLocaleString(),  colorClass:'text-amber-400' },
    { icon: Wifi,          label:'Comm Failures',   value: counts?.CommFailure?.toLocaleString(),  colorClass:'text-indigo-400'},
    { icon: CheckCircle,   label:'Normal',          value: counts?.Normal?.toLocaleString(),       colorClass:'text-green-400' },
  ];

  return (
    <PageShell
      title="Grid Overview"
      subtitle={totalConsumers ? `${totalConsumers.toLocaleString()} consumers monitored` : 'Smart meter anomaly detection'}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleBatchPredict} disabled={batching || loading}
            aria-label="Run batch predictions on top-risk consumers"
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/10 text-accent border border-accent/30 text-sm hover:bg-accent/20 transition-colors disabled:opacity-60">
            {batching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{progress}%</> : <><Zap className="w-3.5 h-3.5" />Batch Predict</>}
          </button>
          <ExportButton />
        </div>
      }
    >
      <ErrorAlert message={error} className="mb-5" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {stats.map(s => <StatCard key={s.label} {...s} loading={loading} />)}
      </div>

      {/* Inspection stats */}
      {(inspectionStats || loading) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label:'Total Inspections',   value: inspectionStats?.total,         color:'text-ink-primary' },
            { label:'Confirmed Anomalies', value: inspectionStats?.confirmed,     color:'text-red-400'     },
            { label:'False Positives',     value: inspectionStats?.falsePositive, color:'text-green-400'   },
            { label:'Queued',              value: inspectionStats?.queued,        color:'text-indigo-400'  },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-3">
              <p className="stat-card-label">{label}</p>
              {loading ? <div className="skeleton h-5 w-12 mt-1 rounded" />
                : <p className={cn('text-lg font-bold font-mono', color)}>{value?.toLocaleString() ?? '—'}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-4">
            Anomaly Detections — Last 30 Days
          </h2>
          {loading ? <div className="skeleton h-48 rounded" /> : trend.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <defs>
                  {['Theft','FaultyMeter','CommFailure'].map(k => (
                    <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={LABEL_COLOR[k]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={LABEL_COLOR[k]} stopOpacity={0}   />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-border, #2a3650)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill:'var(--color-ink-secondary)', fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={d => d?.slice(5)} />
                <YAxis tick={{ fill:'var(--color-ink-secondary)', fontSize:10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                {[['Theft','Theft'],['FaultyMeter','Faulty Meter'],['CommFailure','Comm Failure']].map(([k,n]) => (
                  <Area key={k} type="monotone" dataKey={k} name={n} stroke={LABEL_COLOR[k]} fill={`url(#g-${k})`} strokeWidth={1.5} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No trend data yet" sub="Run predictions to populate this chart." />
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-4">Class Distribution</h2>
          {loading ? <div className="skeleton h-48 rounded" /> : counts ? (
            Object.entries(counts).map(([label, count]) => {
              const total = Object.values(counts).reduce((a,b) => a+b, 0);
              const pct   = total ? ((count/total)*100).toFixed(1) : 0;
              return (
                <div key={label} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-secondary">{label}</span>
                    <span className="font-mono font-medium text-ink-primary">{count.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-surface-border rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`, backgroundColor: LABEL_COLOR[label] }} />
                  </div>
                </div>
              );
            })
          ) : null}
        </div>
      </div>

      {/* Top risk table */}
      <section aria-label="Top risk consumers" className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">Top Risk Consumers</h2>
          <button onClick={() => navigate('/consumers?label=Theft')} className="text-xs text-accent hover:text-accent-dim transition-colors">View all →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table" aria-label="Top risk consumers table">
            <thead>
              <tr>
                <th scope="col">Consumer ID</th><th scope="col">Type</th>
                <th scope="col">Class</th><th scope="col">Subtype</th>
                <th scope="col">Confidence</th><th scope="col">Prediction</th><th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={[40,80,60,80,40,60,60]} rows={8} />
                : topRisk.length === 0
                  ? <tr><td colSpan={7}><EmptyState title="No predictions yet" sub='Click "Batch Predict" to run predictions on flagged consumers.' /></td></tr>
                  : topRisk.map(c => (
                      <tr key={c.id} onClick={() => navigate(`/consumers/${c.id}`)} tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && navigate(`/consumers/${c.id}`)}
                        role="row" aria-label={`Consumer ${c.id}, ${c.groundTruthLabel}`}>
                        <td className="font-mono text-accent text-xs">{c.id}</td>
                        <td className="text-xs text-ink-secondary">{c.consumerType}</td>
                        <td><Badge label={c.groundTruthLabel} /></td>
                        <td className="text-[10px] font-mono text-ink-muted">{c.groundTruthSubtype ?? '—'}</td>
                        <td className="font-mono text-xs text-ink-primary">{c.latestConfidence != null ? `${(c.latestConfidence*100).toFixed(0)}%` : '—'}</td>
                        <td>{c.latestPredictedLabel ? <Badge label={c.latestPredictedLabel} /> : <span className="text-[10px] text-ink-muted">—</span>}</td>
                        <td><Badge label={c.inspectionStatus ?? 'Unreviewed'} /></td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
