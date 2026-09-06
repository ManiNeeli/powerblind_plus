import { useState, useId } from 'react';
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth }  from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useMutation } from '../hooks/useApi';
import { api }         from '../lib/api';
import PageShell       from '../components/layout/PageShell';
import { Badge, FormField, Input, Divider } from '../components/ui/index.jsx';
import { cn } from '../lib/utils';

function PasswordField({ id, label, value, onChange, show, onToggle, hint }) {
  return (
    <FormField label={label} htmlFor={id} hint={hint}>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} value={value}
          onChange={onChange} required className="pr-9" />
        <button type="button" onClick={onToggle}
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors">
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </FormField>
  );
}

export default function SettingsPage() {
  const { user }                    = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { toastSuccess }            = useToast();
  const { mutate, loading, error, clearError } = useMutation();

  const currentId   = useId();
  const newPwId     = useId();
  const confirmId   = useId();

  const [form,     setForm]     = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [show,     setShow]     = useState({});
  const [success,  setSuccess]  = useState(false);
  const [localErr, setLocalErr] = useState('');

  const toggleShow = (key) => setShow(s => ({ ...s, [key]: !s[key] }));
  const setF = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const changePassword = async (e) => {
    e.preventDefault();
    clearError(); setLocalErr(''); setSuccess(false);
    if (form.newPassword !== form.confirm) { setLocalErr('New passwords do not match.'); return; }
    try {
      await mutate(() => api.post('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      }));
      setSuccess(true);
      setForm({ currentPassword:'', newPassword:'', confirm:'' });
      toastSuccess('Password changed successfully.');
    } catch { /* error shown via hook */ }
  };

  const displayError = localErr || error;

  return (
    <PageShell title="Settings" subtitle="Account preferences and security">
      <div className="max-w-lg space-y-4">

        {/* Account info */}
        <section aria-label="Account information" className="card p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-ink-secondary mb-4">
            Account
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-secondary">Email</span>
              <span className="text-sm font-medium text-ink-primary">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-secondary">Role</span>
              <Badge label={user?.role} />
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section aria-label="Appearance settings" className="card p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-ink-secondary mb-4">
            Appearance
          </h2>
          <div className="flex gap-3">
            {[
              { id:'dark',  label:'Dark',  icon: Moon,    desc:'Grid Ops default' },
              { id:'light', label:'Light', icon: Sun,     desc:'High-contrast'    },
            ].map(({ id, label, icon: Icon, desc }) => (
              <button key={id}
                onClick={() => theme !== id && toggleTheme()}
                aria-pressed={theme === id}
                className={cn(
                  'flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                  theme === id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-surface-border text-ink-secondary hover:border-accent/40 hover:text-ink-primary'
                )}>
                <Icon className="w-5 h-5" aria-hidden />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-[10px] text-ink-muted">{desc}</p>
                </div>
                {theme === id && (
                  <CheckCircle className="w-3.5 h-3.5 text-accent" aria-label="Selected" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Change password */}
        <section aria-label="Change password" className="card p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-ink-secondary mb-4">
            Change Password
          </h2>

          {success && (
            <div role="status" className="mb-4 flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2.5">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
              Password changed successfully.
            </div>
          )}

          {displayError && (
            <div role="alert" className="mb-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
              {displayError}
            </div>
          )}

          <form onSubmit={changePassword} noValidate className="space-y-3">
            <PasswordField
              id={currentId} label="Current Password"
              value={form.currentPassword} onChange={setF('currentPassword')}
              show={show.current} onToggle={() => toggleShow('current')}
            />
            <PasswordField
              id={newPwId} label="New Password"
              value={form.newPassword} onChange={setF('newPassword')}
              show={show.newPw} onToggle={() => toggleShow('newPw')}
              hint="Min 10 chars · 1 uppercase · 1 number · 1 symbol"
            />
            <PasswordField
              id={confirmId} label="Confirm New Password"
              value={form.confirm} onChange={setF('confirm')}
              show={show.confirm} onToggle={() => toggleShow('confirm')}
            />

            <button type="submit" disabled={loading} aria-busy={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-1 rounded-md bg-accent text-[#0d1117] text-sm font-semibold hover:bg-[#009e80] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              Update Password
            </button>
          </form>
        </section>

        {/* Keyboard shortcuts */}
        <section aria-label="Keyboard shortcuts" className="card p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-ink-secondary mb-4">
            Keyboard Shortcuts
          </h2>
          <div className="space-y-2">
            {[
              ['⌘K / Ctrl+K', 'Open consumer search'],
              ['↑ / ↓',        'Navigate search results'],
              ['↵',            'Open selected result'],
              ['Esc',          'Close any dialog'],
              ['Tab',          'Move between focusable elements'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-ink-secondary">{desc}</span>
                <kbd className="font-mono text-[10px] bg-surface border border-surface-border rounded px-2 py-0.5 text-ink-primary">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </section>

      </div>
    </PageShell>
  );
}
