import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Zap, Loader2, History, BarChart2, Clock } from 'lucide-react';
import { useConsumer, useTimeseries, usePredictions, usePredictionHistory } from '../hooks/useConsumers';
import { useLogInspection } from '../hooks/useInspections';
import { useMutation } from '../hooks/useApi';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { Badge, ErrorAlert, Skeleton } from '../components/ui/index.jsx';
import XAIWaterfall    from '../components/charts/XAIWaterfall';
import ConfidenceGauge from '../components/charts/ConfidenceGauge';
import ClassProbBar    from '../components/charts/ClassProbBar';
import PredictionHistory from '../components/charts/PredictionHistory';
import { cn } from '../lib/utils';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea, Legend,
} from 'recharts';

const LABEL_HEX = { Theft:'#ef4444', FaultyMeter:'#f59e0b', CommFailure:'#6366f1', Normal:'#22c55e' };
const PRIORITY_STYLE = {
  HIGH:   'bg-risk-theft-muted  text-risk-theft  border-risk-theft/30',
  MEDIUM: 'bg-risk-fault-muted  text-risk-fault  border-risk-fault/30',
  LOW:    'bg-risk-normal-muted text-risk-normal border-risk-normal/30',
};

function Section({ title, icon: Icon, children, action }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-ink-muted" />}
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-secondary">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-card-hover min-w-[140px]">
      <p className="text-ink-secondary mb-1 font-mono">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium mb-0.5">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : '—'}
        </p>
      ))}
    </div>
  );
}

export default function ConsumerDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { toastSuccess, toastError } = useToast();

  const { consumer, loading: loadingC, error: errorC } = useConsumer(id);
  const { readings, loading: loadingTS }               = useTimeseries(id);
  const { predictions, loading: loadingPreds, refetch: refetchPreds } = usePredictionHistory(id);

  const { mutate: predictMutate, loading: predicting } = useMutation();
  const { logInspection, loading: inspecting }         = useLogInspection();

  const [activePred,     setActivePred]     = useState(null);
  const [inspectionDone, setInspectionDone] = useState(null);
  const [activeTab,      setActiveTab]      = useState('prediction'); // prediction | history

  const runPrediction = async () => {
    try {
      const p = await predictMutate(() => api.get(`/api/consumers/${id}/predict`));
      setActivePred(p);
      setActiveTab('prediction');
      toastSuccess('Prediction complete.');
      refetchPreds();
    } catch (e) { toastError(`Prediction failed: ${e.message}`); }
  };

  const handleInspection = async (status) => {
    try {
      await logInspection(id, status);
      setInspectionDone(status);
      toastSuccess(`Decision logged: ${status.replace('_', ' ')}`);
    } catch (e) { toastError(e.message); }
  };

  if (loadingC) return (
    <div className="p-6 space-y-4">
      {[80,260,300,160].map((h,i) => <Skeleton key={i} className="w-full rounded-card" style={{ height: h }} />)}
    </div>
  );

  if (errorC || !consumer) return (
    <div className="p-6"><ErrorAlert message={errorC ?? `Consumer ${id} not found.`} /></div>
  );

  const anomalyStart = consumer.anomalyStartDate?.slice?.(0,10);
  const anomalyEnd   = consumer.anomalyEndDate?.slice?.(0,10);
  const hex          = LABEL_HEX[consumer.groundTruthLabel] ?? '#8b949e';

  // Use activePred (fresh) or fall back to stored latestPrediction
  const displayPred = activePred ?? consumer.latestPrediction;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="px-6 pt-6 pb-5 border-b border-surface-border flex items-start gap-4 flex-wrap">
        <button onClick={() => navigate(-1)}
          className="mt-0.5 text-ink-secondary hover:text-ink-primary transition-colors p-1 -ml-1 rounded">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h1 className="font-mono font-bold text-base text-ink-primary">{consumer.id}</h1>
            <Badge label={consumer.groundTruthLabel} />
            {consumer.groundTruthSubtype && (
              <span className="text-2xs font-mono text-ink-muted">{consumer.groundTruthSubtype}</span>
            )}
          </div>
          <p className="text-xs text-ink-secondary">
            {consumer.consumerType}
            {consumer.readingCount ? ` · ${consumer.readingCount.toLocaleString()} readings` : ''}
          </p>
        </div>
        <button onClick={runPrediction} disabled={predicting}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent/10 text-accent border border-accent/30 text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-50">
          {predicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {predicting ? 'Running…' : 'Run Prediction'}
        </button>
      </header>

      <div className="flex-1 p-6 space-y-4">
        {/* Meta row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:'Base kWh',     value: consumer.baseKwh?.toFixed(1) ?? '—' },
            { label:'Anomaly Window',value: anomalyStart ? `${anomalyStart} → ${anomalyEnd}` : 'None' },
            { label:'Start Day',    value: consumer.anomalyStartDay != null ? `Day ${consumer.anomalyStartDay}` : '—' },
            { label:'End Day',      value: consumer.anomalyEndDay   != null ? `Day ${consumer.anomalyEndDay}`   : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="card p-3">
              <p className="text-2xs text-ink-secondary uppercase tracking-wider font-semibold mb-1">{label}</p>
              <p className="text-xs font-mono font-medium text-ink-primary">{value}</p>
            </div>
          ))}
        </div>

        {/* Timeseries chart */}
        <Section title="Energy Consumption & Electrical Features" icon={BarChart2}>
          {loadingTS
            ? <Skeleton className="h-64 w-full" />
            : readings.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={readings} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3650" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill:'#8b949e', fontSize:9 }} tickLine={false} axisLine={false}
                      interval={Math.floor(readings.length / 8)} tickFormatter={d => d?.slice(5)} />
                    <YAxis yAxisId="kwh" tick={{ fill:'#8b949e', fontSize:9 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="pf"  orientation="right" tick={{ fill:'#8b949e', fontSize:9 }} tickLine={false} axisLine={false} domain={[0,1]} />
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize:10, color:'#8b949e' }} />
                    {anomalyStart && anomalyEnd && (
                      <ReferenceArea yAxisId="kwh" x1={anomalyStart} x2={anomalyEnd}
                        fill={hex} fillOpacity={0.07} stroke={hex} strokeOpacity={0.25} strokeWidth={1} />
                    )}
                    <Bar  yAxisId="kwh" dataKey="kwh"         name="kWh"         fill="#00c8a0" fillOpacity={0.7} radius={[1,1,0,0]} maxBarSize={6} />
                    <Line yAxisId="kwh" dataKey="voltageV"    name="Voltage (V)"  stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                    <Line yAxisId="pf"  dataKey="powerFactor" name="Power Factor" stroke="#6366f1" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
                {anomalyStart && (
                  <p className="text-2xs text-ink-muted mt-2">
                    Shaded region = ground-truth anomaly window ({anomalyStart} → {anomalyEnd}).
                    Red bars = missing data (CommFailure C1).
                  </p>
                )}
              </>
            ) : <p className="text-sm text-ink-muted text-center py-8">No readings loaded.</p>
          }
        </Section>

        {/* Prediction + History tabs */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-1">
              {[
                { id:'prediction', label:'AI Prediction', icon: Zap     },
                { id:'history',    label:'History',       icon: History  },
              ].map(({ id: tid, label, icon: Icon }) => (
                <button key={tid} onClick={() => setActiveTab(tid)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    activeTab === tid
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'text-ink-secondary border-transparent hover:bg-surface hover:text-ink-primary')}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {tid === 'history' && predictions.length > 0 && (
                    <span className="ml-1 bg-surface-border text-ink-muted rounded-full px-1.5 text-2xs">
                      {predictions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {displayPred?.actionPriority && activeTab === 'prediction' && (
              <span className={cn('badge border text-2xs', PRIORITY_STYLE[displayPred.actionPriority])}>
                {displayPred.actionPriority} PRIORITY
              </span>
            )}
          </div>

          {/* Prediction tab */}
          {activeTab === 'prediction' && (
            !displayPred ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <p className="text-sm text-ink-secondary">No prediction for this consumer yet.</p>
                <button onClick={runPrediction} disabled={predicting}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent/10 text-accent border border-accent/30 text-sm hover:bg-accent/20 transition-colors disabled:opacity-50">
                  {predicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Run First Prediction
                </button>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in">
                {/* Gauge + probs row */}
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="shrink-0">
                    <ConfidenceGauge
                      confidence={displayPred.confidence}
                      label={displayPred.predictedLabel}
                      size={130}
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    {displayPred.classProbabilities && (
                      <div>
                        <p className="text-2xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">
                          Class Probabilities
                        </p>
                        <ClassProbBar probabilities={displayPred.classProbabilities} />
                      </div>
                    )}
                    {displayPred.predictedSubtype && (
                      <div>
                        <p className="text-2xs font-semibold text-ink-secondary uppercase tracking-wider mb-1">Sub-type</p>
                        <span className="font-mono text-xs text-ink-primary bg-surface border border-surface-border rounded px-2 py-1">
                          {displayPred.predictedSubtype}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-2xs font-semibold text-ink-secondary uppercase tracking-wider mb-1">Source</p>
                      <span className="text-2xs font-mono text-ink-muted">
                        {displayPred.modelVersion ?? displayPred.source}
                        {' · '}
                        {displayPred.createdAt ? new Date(displayPred.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <div className="bg-canvas rounded-lg border border-surface-border px-4 py-3">
                  <p className="text-2xs font-semibold text-ink-secondary uppercase tracking-wider mb-1.5">
                    Plain-Language Explanation
                  </p>
                  <p className="text-sm text-ink-primary leading-relaxed">{displayPred.recommendation}</p>
                </div>

                {/* XAI waterfall */}
                {displayPred.topFeatures?.length > 0 && (
                  <div>
                    <p className="text-2xs font-semibold text-ink-secondary uppercase tracking-wider mb-3">
                      Feature Importance (SHAP-style)
                    </p>
                    <XAIWaterfall features={displayPred.topFeatures} label={displayPred.predictedLabel} />
                  </div>
                )}
              </div>
            )
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <PredictionHistory predictions={predictions} loading={loadingPreds} />
          )}
        </div>

        {/* Inspection decision */}
        <Section title="Inspection Decision" icon={Clock}>
          {inspectionDone
            ? (
              <div className={cn('flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium border',
                inspectionDone === 'CONFIRMED'      && 'bg-risk-theft-muted  text-risk-theft  border-risk-theft/20',
                inspectionDone === 'FALSE_POSITIVE' && 'bg-risk-normal-muted text-risk-normal border-risk-normal/20',
                inspectionDone === 'QUEUED'         && 'bg-risk-comm-muted   text-risk-comm   border-risk-comm/20',
              )}>
                ✓ Decision logged: {inspectionDone.replace('_', ' ')}
              </div>
            )
            : (
              <div className="flex flex-wrap gap-2">
                {[
                  { status:'QUEUED',         label:'Queue for Inspection', cls:'border-risk-comm/30  text-risk-comm  hover:bg-risk-comm-muted'   },
                  { status:'CONFIRMED',      label:'Confirm Anomaly',      cls:'border-risk-theft/30 text-risk-theft hover:bg-risk-theft-muted'  },
                  { status:'FALSE_POSITIVE', label:'Mark False Positive',  cls:'border-risk-normal/30 text-risk-normal hover:bg-risk-normal-muted'},
                ].map(({ status, label, cls }) => (
                  <button key={status} onClick={() => handleInspection(status)} disabled={inspecting}
                    className={cn('flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors disabled:opacity-50', cls)}>
                    {inspecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {label}
                  </button>
                ))}
              </div>
            )
          }
          {consumer.inspections?.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-2xs text-ink-muted font-semibold uppercase tracking-wider">Recent decisions</p>
              {consumer.inspections.map(ins => (
                <div key={ins.id} className="flex items-center gap-3 text-xs text-ink-secondary">
                  <Badge label={ins.status} />
                  <span className="text-ink-muted">{ins.operator?.email}</span>
                  <span className="ml-auto font-mono text-2xs text-ink-muted">
                    {new Date(ins.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
