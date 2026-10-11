import { useSearchParams } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { useAuditLog }  from '../hooks/useUsers';
import PageShell        from '../components/layout/PageShell';
import { SkeletonRows, ErrorAlert, EmptyState, Pagination } from '../components/ui/index.jsx';
import { cn } from '../lib/utils';

const ACTION_COLOR = {
  LOGIN_SUCCESS:           'text-emerald-700 dark:text-green-400',
  LOGIN_FAILED:            'text-red-700 dark:text-red-400',
  ACCOUNT_LOCKED:          'text-amber-800 dark:text-amber-400',
  LOGOUT:                  'text-ink-secondary',
  USER_CREATED:            'text-accent',
  ROLE_CHANGED:            'text-amber-800 dark:text-amber-400',
  INSPECTION_LOGGED:       'text-indigo-700 dark:text-indigo-400',
  PASSWORD_CHANGED:        'text-amber-800 dark:text-amber-400',
  MODEL_RETRAIN_TRIGGERED: 'text-accent',
  ACCOUNT_UNLOCKED:        'text-emerald-700 dark:text-green-400',
  USER_DELETED:            'text-red-700 dark:text-red-400',
  MODEL_VERSION_SEEDED:    'text-accent',
  MODEL_VERSION_ACTIVATED: 'text-accent',
};
const LIMIT = 50;

export default function AuditLogPage() {
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get('page') || 1);
  const { logs, total, loading, error } = useAuditLog({ page, limit: LIMIT });
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <PageShell title="Audit Log"
      subtitle={total ? `${total.toLocaleString()} events recorded` : 'Full system audit trail'}>
      <ErrorAlert message={error} className="mb-4" />

      <section aria-label="Audit log table" className="card overflow-hidden">
        <div className="overflow-x-auto table-responsive">
          <table className="data-table" aria-label="System audit events">
            <thead>
              <tr>
                <th scope="col">Timestamp</th>
                <th scope="col">Action</th>
                <th scope="col" className="hidden sm:table-cell">Actor</th>
                <th scope="col" className="hidden md:table-cell">IP</th>
                <th scope="col" className="hidden lg:table-cell">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <SkeletonRows cols={[70,60,80,50,90]} rows={15} />
                : logs.length === 0
                  ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState icon={ScrollText} title="No audit events yet"
                          sub="Events are recorded automatically as the system is used." />
                      </td>
                    </tr>
                  )
                  : logs.map(log => (
                    <tr key={log.id}>
                      <td className="font-mono text-[10px] text-ink-muted whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span className={cn('font-mono text-xs font-semibold', ACTION_COLOR[log.action] || 'text-ink-secondary')}>
                          {log.action}
                        </span>
                      </td>
                      <td className="text-xs text-ink-secondary hidden sm:table-cell">
                        {log.actorEmail ?? <span className="text-ink-muted italic">system</span>}
                      </td>
                      <td className="font-mono text-[10px] text-ink-muted hidden md:table-cell">
                        {log.ip ?? '—'}
                      </td>
                      <td className="text-[10px] text-ink-muted font-mono max-w-xs truncate hidden lg:table-cell">
                        {log.metadata ? JSON.stringify(log.metadata) : '—'}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        <Pagination
          page={page} totalPages={totalPages} total={total}
          onPrev={() => { const n = new URLSearchParams(sp); n.set('page', page-1); setSp(n); }}
          onNext={() => { const n = new URLSearchParams(sp); n.set('page', page+1); setSp(n); }}
        />
      </section>
    </PageShell>
  );
}
