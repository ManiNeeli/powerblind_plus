import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ClipboardList } from 'lucide-react';
import { useInspections }  from '../hooks/useInspections';
import PageShell           from '../components/layout/PageShell';
import ExportButton        from '../components/ui/ExportButton';
import { Badge, SkeletonRows, ErrorAlert, EmptyState, Pagination, CopyButton } from '../components/ui/index.jsx';
import { cn } from '../lib/utils';

const STATUS_META = {
  QUEUED:         { label:'Queued',        icon:Clock,        cls:'badge-comm'   },
  CONFIRMED:      { label:'Confirmed',     icon:CheckCircle,  cls:'badge-theft'  },
  FALSE_POSITIVE: { label:'False Positive',icon:XCircle,      cls:'badge-normal' },
};
const LIMIT = 25;

export default function InspectionsPage() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const page   = Number(sp.get('page') || 1);
  const status = sp.get('status') || '';

  const set = (key, val) => {
    const next = new URLSearchParams(sp);
    next.set(key, val);
    if (key !== 'page') next.set('page', '1');
    setSp(next);
  };

  const { inspections, total, loading, error } = useInspections({
    page, limit: LIMIT, status: status || undefined,
  });
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <PageShell
      title="Field Inspections"
      subtitle={total ? `${total.toLocaleString()} operator audit logs recorded` : 'Operator decision & field verification history'}
      actions={<ExportButton />}
    >
      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap" role="group" aria-label="Filter by inspection status">
        {[{v:'',l:'All Decisions'}, ...Object.entries(STATUS_META).map(([v,m])=>({v,l:m.label}))].map(({v,l}) => (
          <button key={v} onClick={() => set('status', v)}
            aria-pressed={status === v}
            className={cn('px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150',
              status === v
                ? 'bg-accent/15 text-accent border-accent/40 shadow-glow-accent'
                : 'text-ink-secondary border-surface-border/60 bg-surface/30 hover:bg-surface hover:text-ink-primary hover:border-surface-border')}>
            {l}
          </button>
        ))}
      </div>

      <ErrorAlert message={error} className="mb-4" />

      <section aria-label="Inspections table" className="card overflow-hidden">
        <div className="overflow-x-auto table-responsive">
          <table className="data-table" aria-label="Inspection decisions">
            <thead>
              <tr>
                <th scope="col">Consumer ID</th>
                <th scope="col" className="hidden sm:table-cell">Type</th>
                <th scope="col">Anomaly Class</th>
                <th scope="col">Decision</th>
                <th scope="col" className="hidden md:table-cell">Operator</th>
                <th scope="col">Logged Date</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={[50,80,70,60,80,60]} rows={10} />
                : inspections.length === 0
                  ? (
                      <tr>
                        <td colSpan={6}>
                          <EmptyState icon={ClipboardList}
                            title="No inspections logged yet"
                            sub="Decisions made on the Consumer Detail page appear here." />
                        </td>
                      </tr>
                    )
                  : inspections.map(ins => {
                      const sm = STATUS_META[ins.status] ?? STATUS_META.QUEUED;
                      const SI = sm.icon;
                      return (
                        <tr key={ins.id}
                          onClick={() => navigate(`/consumers/${ins.consumerId}`)}
                          onKeyDown={e => e.key === 'Enter' && navigate(`/consumers/${ins.consumerId}`)}
                          tabIndex={0} role="row">
                          <td className="font-mono text-xs font-semibold">
                            <div className="flex items-center gap-1.5">
                              <span className="text-accent hover:underline">{ins.consumer?.id}</span>
                              {ins.consumer?.id && <CopyButton text={ins.consumer?.id} label={`Copy ${ins.consumer?.id}`} />}
                            </div>
                          </td>
                          <td className="text-xs text-ink-secondary hidden sm:table-cell">{ins.consumer?.consumerType}</td>
                          <td><Badge label={ins.consumer?.groundTruthLabel} /></td>
                          <td>
                            <span className={cn('badge inline-flex items-center gap-1.5', sm.cls)}>
                              <SI className="w-3 h-3" aria-hidden />
                              <span>{sm.label}</span>
                            </span>
                          </td>
                          <td className="text-xs text-ink-secondary hidden md:table-cell font-mono">{ins.operator?.email}</td>
                          <td className="text-[10px] font-mono text-ink-muted whitespace-nowrap">
                            {new Date(ins.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })
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
