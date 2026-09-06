import { useNavigate } from 'react-router-dom';
import { Zap, Home } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="text-center space-y-5 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Zap className="w-6 h-6 text-accent" />
          <span className="font-bold text-lg text-ink-primary">PowerBlind<span className="text-accent">+</span></span>
        </div>
        <p className="font-mono text-7xl font-bold text-surface-border select-none">404</p>
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-ink-primary">Page not found</h1>
          <p className="text-sm text-ink-secondary">That route doesn't exist in the Grid Operations Console.</p>
        </div>
        <button onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent/10 text-accent border border-accent/30 text-sm hover:bg-accent/20 transition-colors">
          <Home className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
