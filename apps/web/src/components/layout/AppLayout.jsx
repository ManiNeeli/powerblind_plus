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
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          'fixed top-0 left-0 h-full z-30 flex flex-col bg-canvas-50 border-r border-surface-border transition-all duration-200',
          collapsed ? 'w-16' : 'w-56',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center h-14 px-4 border-b border-surface-border shrink-0 gap-2.5', collapsed && 'justify-center')}>
          <div className="w-7 h-7 rounded-md bg-accent/20 flex items-center justify-center shrink-0 border border-accent/30">
            <Zap className="w-4 h-4 text-accent" aria-hidden />
          </div>
          {!collapsed && (
            <span className="font-bold text-sm text-ink-primary tracking-tight">
              PowerBlind<span className="text-accent">+</span>
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 overflow-y-auto" aria-label="Sidebar navigation">
          <NavSection collapsed={collapsed} items={operatorNav} />
          {isAdmin && (
            <>
              <div className="my-3 border-t border-surface-border mx-3" role="separator" />
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted px-4 mb-2" aria-label="Admin section">
                  Admin
                </p>
              )}
              <NavSection collapsed={collapsed} items={adminNav} />
            </>
          )}
        </nav>

        {/* ⌘K hint */}
        {!collapsed && (
          <button
            onClick={() => setCmdOpen(true)}
            aria-label="Open search (Cmd+K)"
            className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-md border border-surface-border text-ink-secondary text-xs hover:border-accent/40 hover:text-ink-primary transition-colors focus-visible:ring-1 focus-visible:ring-accent"
          >
            <span className="text-[10px] font-mono bg-surface-border rounded px-1">⌘K</span>
            <span>Search consumers…</span>
          </button>
        )}

        {/* Theme toggle + user footer */}
        <div className={cn('border-t border-surface-border p-3 flex items-center gap-2 shrink-0', collapsed && 'flex-col gap-2')}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="text-ink-muted hover:text-ink-primary transition-colors p-1 rounded"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {!collapsed && (
            <>
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <span className="text-accent text-xs font-bold">{user?.email?.[0]?.toUpperCase() ?? 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink-primary truncate">{user?.email}</p>
                <p className="text-[10px] text-ink-secondary">{user?.role}</p>
              </div>
              <button onClick={handleLogout} title="Sign out" aria-label="Sign out"
                className="text-ink-muted hover:text-red-400 transition-colors p-1 rounded">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-canvas-50 border border-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface transition-colors items-center justify-center hidden lg:flex shadow-card"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className={cn('flex-1 flex flex-col min-w-0 transition-all duration-200', collapsed ? 'lg:ml-16' : 'lg:ml-56')}>
        {/* Mobile top-bar */}
        <div className="h-14 border-b border-surface-border flex items-center px-4 gap-3 lg:hidden shrink-0 bg-canvas-50">
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu" className="text-ink-secondary hover:text-ink-primary transition-colors">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-sm text-ink-primary">PowerBlind<span className="text-accent">+</span></span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleTheme} aria-label="Toggle theme" className="text-ink-muted hover:text-ink-primary transition-colors p-1">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" aria-label="Connected" />
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
    <div className="px-2 space-y-0.5">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to}
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-all duration-150 group relative',
            isActive ? 'bg-accent/10 text-accent font-medium' : 'text-ink-secondary hover:bg-surface hover:text-ink-primary',
            collapsed && 'justify-center',
          )}
        >
          <Icon className="w-4 h-4 shrink-0" aria-hidden />
          {!collapsed && <span>{label}</span>}
          {collapsed && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-surface border border-surface-border rounded text-xs text-ink-primary whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-card" role="tooltip">
              {label}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );
}
