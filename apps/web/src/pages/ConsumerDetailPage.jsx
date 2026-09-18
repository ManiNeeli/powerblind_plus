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
import TheftForensicFlow from '../components/charts/TheftForensicFlow';
import { cn } from '../lib/utils';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea, Legend,
} from 'recharts';

const LABEL_HEX = { Theft:'#ff3b5c', FaultyMeter:'#f59e0b', CommFailure:'#6366f1', Normal:'#10b981' };
const PRIORITY_STYLE = {
  HIGH:   'bg-[#ff3b5c]/15 text-[#ff3b5c] border-[#ff3b5c]/30 shadow-[0_0_8px_rgba(255,59,92,0.2)]',
  MEDIUM: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
  LOW:    'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
};

function Section({ title, icon: Icon, children, action }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-accent" />}
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-secondary">{title}</h2>
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
    <div className="card-glass px-3.5 py-2.5 text-xs shadow-glass border border-white/10 min-w-[150px] rounded-lg">
      <p className="text-ink-secondary mb-1.5 font-mono text-[11px]">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 mb-0.5">
          <span style={{ color: p.color }} className="font-medium text-[11px]">{p.name}:</span>
          <span className="font-mono font-bold text-ink-primary">
            {typeof p.value === 'number' ? p.value.toFixed(3) : '—'}
          </span>
        </div>
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
      <header className="px-6 pt-6 pb-5 border-b border-surface-border flex items-start gap-4 flex-wrap bg-surface/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)}
          className="mt-0.5 text-ink-secondary hover:text-ink-primary transition-colors p-1.5 -ml-1 rounded-md hover:bg-surface border border-transparent hover:border-surface-border">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-0.5">
            <h1 className="font-mono font-bold text-base text-ink-primary tracking-tight">{consumer.id}</h1>
            <Badge label={consumer.groundTruthLabel} />
            {consumer.groundTruthSubtype && (
              <span className="text-[10px] font-mono text-ink-muted bg-surface px-1.5 py-0.5 rounded border border-surface-border">
                {consumer.groundTruthSubtype}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-secondary">
            {consumer.consumerType}
            {consumer.readingCount ? ` · ${consumer.readingCount.toLocaleString()} readings recorded` : ''}
          </p>
        </div>
        <button onClick={runPrediction} disabled={predicting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-[#00d69d] text-canvas font-semibold text-sm shadow-glow-accent hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50">
          {predicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {predicting ? 'Running Neural Analysis…' : 'Run Prediction'}
        </button>
      </header>

      <div className="flex-1 p-6 space-y-4">
        {/* Meta row Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {[
            { label:'Base kWh Consumption', value: consumer.baseKwh != null ? `${consumer.baseKwh.toFixed(1)} kWh` : '—' },
            { label:'Anomaly Time Window',  value: anomalyStart ? `${anomalyStart} → ${anomalyEnd}` : 'None detected' },
            { label:'Window Start Day',     value: consumer.anomalyStartDay != null ? `Day ${consumer.anomalyStartDay}` : '—' },
            { label:'Window End Day',       value: consumer.anomalyEndDay   != null ? `Day ${consumer.anomalyEndDay}`   : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="card p-3.5 hover:border-surface-borderLight transition-all">
              <p className="text-[10px] text-ink-muted uppercase tracking-wider font-bold mb-1">{label}</p>
              <p className="text-xs font-mono font-bold text-ink-primary">{value}</p>
            </div>
          ))}
        </div>

        {/* Theft & Anomaly Forensic Incident Reconstruction */}
        {(consumer.groundTruthLabel === 'Theft' || consumer.anomalyStartDate || displayPred?.predictedLabel === 'Theft') && (
          <TheftForensicFlow
            consumer={consumer}
            readings={readings}
            prediction={displayPred}
          />
        )}

        {/* Timeseries chart */}
        <Section title="Full-Year Energy Consumption & Electrical Signature" icon={BarChart2}>
          {loadingTS
            ? <Skeleton className="h-64 w-full" />
            : readings.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={readings} margin={{ top:6, right:8, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill:'var(--color-ink-muted)', fontSize:10 }} tickLine={false} axisLine={false}
                      interval={Math.floor(readings.length / 8)} tickFormatter={d => d?.slice(5)} />
                    <YAxis yAxisId="kwh" tick={{ fill:'var(--color-ink-muted)', fontSize:10 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="pf"  orientation="right" tick={{ fill:'var(--color-ink-muted)', fontSize:10 }} tickLine={false} axisLine={false} domain={[0,1]} />
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize:11, color:'var(--color-ink-secondary)', paddingTop:8 }} />
                    {anomalyStart && anomalyEnd && (
                      <ReferenceArea yAxisId="kwh" x1={anomalyStart} x2={anomalyEnd}
                        fill={hex} fillOpacity={0.08} stroke={hex} strokeOpacity={0.35} strokeWidth={1} />
                    )}
                    <Bar  yAxisId="kwh" dataKey="kwh"         name="kWh"         fill="#00f2b2" fillOpacity={0.75} radius={[2,2,0,0]} maxBarSize={6} />
                    <Line yAxisId="kwh" dataKey="voltageV"    name="Voltage (V)"  stroke="#f59e0b" strokeWidth={1.75} dot={false} />
                    <Line yAxisId="pf"  dataKey="powerFactor" name="Power Factor" stroke="#6366f1" strokeWidth={1.75} dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
                {anomalyStart && (
                  <p className="text-[11px] text-ink-muted mt-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
                    <span>Shaded zone represents ground-truth anomaly window ({anomalyStart} → {anomalyEnd}).</span>
                  </p>
                )}
              </>
            ) : <p className="text-sm text-ink-muted text-center py-8">No timeseries readings loaded.</p>
          }
        </Section>

        {/* Prediction + History tabs */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-1.5">
              {[
                { id:'prediction', label:'AI Prediction & Explainability', icon: Zap     },
                { id:'history',    label:'Prediction History',             icon: History  },
              ].map(({ id: tid, label, icon: Icon }) => (
                <button key={tid} onClick={() => setActiveTab(tid)}
                  className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    activeTab === tid
                      ? 'bg-accent/15 text-accent border-accent/40 shadow-glow-accent'
                      : 'text-ink-secondary border-transparent hover:bg-surface hover:text-ink-primary')}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {tid === 'history' && predictions.length > 0 && (
                    <span className="ml-1 bg-surface-border text-ink-primary rounded-full px-1.5 text-[10px] font-mono">
                      {predictions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {displayPred?.actionPriority && activeTab === 'prediction' && (
              <span className={cn('badge border text-[10px] font-bold tracking-wider', PRIORITY_STYLE[displayPred.actionPriority])}>
                {displayPred.actionPriority} PRIORITY
              </span>
            )}
          </div>

          {/* Prediction tab */}
          {activeTab === 'prediction' && (
            !displayPred ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <p className="text-sm text-ink-secondary font-medium">No anomaly prediction on record for this consumer.</p>
                <button onClick={runPrediction} disabled={predicting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/15 text-accent border border-accent/30 text-sm font-semibold hover:bg-accent/25 hover:border-accent/50 hover:shadow-glow-accent transition-all disabled:opacity-50">
                  {predicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Run First Prediction
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {/* Gauge + probs row */}
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="shrink-0 p-3 rounded-xl bg-surface/40 border border-surface-border">
                    <ConfidenceGauge
                      confidence={displayPred.confidence}
                      label={displayPred.predictedLabel}
                      size={135}
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    {displayPred.classProbabilities && (
                      <div>
                        <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-2">
                          Class Probabilities
                        </p>
                        <ClassProbBar probabilities={displayPred.classProbabilities} />
                      </div>
                    )}
                    {displayPred.predictedSubtype && (
                      <div>
                        <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">Detected Anomaly Subtype</p>
                        <span className="font-mono text-xs text-ink-primary bg-surface/80 border border-surface-border rounded-md px-2.5 py-1 inline-block">
                          {displayPred.predictedSubtype}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">Inference Engine</p>
                      <span className="text-[11px] font-mono text-ink-muted">
                        {displayPred.modelVersion ?? displayPred.source}
                        {' · '}
                        {displayPred.createdAt ? new Date(displayPred.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <div className="bg-canvas-50/70 rounded-xl border border-surface-border px-4 py-3.5">
                  <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1.5">
                    Operator Decision Support Insight
                  </p>
                  <p className="text-sm text-ink-primary leading-relaxed">{displayPred.recommendation}</p>
                </div>

                {/* XAI waterfall */}
                {displayPred.topFeatures?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-3">
                      SHAP Feature Attribution (Explainable AI)
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
        <Section title="Field Inspection Dispatch & Logging" icon={Clock}>
          {inspectionDone
            ? (
              <div className={cn('flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold border backdrop-blur-sm',
                inspectionDone === 'CONFIRMED'      && 'bg-[#ff3b5c]/15 text-[#ff3b5c] border-[#ff3b5c]/30 shadow-glow-theft',
                inspectionDone === 'FALSE_POSITIVE' && 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30 shadow-glow-normal',
                inspectionDone === 'QUEUED'         && 'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/30 shadow-glow-comm',
              )}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span>Decision verified & logged: {inspectionDone.replace('_', ' ')}</span>
              </div>
            )
            : (
              <div className="flex flex-wrap gap-2.5">
                {[
                  { status:'QUEUED',         label:'Queue for Field Inspection', cls:'border-[#6366f1]/30 text-[#818cf8] bg-[#6366f1]/10 hover:bg-[#6366f1]/20 hover:border-[#6366f1]/50' },
                  { status:'CONFIRMED',      label:'Confirm Energy Theft',       cls:'border-[#ff3b5c]/30 text-[#ff4d6d] bg-[#ff3b5c]/10 hover:bg-[#ff3b5c]/20 hover:border-[#ff3b5c]/50' },
                  { status:'FALSE_POSITIVE', label:'Mark False Alarm',           cls:'border-[#10b981]/30 text-[#34d399] bg-[#10b981]/10 hover:bg-[#10b981]/20 hover:border-[#10b981]/50' },
                ].map(({ status, label, cls }) => (
                  <button key={status} onClick={() => handleInspection(status)} disabled={inspecting}
                    className={cn('flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50', cls)}>
                    {inspecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {label}
                  </button>
                ))}
              </div>
            )
          }
          {consumer.inspections?.length > 0 && (
            <div className="mt-4 space-y-2 pt-3 border-t border-surface-border">
              <p className="text-[10px] text-ink-muted font-bold uppercase tracking-wider">Historical Operator Decisions</p>
              {consumer.inspections.map(ins => (
                <div key={ins.id} className="flex items-center gap-3 text-xs text-ink-secondary py-1 border-b border-surface-border/40 last:border-none">
                  <Badge label={ins.status} />
                  <span className="text-ink-muted font-mono">{ins.operator?.email}</span>
                  <span className="ml-auto font-mono text-[10px] text-ink-muted">
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
