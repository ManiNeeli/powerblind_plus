import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, ChevronLeft, ChevronRight, Zap, Loader2, Users } from 'lucide-react';
import { useConsumers }    from '../hooks/useConsumers';
import { useBatchPredict } from '../hooks/usePrediction';
import { useToast }        from '../contexts/ToastContext';
import PageShell           from '../components/layout/PageShell';
import ExportButton        from '../components/ui/ExportButton';
import { Badge, SkeletonRows, ErrorAlert, EmptyState, Pagination, CopyButton } from '../components/ui/index.jsx';
import { cn } from '../lib/utils';

const LABELS = ['All','Theft','FaultyMeter','CommFailure','Normal'];
const TYPES  = ['All','residential_small','residential_large','small_commercial','industrial_light'];
const LIMIT  = 25;

export default function ConsumersPage() {
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();
  const [sp, setSp] = useSearchParams();

  const page   = Number(sp.get('page') || 1);
  const label  = sp.get('label')  || 'All';
  const type   = sp.get('type')   || 'All';
  const search = sp.get('search') || '';

  const set = (key, val) => {
    const next = new URLSearchParams(sp);
    next.set(key, val);
    if (key !== 'page') next.set('page', '1');
    setSp(next);
  };

  const { consumers, total, loading, error, refetch } = useConsumers({
    page, limit: LIMIT,
    label:        label !== 'All' ? label : undefined,
    consumerType: type  !== 'All' ? type  : undefined,
    search:       search || undefined,
  });

  const { runBatch, loading: batching, progress } = useBatchPredict();
  const totalPages = Math.ceil(total / LIMIT);

  const handleBatchPage = async () => {
    const ids = consumers.map(c => c.id);
    if (!ids.length) return;
    try {
      const done = await runBatch(ids);
      toastSuccess(`${done} predictions run on this page.`);
      refetch();
    } catch (e) { toastError(e.message); }
  };

  return (
    <PageShell
      title="Monitored Consumers"
      subtitle={total ? `${total.toLocaleString()} consumers indexed in system` : undefined}
      actions={
        <div className="flex items-center gap-2.5 flex-wrap">
          <button onClick={handleBatchPage} disabled={batching || loading || !consumers.length}
            aria-label="Run predictions on all consumers on this page"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent/15 text-accent border border-accent/30 text-xs font-semibold hover:bg-accent/25 hover:border-accent/50 hover:shadow-glow-accent transition-all disabled:opacity-50">
            {batching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing {progress}%</>
                      : <><Zap className="w-3.5 h-3.5" />Predict Page</>}
          </button>
          <ExportButton />
        </div>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" aria-hidden />
          <input
            value={search} onChange={e => set('search', e.target.value)}
            placeholder="Search Consumer ID…" aria-label="Search by consumer ID"
            className="form-input pl-9 pr-3 py-1.5 text-xs w-44 sm:w-56"
          />
        </div>

        {/* Label filters */}
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by anomaly class">
          <Filter className="w-3.5 h-3.5 text-ink-muted shrink-0 ml-1" aria-hidden />
          {LABELS.map(l => (
            <button key={l} onClick={() => set('label', l)}
              aria-pressed={label === l}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150',
                label === l
                  ? 'bg-accent/15 text-accent border-accent/40 shadow-glow-accent'
                  : 'text-ink-secondary border-surface-border/60 bg-surface/30 hover:bg-surface hover:text-ink-primary hover:border-surface-border')}>
              {l}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select value={type} onChange={e => set('type', e.target.value)}
          aria-label="Filter by consumer type"
          className="ml-auto bg-canvas border border-surface-border rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary outline-none focus:border-accent/60 transition-colors">
          {TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All consumer types' : t}</option>)}
        </select>
      </div>

      <ErrorAlert message={error} className="mb-4" />

      <section aria-label="Consumers table" className="card overflow-hidden">
        <div className="overflow-x-auto table-responsive">
          <table className="data-table" aria-label="Consumers list">
            <thead>
              <tr>
                <th scope="col">Consumer ID</th>
                <th scope="col">Type</th>
                <th scope="col">Ground Truth</th>
                <th scope="col" className="hidden sm:table-cell">Subtype</th>
                <th scope="col" className="hidden md:table-cell">Anomaly Window</th>
                <th scope="col" className="hidden sm:table-cell">Base kWh</th>
                <th scope="col">Latest Model Prediction</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={[50,80,60,80,90,40,60]} rows={LIMIT} />
                : consumers.length === 0
                  ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState icon={Users} title="No consumers match these filters"
                            sub="Try adjusting the class or type filters, or clear the search query." />
                        </td>
                      </tr>
                    )
                  : consumers.map(c => (
                      <tr key={c.id}
                        onClick={() => navigate(`/consumers/${c.id}`)}
                        onKeyDown={e => e.key === 'Enter' && navigate(`/consumers/${c.id}`)}
                        tabIndex={0} role="row"
                        aria-label={`Consumer ${c.id}, ${c.groundTruthLabel ?? 'unknown class'}`}>
                        <td className="font-mono text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="text-accent hover:underline">{c.id}</span>
                            <CopyButton text={c.id} label={`Copy ${c.id}`} />
                          </div>
                        </td>
                        <td className="text-xs text-ink-secondary">{c.consumerType}</td>
                        <td><Badge label={c.groundTruthLabel} /></td>
                        <td className="font-mono text-[10px] text-ink-muted hidden sm:table-cell">{c.groundTruthSubtype ?? '—'}</td>
                        <td className="text-[10px] font-mono text-ink-muted hidden md:table-cell">
                          {c.anomalyStartDate
                            ? `${c.anomalyStartDate?.slice(0,10)} → ${c.anomalyEndDate?.slice(0,10)}`
                            : '—'}
                        </td>
                        <td className="font-mono text-xs text-ink-primary hidden sm:table-cell">
                          {c.baseKwh != null ? c.baseKwh.toFixed(1) : '—'}
                        </td>
                        <td>
                          {c.latestPredictedLabel
                            ? <div className="flex items-center gap-2">
                                <Badge label={c.latestPredictedLabel} />
                                {c.latestConfidence != null && (
                                  <span className="text-[10px] font-mono font-bold text-ink-primary">
                                    {(c.latestConfidence * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            : <span className="text-[10px] text-ink-muted">—</span>
                          }
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
        <Pagination
          page={page} totalPages={totalPages} total={total}
          onPrev={() => set('page', String(page - 1))}
          onNext={() => set('page', String(page + 1))}
        />
      </section>
    </PageShell>
  );
}
