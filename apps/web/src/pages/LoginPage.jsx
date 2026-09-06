import { useState, useId } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth }  from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Zap, Eye, EyeOff, AlertCircle, Loader2, ShieldAlert, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';

export default function LoginPage() {
  const { login }                   = useAuth();
  const { theme, toggle }           = useTheme();
  const navigate                    = useNavigate();
  const location                    = useLocation();
  const from                        = location.state?.from?.pathname || '/dashboard';

  const emailId    = useId();
  const passwordId = useId();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [locked,     setLocked]     = useState(false);

  const sessionExpired = location.state?.sessionExpired;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    setError(''); setLocked(false); setLoading(true);
    try {
      await login(email, password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      if      (err.status === 429) setError('Too many login attempts. Please wait 15 minutes.');
      else if (err.status === 423) { setLocked(true); setError('Account temporarily locked. Contact an administrator.'); }
      else                         setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 relative">
      {/* Grid bg */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
           style={{ backgroundImage:'linear-gradient(#00c8a0 1px,transparent 1px),linear-gradient(90deg,#00c8a0 1px,transparent 1px)', backgroundSize:'60px 60px' }}
           aria-hidden />

      {/* Theme toggle */}
      <button onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="absolute top-4 right-4 text-ink-muted hover:text-ink-primary transition-colors p-2 rounded-md hover:bg-surface">
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center border border-accent/30 shadow-glow-accent">
            <Zap className="w-5 h-5 text-accent" aria-hidden />
          </div>
          <span className="text-xl font-bold text-ink-primary tracking-tight">
            PowerBlind<span className="text-accent">+</span>
          </span>
        </div>

        <div className="card p-6" role="main">
          <h1 className="text-base font-semibold text-ink-primary mb-0.5">Operator Sign In</h1>
          <p className="text-xs text-ink-secondary mb-5">Smart Meter Anomaly Detection System</p>

          {sessionExpired && !error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
              Your session expired. Please sign in again.
            </div>
          )}

          {error && (
            <div role="alert" className={cn('mb-4 flex items-start gap-2 rounded-md px-3 py-2.5 text-xs',
              locked ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                     : 'bg-red-500/10 border border-red-500/20 text-red-400')}>
              {locked ? <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor={emailId} className="block text-[10px] font-semibold uppercase tracking-wider text-ink-secondary mb-1.5">
                Email address
              </label>
              <input id={emailId} type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" required aria-required="true"
                aria-describedby={error && !locked ? 'login-error' : undefined}
                className="w-full bg-canvas rounded-md border border-surface-border px-3 py-2 text-sm text-ink-primary placeholder-ink-muted outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors"
                placeholder="operator@utility.com" />
            </div>

            <div>
              <label htmlFor={passwordId} className="block text-[10px] font-semibold uppercase tracking-wider text-ink-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <input id={passwordId} type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                  required aria-required="true"
                  className="w-full bg-canvas rounded-md border border-surface-border px-3 py-2 pr-9 text-sm text-ink-primary placeholder-ink-muted outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors">
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input id="remember" type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-surface-border bg-canvas accent-[#00c8a0] cursor-pointer" />
              <label htmlFor="remember" className="text-xs text-ink-secondary cursor-pointer select-none">
                Remember me for 7 days
              </label>
            </div>

            <button type="submit" disabled={loading || locked}
              aria-busy={loading}
              className={cn('w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold bg-accent text-[#0d1117] transition-all duration-150 hover:bg-[#009e80] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100')}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />Signing in…</> : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[10px] text-ink-muted">
          PowerBlind+ v0.4 · Grid Operations Center
        </p>
      </div>
    </div>
  );
}
