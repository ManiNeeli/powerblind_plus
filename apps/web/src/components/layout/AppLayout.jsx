import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth }  from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard, Users, ClipboardList, Settings,
  ScrollText, UserCog, Activity, LogOut, Zap,
  ChevronLeft, ChevronRight, Menu, X, Sun, Moon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import CommandPalette from '../ui/CommandPalette';

const operatorNav = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/consumers',   icon: Users,            label: 'Consumers'  },
  { to: '/inspections', icon: ClipboardList,    label: 'Inspections'},
  { to: '/settings',    icon: Settings,         label: 'Settings'   },
];
const adminNav = [
  { to: '/audit-log',    icon: ScrollText, label: 'Audit Log'    },
  { to: '/users',        icon: UserCog,    label: 'User Mgmt'    },
  { to: '/model-health', icon: Activity,   label: 'Model Health' },
];

export default function AppLayout() {
  const { user, isAdmin, logout }         = useAuth();
  const { toastSuccess }                  = useToast();
  const { theme, toggle: toggleTheme }    = useTheme();
  const navigate                          = useNavigate();
  const [collapsed,   setCollapsed]       = useState(false);
  const [mobileOpen,  setMobileOpen]      = useState(false);
  const [cmdOpen,     setCmdOpen]         = useState(false);

  const handleLogout = async () => {
    await logout();
    toastSuccess('Signed out successfully.');
    navigate('/login');
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true); }
  };

  return (
    <div className="min-h-screen flex bg-canvas" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          'fixed top-0 left-0 h-full z-30 flex flex-col bg-canvas-50/90 backdrop-blur-xl border-r border-surface-border transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo & Grid Status */}
        <div className={cn('flex flex-col justify-center px-4 py-3 border-b border-surface-border shrink-0 min-h-[64px]', collapsed && 'items-center px-2')}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0 border border-accent/30 shadow-glow-accent">
              <Zap className="w-4 h-4 text-accent" aria-hidden />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm text-ink-primary tracking-tight">
                  PowerBlind<span className="text-accent">+</span>
                </span>
                <span className="text-[10px] font-mono text-ink-muted">AI Grid Operations</span>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="mt-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-normal-muted/50 border border-normal-DEFAULT/20 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-normal-DEFAULT animate-pulse shadow-glow-normal" />
              <span className="text-[10px] font-mono font-medium text-normal-DEFAULT tracking-wider uppercase">Grid Sync Active</span>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 overflow-y-auto" aria-label="Sidebar navigation">
          <NavSection collapsed={collapsed} items={operatorNav} />
          {isAdmin && (
            <>
              <div className="my-3 border-t border-surface-border mx-3" role="separator" />
              {!collapsed && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted px-4 mb-2" aria-label="Admin section">
                  Admin Controls
                </p>
              )}
              <NavSection collapsed={collapsed} items={adminNav} />
            </>
          )}
        </nav>

        {/* ⌘K search hint */}
        {!collapsed && (
          <button
            onClick={() => setCmdOpen(true)}
            aria-label="Open search (Cmd+K)"
            className="mx-3 mb-3 flex items-center justify-between px-3 py-2 rounded-lg border border-surface-border bg-surface/40 backdrop-blur-sm text-ink-secondary text-xs hover:border-accent/40 hover:text-ink-primary hover:bg-surface transition-all group focus-visible:ring-1 focus-visible:ring-accent"
          >
            <span className="truncate">Search consumers…</span>
            <kbd className="text-[10px] font-mono bg-surface-border/80 border border-surface-border px-1.5 py-0.5 rounded text-ink-primary group-hover:border-accent/30">⌘K</kbd>
          </button>
        )}

        {/* Theme toggle + user footer */}
        <div className={cn('border-t border-surface-border p-3 flex items-center gap-2.5 shrink-0 bg-surface/20', collapsed && 'flex-col gap-2')}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="text-ink-muted hover:text-ink-primary transition-colors p-1.5 rounded-md hover:bg-surface border border-transparent hover:border-surface-border"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {!collapsed && (
            <>
              <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                <span className="text-accent text-xs font-bold font-mono">{user?.email?.[0]?.toUpperCase() ?? 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink-primary truncate">{user?.email}</p>
                <span className="inline-block text-[9px] font-mono font-semibold uppercase text-accent bg-accent/10 px-1.5 py-0.2 rounded border border-accent/20">
                  {user?.role}
                </span>
              </div>
              <button onClick={handleLogout} title="Sign out" aria-label="Sign out"
                className="text-ink-muted hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-red-500/10 border border-transparent hover:border-red-500/20">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-canvas-50 border border-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface transition-all items-center justify-center hidden lg:flex shadow-card hover:border-accent/40"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className={cn('flex-1 flex flex-col min-w-0 transition-all duration-200', collapsed ? 'lg:ml-16' : 'lg:ml-60')}>
        {/* Mobile top-bar */}
        <div className="h-14 border-b border-surface-border flex items-center px-4 gap-3 lg:hidden shrink-0 bg-canvas-50/90 backdrop-blur-md">
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu" className="text-ink-secondary hover:text-ink-primary transition-colors p-1 rounded hover:bg-surface">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center border border-accent/30">
              <Zap className="w-3.5 h-3.5 text-accent" />
            </div>
            <span className="font-bold text-sm text-ink-primary">PowerBlind<span className="text-accent">+</span></span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleTheme} aria-label="Toggle theme" className="text-ink-muted hover:text-ink-primary transition-colors p-1.5 rounded hover:bg-surface">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="w-2 h-2 rounded-full bg-normal-DEFAULT animate-pulse shadow-glow-normal" aria-label="Connected" />
          </div>
        </div>

        <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}

function NavSection({ collapsed, items }) {
  return (
    <div className="px-2 space-y-1">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to}
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group relative',
            isActive
              ? 'bg-accent/15 text-accent font-semibold shadow-[inset_3px_0_0_0_#00f2b2] border-r-0'
              : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary',
            collapsed && 'justify-center px-2',
          )}
        >
          <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" aria-hidden />
          {!collapsed && <span>{label}</span>}
          {collapsed && (
            <span className="absolute left-full ml-2 px-2.5 py-1 bg-surface border border-surface-border rounded-md text-xs font-medium text-ink-primary whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-glass" role="tooltip">
              {label}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );
}
