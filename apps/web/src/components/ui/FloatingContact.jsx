import { useState } from 'react';
import { Phone, Mail, MessageSquare, X, ShieldAlert, Clock, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import CopyButton from './CopyButton';

export default function FloatingContact() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-20 z-40 no-print">
      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Open support and grid contact options"
        title="Contact Grid Operations & Support"
        className={cn(
          'p-2.5 rounded-full border shadow-glass backdrop-blur-md transition-all duration-200 transform hover:-translate-y-1',
          open
            ? 'bg-accent text-ink-inverse border-accent shadow-glow-accent'
            : 'bg-surface-border/80 border-surface-border text-ink-primary hover:bg-surface hover:border-accent/40'
        )}
      >
        {open ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
      </button>

      {/* Floating Modal / Popover */}
      {open && (
        <div
          role="region"
          aria-label="Grid support contact information"
          className="absolute bottom-12 right-0 w-80 card-glass p-5 border border-surface-border shadow-glass rounded-2xl animate-slide-up mb-2"
        >
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold text-ink-primary uppercase tracking-wide">
                Operations Support
              </h3>
            </div>
            <span className="text-[10px] font-mono text-ink-muted">24/7 Grid Dispatch</span>
          </div>

          <div className="py-3 space-y-3">
            {/* Phone link */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface/60 border border-surface-border/60 hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-ink-muted">Dispatch Hotline</p>
                  <a
                    href="tel:+18005550199"
                    className="text-xs font-mono font-semibold text-ink-primary hover:text-accent transition-colors"
                  >
                    +1 (800) 555-0199
                  </a>
                </div>
              </div>
              <CopyButton text="+18005550199" label="Copy phone" />
            </div>

            {/* Email link */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface/60 border border-surface-border/60 hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-ink-muted">Grid Engineering</p>
                  <a
                    href="mailto:support@powerblind.local"
                    className="text-xs font-mono font-semibold text-ink-primary hover:text-accent transition-colors truncate block max-w-[150px]"
                  >
                    support@powerblind.local
                  </a>
                </div>
              </div>
              <CopyButton text="support@powerblind.local" label="Copy email" />
            </div>

            {/* Emergency status */}
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 text-[11px] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Report high-voltage tampering immediately to emergency crews.</span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-surface-border flex items-center justify-between text-[10px] text-ink-muted font-mono">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Average response: &lt; 2 min
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
