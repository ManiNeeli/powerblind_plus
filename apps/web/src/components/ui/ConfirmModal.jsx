import { useEffect } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ConfirmModal({
  open,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const handleKey = (e) => {
      if (open && e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in no-print"
    >
      <div className="card-glass w-full max-w-md p-6 border border-surface-border shadow-glass rounded-2xl relative animate-scale-up">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-ink-muted hover:text-ink-primary p-1.5 rounded-lg hover:bg-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
            isDestructive
              ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400'
              : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400'
          )}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 id="confirm-modal-title" className="text-base font-bold text-ink-primary">
              {title}
            </h2>
            <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-border">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-ink-secondary hover:text-ink-primary hover:bg-surface border border-surface-border transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm',
              isDestructive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-accent hover:brightness-110 text-ink-inverse'
            )}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
