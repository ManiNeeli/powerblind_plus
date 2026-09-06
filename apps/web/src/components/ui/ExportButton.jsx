import { useState } from 'react';
import { Download, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const EXPORTS = [
  { label:'Consumers CSV',   path:'/api/export/consumers',   file:'consumers'   },
  { label:'Predictions CSV', path:'/api/export/predictions', file:'predictions' },
  { label:'Inspections CSV', path:'/api/export/inspections', file:'inspections' },
];

export default function ExportButton({ className }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(null);

  const doExport = async (path, filename) => {
    setLoading(filename); setOpen(false);
    try {
      const res = await fetch(path, { credentials:'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href: url, download: `powerblind-${filename}-${Date.now()}.csv`,
      });
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true"
        aria-label="Export data"
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface border border-surface-border text-sm text-ink-secondary hover:text-ink-primary hover:border-accent/40 transition-colors">
        <Download className="w-3.5 h-3.5" />
        Export
        <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="absolute right-0 mt-1 w-48 bg-canvas-50 border border-surface-border rounded-lg shadow-card-hover z-40 py-1 animate-slide-up">
            {EXPORTS.map(({ label, path, file }) => (
              <button key={file} role="menuitem" onClick={() => doExport(path, file)} disabled={loading === file}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink-secondary hover:bg-surface hover:text-ink-primary transition-colors disabled:opacity-60">
                {loading === file
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  : <Download className="w-3.5 h-3.5 shrink-0" />}
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
