import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Gauge, Wifi, CheckCircle, Zap, Loader2, ArrowRight, ShieldAlert } from 'lucide-react';
import { useDashboard }       from '../hooks/useDashboard';
import { useBatchPredict }    from '../hooks/usePrediction';
import { useToast }           from '../contexts/ToastContext';
import PageShell              from '../components/layout/PageShell';
import ExportButton           from '../components/ui/ExportButton';
import { StatCard, SkeletonRows, ErrorAlert, Badge, EmptyState, CopyButton } from '../components/ui/index.jsx';
import { cn } from '../lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const LABEL_COLOR = { Theft:'#ff3b5c', FaultyMeter:'#f59e0b', CommFailure:'#6366f1', Normal:'#10b981' };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-glass px-3.5 py-2.5 text-xs shadow-glass border border-surface-border rounded-lg">
      <p className="text-ink-secondary mb-1.5 font-mono text-[11px]">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 justify-between min-w-[120px] mb-0.5">
          <span style={{ color: p.color }} className="font-medium text-[11px]">{p.name}:</span>
          <span className="font-mono font-bold text-ink-primary">{p.value}</span>
        </div>
      ))}
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
    { icon: AlertTriangle, label:'Theft Detected',  value: counts?.Theft?.toLocaleString(),       colorClass:'text-risk-theft'  },
    { icon: Gauge,         label:'Faulty Meters',   value: counts?.FaultyMeter?.toLocaleString(),  colorClass:'text-risk-fault'  },
    { icon: Wifi,          label:'Comm Failures',   value: counts?.CommFailure?.toLocaleString(),  colorClass:'text-risk-comm'   },
    { icon: CheckCircle,   label:'Normal',          value: counts?.Normal?.toLocaleString(),       colorClass:'text-risk-normal' },
  ];

  return (
    <PageShell
      title="Grid Overview"
      subtitle={totalConsumers ? `${totalConsumers.toLocaleString()} smart meters continuously monitored` : 'Real-Time Anomaly & Theft Detection'}
      actions={
        <div className="flex items-center gap-2.5 flex-wrap">
          <button onClick={handleBatchPredict} disabled={batching || loading}
            aria-label="Run batch predictions on top-risk consumers"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent/15 text-accent border border-accent/30 text-xs font-semibold hover:bg-accent/25 hover:border-accent/50 hover:shadow-glow-accent transition-all duration-150 disabled:opacity-50">
            {batching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing {progress}%</> : <><Zap className="w-3.5 h-3.5" />Batch Predict</>}
          </button>
          <ExportButton />
        </div>
      }
    >
      <ErrorAlert message={error} className="mb-5" />

      {/* Bento Stat KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {stats.map(s => <StatCard key={s.label} {...s} loading={loading} />)}
      </div>

      {/* Field Inspection Metrics */}
      {(inspectionStats || loading) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
          {[
            { label:'Total Inspections',   value: inspectionStats?.total,         color:'text-ink-primary' },
            { label:'Confirmed Anomalies', value: inspectionStats?.confirmed,     color:'text-risk-theft'  },
            { label:'False Positives',     value: inspectionStats?.falsePositive, color:'text-risk-normal' },
            { label:'Queued for Review',   value: inspectionStats?.queued,        color:'text-risk-comm'   },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 hover:border-surface-borderLight transition-all">
              <p className="stat-card-label">{label}</p>
              {loading ? <div className="skeleton h-6 w-14 mt-1.5 rounded" />
                : <p className={cn('text-xl font-extrabold font-mono tracking-tight mt-1', color)}>{value?.toLocaleString() ?? '—'}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Charts Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
              Anomaly Detections — Last 30 Days
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-mono text-ink-muted">30D Window</span>
            </div>
          </div>
          {loading ? <div className="skeleton h-52 rounded-lg" /> : trend.length ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={trend} margin={{ top:6, right:6, left:-20, bottom:0 }}>
                <defs>
                  {['Theft','FaultyMeter','CommFailure'].map(k => (
                    <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={LABEL_COLOR[k]} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={LABEL_COLOR[k]} stopOpacity={0.0}  />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill:'var(--color-ink-muted)', fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={d => d?.slice(5)} />
                <YAxis tick={{ fill:'var(--color-ink-muted)', fontSize:10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                {[['Theft','Theft'],['FaultyMeter','Faulty Meter'],['CommFailure','Comm Failure']].map(([k,n]) => (
                  <Area key={k} type="monotone" dataKey={k} name={n} stroke={LABEL_COLOR[k]} fill={`url(#g-${k})`} strokeWidth={2} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No trend data yet" sub="Run predictions to populate this chart." />
          )}
        </div>

        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-ink-secondary uppercase tracking-wider mb-4">Class Distribution</h2>
            {loading ? <div className="skeleton h-52 rounded-lg" /> : counts ? (
              <div className="space-y-4">
                {Object.entries(counts).map(([label, count]) => {
                  const total = Object.values(counts).reduce((a,b) => a+b, 0);
                  const pct   = total ? ((count/total)*100).toFixed(1) : 0;
                  return (
                    <div key={label} className="group">
                      <div className="flex justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LABEL_COLOR[label] }} />
                          <span className="text-ink-secondary font-medium">{label}</span>
                        </div>
                        <span className="font-mono font-semibold text-ink-primary">{count.toLocaleString()} <span className="text-ink-muted">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-surface-border/60 rounded-full overflow-hidden p-[1px]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full rounded-full transition-all duration-700 shadow-sm" style={{ width:`${pct}%`, backgroundColor: LABEL_COLOR[label] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="pt-3 border-t border-surface-border/60 mt-4 flex items-center justify-between text-[11px] text-ink-muted font-mono">
            <span>Aggregated Dataset</span>
            <span>{totalConsumers ? `${totalConsumers} units` : ''}</span>
          </div>
        </div>
      </div>

      {/* Top risk table */}
      <section aria-label="Top risk consumers" className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border/70 bg-surface/20">
          <div>
            <h2 className="text-xs font-bold text-ink-secondary uppercase tracking-wider">Top Risk Consumers</h2>
            <p className="text-[11px] text-ink-muted mt-0.5">Meters flagged with high anomaly probabilities</p>
          </div>
          <button onClick={() => navigate('/consumers?label=Theft')} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline transition-colors">
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto table-responsive">
          <table className="data-table" aria-label="Top risk consumers table">
            <thead>
              <tr>
                <th scope="col">Consumer ID</th><th scope="col">Type</th>
                <th scope="col">Class</th><th scope="col">Subtype</th>
                <th scope="col">Confidence</th><th scope="col">Prediction</th><th scope="col">Status</th>
                <th scope="col" className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={[40,80,60,80,40,60,60,80]} rows={8} />
                : topRisk.length === 0
                  ? <tr><td colSpan={8}><EmptyState title="No predictions yet" sub='Click "Batch Predict" to run predictions on flagged consumers.' /></td></tr>
                  : topRisk.map(c => (
                      <tr key={c.id} onClick={() => navigate(`/consumers/${c.id}`)} tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && navigate(`/consumers/${c.id}`)}
                        role="row" aria-label={`Consumer ${c.id}, ${c.groundTruthLabel}`}>
                        <td className="font-mono text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="text-accent hover:underline">{c.id}</span>
                            <CopyButton text={c.id} label={`Copy ${c.id}`} />
                          </div>
                        </td>
                        <td className="text-xs text-ink-secondary">{c.consumerType}</td>
                        <td><Badge label={c.groundTruthLabel} /></td>
                        <td className="text-[10px] font-mono text-ink-muted">{c.groundTruthSubtype ?? '—'}</td>
                        <td className="font-mono text-xs font-semibold text-ink-primary">{c.latestConfidence != null ? `${(c.latestConfidence*100).toFixed(0)}%` : '—'}</td>
                        <td>{c.latestPredictedLabel ? <Badge label={c.latestPredictedLabel} /> : <span className="text-[10px] text-ink-muted">—</span>}</td>
                        <td><Badge label={c.inspectionStatus ?? 'Unreviewed'} /></td>
                        <td className="text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/consumers/${c.id}`); }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-[#ff3b5c]/10 dark:text-[#ff4d6d] dark:border-[#ff3b5c]/30 hover:shadow-glow-theft transition-all duration-150"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>Forensic Flow →</span>
                          </button>
                        </td>
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
