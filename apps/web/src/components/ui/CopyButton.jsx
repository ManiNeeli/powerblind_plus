import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { cn } from '../../lib/utils';

export default function CopyButton({ text, label = 'Copy', className, showLabel = false }) {
  const [copied, setCopied] = useState(false);
  const { toastSuccess } = useToast();

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
      setCopied(true);
      toastSuccess(`Copied "${text.length > 24 ? text.slice(0, 24) + '…' : text}" to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={copied ? 'Copied!' : label}
      className={cn(
        'inline-flex items-center gap-1.5 p-1 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors focus-visible:ring-1 focus-visible:ring-accent',
        copied && 'text-accent hover:text-accent',
        className
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-accent animate-scale-up" /> : <Copy className="w-3.5 h-3.5" />}
      {showLabel && <span className="text-xs">{copied ? 'Copied' : label}</span>}
    </button>
  );
}
