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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient background glow orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full pointer-events-none opacity-40 blur-[100px] bg-accent/15" aria-hidden />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full pointer-events-none opacity-30 blur-[110px] bg-[#6366f1]/20" aria-hidden />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
           style={{ backgroundImage:'linear-gradient(#00f2b2 1px,transparent 1px),linear-gradient(90deg,#00f2b2 1px,transparent 1px)', backgroundSize:'48px 48px' }}
           aria-hidden />

      {/* Theme toggle */}
      <button onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="absolute top-5 right-5 text-ink-muted hover:text-ink-primary transition-colors p-2 rounded-lg bg-surface/40 hover:bg-surface border border-surface-border backdrop-blur-sm">
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="relative w-full max-w-md animate-fade-in z-10">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center justify-center mb-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center border border-accent/30 shadow-glow-accent mb-3 group hover:scale-105 transition-transform duration-300">
            <Zap className="w-6 h-6 text-accent" aria-hidden />
          </div>
          <span className="text-2xl font-black text-ink-primary tracking-tight">
            PowerBlind<span className="text-accent">+</span>
          </span>
          <span className="text-xs text-ink-secondary mt-1 tracking-wide font-medium">
            AI-Powered Non-Technical Loss Detection
          </span>
        </div>

        {/* Login Card */}
        <div className="card-glass p-8 border border-white/10 shadow-glass rounded-2xl" role="main">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-base font-bold text-ink-primary tracking-tight">Operator Sign In</h1>
              <p className="text-xs text-ink-muted mt-0.5">Enter your grid credentials</p>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-surface-border/50 border border-surface-border text-[10px] font-mono text-ink-muted">
              SECURE V2.0
            </div>
          </div>

          {sessionExpired && !error && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 text-xs text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              <span>Your session expired. Please sign in again.</span>
            </div>
          )}

          {error && (
            <div role="alert" className={cn('mb-5 flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-xs backdrop-blur-sm',
              locked ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                     : 'bg-red-500/10 border border-red-500/30 text-red-400')}>
              {locked ? <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor={emailId} className="block text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-1.5">
                Operator Email
              </label>
              <input id={emailId} type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" required aria-required="true"
                aria-describedby={error && !locked ? 'login-error' : undefined}
                className="form-input"
                placeholder="operator@utility.com" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={passwordId} className="block text-[10px] font-bold uppercase tracking-wider text-ink-secondary">
                  Password
                </label>
              </div>
              <div className="relative">
                <input id={passwordId} type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                  required aria-required="true"
                  className="form-input pr-10"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors p-1">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input id="remember" type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-surface-border bg-canvas accent-accent cursor-pointer" />
              <label htmlFor="remember" className="text-xs text-ink-secondary cursor-pointer select-none">
                Remember session on this station
              </label>
            </div>

            <button type="submit" disabled={loading || locked}
              aria-busy={loading}
              className="w-full btn-primary py-3 mt-2 text-sm font-bold tracking-wide">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />Authenticating…</> : 'Access Command Center'}
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-ink-muted font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-normal-DEFAULT" />
          <span>Grid Operations Center · PowerBlind+ Enterprise</span>
        </div>
      </div>
    </div>
  );
}
