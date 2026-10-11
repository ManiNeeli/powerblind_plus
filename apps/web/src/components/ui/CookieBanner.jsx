import { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'powerblind_cookie_consent';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) setShow(true);
    } catch {
      // Storage unavailable
    }
  }, []);

  const acceptAll = () => {
    try { localStorage.setItem(STORAGE_KEY, 'all'); } catch {}
    setShow(false);
  };

  const acceptEssential = () => {
    try { localStorage.setItem(STORAGE_KEY, 'essential'); } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:max-w-md z-50 card-glass p-4 border border-surface-border shadow-glass rounded-xl animate-slide-up no-print"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink-primary">Grid Operations Cookie Notice</p>
          <p className="text-[11px] text-ink-secondary mt-1 leading-relaxed">
            PowerBlind+ uses essential session cookies for authentication, audit logging, and security telemetry.
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={acceptAll}
              className="px-3 py-1.5 rounded-lg bg-accent text-ink-inverse text-xs font-bold hover:brightness-110 transition-all shadow-sm"
            >
              Accept All
            </button>
            <button
              type="button"
              onClick={acceptEssential}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-ink-primary text-xs font-medium transition-all"
            >
              Essential Only
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={acceptEssential}
          aria-label="Dismiss cookie notice"
          className="text-ink-muted hover:text-ink-primary p-1 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
