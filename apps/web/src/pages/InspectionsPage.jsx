import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ClipboardList } from 'lucide-react';
import { useInspections }  from '../hooks/useInspections';
import PageShell           from '../components/layout/PageShell';
import ExportButton        from '../components/ui/ExportButton';
import { Badge, SkeletonRows, ErrorAlert, EmptyState, Pagination } from '../components/ui/index.jsx';
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
      title="Inspections"
      subtitle={total ? `${total.toLocaleString()} decisions logged` : 'Operator decision history'}
      actions={<ExportButton />}
    >
      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap" role="group" aria-label="Filter by inspection status">
        {[{v:'',l:'All'}, ...Object.entries(STATUS_META).map(([v,m])=>({v,l:m.label}))].map(({v,l}) => (
          <button key={v} onClick={() => set('status', v)}
            aria-pressed={status === v}
            className={cn('px-3 py-1.5 rounded text-xs font-medium border transition-colors',
              status===v
                ? 'bg-accent/15 text-accent border-accent/30'
                : 'text-ink-secondary border-transparent hover:bg-surface hover:text-ink-primary')}>
            {l}
          </button>
        ))}
      </div>

      <ErrorAlert message={error} className="mb-4" />

      <section aria-label="Inspections table" className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" aria-label="Inspection decisions">
            <thead>
              <tr>
                <th scope="col">Consumer</th>
                <th scope="col" className="hidden sm:table-cell">Type</th>
                <th scope="col">Anomaly Class</th>
                <th scope="col">Decision</th>
                <th scope="col" className="hidden md:table-cell">Operator</th>
                <th scope="col">Date</th>
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
                          <td className="font-mono text-accent text-xs">{ins.consumer?.id}</td>
                          <td className="text-xs text-ink-secondary hidden sm:table-cell">{ins.consumer?.consumerType}</td>
                          <td><Badge label={ins.consumer?.groundTruthLabel} /></td>
                          <td>
                            <span className={cn('badge', sm.cls)}>
                              <SI className="w-2.5 h-2.5" aria-hidden />
                              <span className="hidden xs:inline">{sm.label}</span>
                            </span>
                          </td>
                          <td className="text-xs text-ink-secondary hidden md:table-cell">{ins.operator?.email}</td>
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
