import { useEffect, useRef, useState, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, AlertTriangle, Gauge, Wifi, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

const LABEL_META = {
  Theft:       { icon: AlertTriangle, cls: 'text-red-400'    },
  FaultyMeter: { icon: Gauge,         cls: 'text-amber-400'  },
  CommFailure: { icon: Wifi,          cls: 'text-indigo-400' },
  Normal:      { icon: Zap,           cls: 'text-green-400'  },
};

export default function CommandPalette({ open, onClose }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef   = useRef(null);
  const listboxId  = useId();
  const navigate   = useNavigate();

  useEffect(() => {
    if (open) { setQuery(''); setResults([]); setSelectedIdx(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await api.get(`/api/consumers?search=${encodeURIComponent(q)}&limit=8`);
      setResults(data.consumers ?? []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 180);
    return () => clearTimeout(t);
  }, [query, search]);

  const select = (c) => { navigate(`/consumers/${c.id}`); onClose(); };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i+1, results.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i-1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) select(results[selectedIdx]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4"
         role="dialog" aria-modal="true" aria-label="Consumer search"
         onClick={onClose}>
      <div className="w-full max-w-xl bg-canvas-100 rounded-xl border border-surface-border shadow-card-hover animate-slide-up"
           onClick={e => e.stopPropagation()}>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <Search className="w-4 h-4 text-ink-secondary shrink-0" aria-hidden />
          <input ref={inputRef} value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search consumers by ID… (e.g. C00042)"
            aria-label="Search consumers"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={results[selectedIdx] ? `cmd-result-${selectedIdx}` : undefined}
            role="combobox" aria-expanded={results.length > 0}
            className="flex-1 bg-transparent text-sm text-ink-primary placeholder-ink-muted outline-none"
          />
          {loading && <div className="w-4 h-4 rounded-full border border-surface-border border-t-accent animate-spin" aria-label="Searching…" />}
          <button onClick={onClose} aria-label="Close search" className="text-ink-muted hover:text-ink-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul id={listboxId} role="listbox" aria-label="Search results" className="py-1 max-h-64 overflow-y-auto">
            {results.map((c, i) => {
              const meta = LABEL_META[c.groundTruthLabel] ?? LABEL_META.Normal;
              const Icon = meta.icon;
              return (
                <li key={c.id} id={`cmd-result-${i}`} role="option" aria-selected={i === selectedIdx}>
                  <button className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left', i === selectedIdx ? 'bg-surface' : 'hover:bg-surface')}
                    onClick={() => select(c)} onMouseEnter={() => setSelectedIdx(i)}>
                    <Icon className={cn('w-4 h-4 shrink-0', meta.cls)} aria-hidden />
                    <span className="font-mono text-ink-primary">{c.id}</span>
                    <span className="text-[10px] text-ink-muted">{c.consumerType}</span>
                    <span className={cn('ml-auto text-[10px] font-semibold', meta.cls)}>{c.groundTruthLabel}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {query && !loading && results.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-ink-muted" role="status">
            No consumers found for <span className="font-mono text-ink-secondary">"{query}"</span>
          </p>
        )}

        {!query && (
          <p className="px-4 py-4 text-xs text-ink-muted text-center" aria-live="polite">
            Type a consumer ID (e.g. C00042) to jump to their profile
          </p>
        )}

        {/* Keyboard hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-surface-border" aria-hidden>
          {[['↑↓','Navigate'],['↵','Open'],['Esc','Close']].map(([k,l]) => (
            <span key={k} className="flex items-center gap-1.5 text-[10px] text-ink-muted">
              <kbd className="font-mono bg-surface-border rounded px-1.5 py-0.5">{k}</kbd>{l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
