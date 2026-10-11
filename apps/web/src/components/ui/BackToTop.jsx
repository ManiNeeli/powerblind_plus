import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop;
      setVisible(scrollPos > 250);
    };

    window.addEventListener('scroll', checkScroll, { passive: true });
    return () => window.removeEventListener('scroll', checkScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.getElementById('main-content');
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll back to top"
      title="Scroll to top"
      className={cn(
        'fixed bottom-6 right-6 z-40 p-2.5 rounded-full bg-surface-border/80 border border-surface-border text-ink-primary shadow-glass backdrop-blur-md',
        'hover:bg-accent hover:text-ink-inverse hover:border-accent hover:shadow-glow-accent transition-all duration-200 transform hover:-translate-y-1',
        'focus-visible:ring-2 focus-visible:ring-accent no-print'
      )}
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
