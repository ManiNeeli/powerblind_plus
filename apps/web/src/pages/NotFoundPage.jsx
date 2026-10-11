import { useNavigate, Link } from 'react-router-dom';
import { Zap, Home, Users, ClipboardList, Search, Phone, Mail, ArrowLeft } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';

export default function NotFoundPage() {
  const navigate = useNavigate();

  usePageMeta({
    title: '404 Page Not Found',
    description: 'The requested route does not exist in the PowerBlind+ Grid Operations Console.',
  });

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12 relative overflow-hidden max-w-full">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full text-center space-y-6 animate-fade-in relative z-10">
        {/* Clickable Brand Logo */}
        <Link to="/dashboard" className="inline-flex items-center justify-center gap-2.5 group cursor-pointer p-2 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center border border-accent/30 shadow-glow-accent group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5 text-accent" />
          </div>
          <span className="font-bold text-xl text-ink-primary tracking-tight group-hover:text-accent transition-colors">
            PowerBlind<span className="text-accent">+</span>
          </span>
        </Link>

        {/* 404 Headline */}
        <div className="py-2">
          <p className="font-mono text-8xl font-black text-surface-border tracking-widest select-none drop-shadow-sm">
            404
          </p>
          <h1 className="text-xl font-bold text-ink-primary mt-2">Telemetry Route Disconnected</h1>
          <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed max-w-sm mx-auto">
            The requested operations page does not exist or has been relocated within the AMI grid console.
          </p>
        </div>

        {/* Quick Action Navigation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="p-3 rounded-xl bg-surface/50 border border-surface-border hover:border-accent/40 hover:bg-surface transition-all flex flex-col items-center text-center gap-1.5 group"
          >
            <Home className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-ink-primary">Dashboard</span>
            <span className="text-[10px] text-ink-muted">Grid Overview</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/consumers')}
            className="p-3 rounded-xl bg-surface/50 border border-surface-border hover:border-accent/40 hover:bg-surface transition-all flex flex-col items-center text-center gap-1.5 group"
          >
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-ink-primary">Consumers</span>
            <span className="text-[10px] text-ink-muted">5,000 Profiles</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/inspections')}
            className="p-3 rounded-xl bg-surface/50 border border-surface-border hover:border-accent/40 hover:bg-surface transition-all flex flex-col items-center text-center gap-1.5 group"
          >
            <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-ink-primary">Inspections</span>
            <span className="text-[10px] text-ink-muted">Field Queue</span>
          </button>
        </div>

        {/* Back Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg btn-primary text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Previous Screen
          </button>
        </div>

        {/* Support Hotline */}
        <div className="pt-4 border-t border-surface-border flex items-center justify-center gap-4 text-xs text-ink-muted font-mono">
          <a href="tel:+18005550199" className="hover:text-accent flex items-center gap-1 transition-colors">
            <Phone className="w-3 h-3 text-accent" />
            <span>+1 (800) 555-0199</span>
          </a>
          <span>•</span>
          <a href="mailto:support@powerblind.local" className="hover:text-accent flex items-center gap-1 transition-colors">
            <Mail className="w-3 h-3 text-accent" />
            <span>support@powerblind.local</span>
          </a>
        </div>
      </div>
    </div>
  );
}
