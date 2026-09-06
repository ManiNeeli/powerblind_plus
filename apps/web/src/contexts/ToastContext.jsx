import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES = {
  success: 'border-risk-normal/30 bg-risk-normal-muted text-risk-normal',
  error:   'border-risk-theft/30  bg-risk-theft-muted  text-risk-theft',
  warning: 'border-risk-fault/30  bg-risk-fault-muted  text-risk-fault',
  info:    'border-accent/30      bg-accent/10          text-accent',
};

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(ts => ts.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 300);
  }, []);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id;
    setToasts(ts => [...ts, { id, message, type, leaving: false }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toastSuccess = useCallback((msg, dur) => toast(msg, 'success', dur), [toast]);
  const toastError   = useCallback((msg, dur) => toast(msg, 'error',   dur), [toast]);
  const toastWarning = useCallback((msg, dur) => toast(msg, 'warning', dur), [toast]);
  const toastInfo    = useCallback((msg, dur) => toast(msg, 'info',    dur), [toast]);

  return (
    <ToastContext.Provider value={{ toast, toastSuccess, toastError, toastWarning, toastInfo, dismiss }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const Icon = ICONS[t.type] ?? Info;
          return (
            <div
              key={t.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-card-hover pointer-events-auto',
                'transition-all duration-300',
                STYLES[t.type],
                t.leaving ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slide-up',
              )}
            >
              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-sm flex-1 leading-relaxed">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
