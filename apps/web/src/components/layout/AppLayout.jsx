import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth }  from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard, Users, ClipboardList, Settings,
  ScrollText, UserCog, Activity, LogOut, Zap,
  ChevronLeft, ChevronRight, Menu, X, Sun, Moon,
  Search, Shield, Phone, Mail, HelpCircle, ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils';
import CommandPalette from '../ui/CommandPalette';
import {
  ScrollProgress,
  CookieBanner,
  BackToTop,
  FloatingContact,
  ConfirmModal
} from '../ui/index.jsx';
import { captureUtmParams } from '../../lib/utm';

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
  const location                          = useLocation();

  const [collapsed,       setCollapsed]       = useState(false);
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [cmdOpen,         setCmdOpen]         = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut,      setLoggingOut]      = useState(false);

  // Close mobile navigation drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Capture UTM parameters on initial load
  useEffect(() => {
    captureUtmParams();
  }, []);

  const handleLogoutConfirm = async () => {
    try {
      setLoggingOut(true);
      await logout();
      toastSuccess('Signed out of Grid Operations Command Center.');
      setLogoutModalOpen(false);
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCmdOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas max-w-full overflow-x-hidden relative" onKeyDown={handleKeyDown}>
      {/* ── Accessible Skip to Content Link ─────────────────────────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-ink-inverse focus:font-bold focus:rounded-lg focus:shadow-glow-accent no-print"
      >
        Skip to main content
      </a>

      {/* ── Scroll Progress Bar ────────────────────────────────────────── */}
      <ScrollProgress />

      {/* ── Mobile Backdrop Overlay ────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden no-print animate-fade-in"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex max-w-full overflow-x-hidden">
        {/* ── Desktop & Mobile Responsive Sidebar ──────────────────────── */}
        <aside
          role="navigation"
          aria-label="Main navigation"
          className={cn(
            'fixed top-0 left-0 h-full z-40 flex flex-col bg-canvas-50/95 backdrop-blur-xl border-r border-surface-border transition-all duration-200 no-print',
            collapsed ? 'w-16' : 'w-60',
            mobileOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full lg:translate-x-0',
          )}
        >
          {/* Logo (Clickable -> /dashboard) & Mobile Close */}
          <div className={cn(
            'flex items-center justify-between px-4 py-3.5 border-b border-surface-border shrink-0 min-h-[64px]',
            collapsed && 'items-center px-2 justify-center'
          )}>
            <Link
              to="/dashboard"
              aria-label="PowerBlind+ Home Dashboard"
              className="flex items-center gap-2.5 group cursor-pointer focus-visible:ring-1 focus-visible:ring-accent rounded-lg p-1"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0 border border-accent/30 shadow-glow-accent group-hover:scale-105 transition-transform duration-200">
                <Zap className="w-4 h-4 text-accent" aria-hidden="true" />
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-ink-primary tracking-tight group-hover:text-accent transition-colors">
                    PowerBlind<span className="text-accent">+</span>
                  </span>
                  <span className="text-[10px] font-mono text-ink-muted">AI Grid Operations</span>
                </div>
              )}
            </Link>

            {/* Mobile close button */}
            {mobileOpen && (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close mobile navigation"
                className="lg:hidden text-ink-muted hover:text-ink-primary p-1.5 rounded-lg hover:bg-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Grid Sync Active Status Badge */}
          {!collapsed && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-risk-normal-muted border border-risk-normal/30 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-risk-normal animate-pulse shadow-glow-normal" />
                <span className="text-[10px] font-mono font-medium text-risk-normal tracking-wider uppercase">Grid Sync Active</span>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 py-3 overflow-y-auto" aria-label="Sidebar navigation">
            <NavSection collapsed={collapsed} items={operatorNav} onNavigate={() => setMobileOpen(false)} />
            {isAdmin && (
              <>
                <div className="my-3 border-t border-surface-border mx-3" role="separator" />
                {!collapsed && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted px-4 mb-2" aria-label="Admin section">
                    Admin Controls
                  </p>
                )}
                <NavSection collapsed={collapsed} items={adminNav} onNavigate={() => setMobileOpen(false)} />
              </>
            )}
          </nav>

          {/* ⌘K search trigger button in sidebar */}
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              aria-label="Open search dialog (Ctrl+K or Cmd+K)"
              className="mx-3 mb-3 flex items-center justify-between px-3 py-2 rounded-lg border border-surface-border bg-surface/40 backdrop-blur-sm text-ink-secondary text-xs hover:border-accent/40 hover:text-ink-primary hover:bg-surface transition-all group focus-visible:ring-1 focus-visible:ring-accent"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-ink-muted group-hover:text-accent transition-colors" />
                <span>Search telemetry…</span>
              </span>
              <kbd className="text-[10px] font-mono bg-surface-border/80 border border-surface-border px-1.5 py-0.5 rounded text-ink-primary group-hover:border-accent/30">⌘K</kbd>
            </button>
          )}

          {/* User profile & controls footer */}
          <div className={cn(
            'border-t border-surface-border p-3 flex items-center gap-2.5 shrink-0 bg-surface/20',
            collapsed && 'flex-col gap-2'
          )}>
            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="text-ink-muted hover:text-ink-primary transition-colors p-1.5 rounded-md hover:bg-surface border border-transparent hover:border-surface-border focus-visible:ring-1 focus-visible:ring-accent"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
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
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(true)}
                  title="Sign out"
                  aria-label="Sign out"
                  className="text-ink-muted hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-red-500/10 border border-transparent hover:border-red-500/20 focus-visible:ring-1 focus-visible:ring-red-400"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-canvas-50 border border-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface transition-all items-center justify-center hidden lg:flex shadow-card hover:border-accent/40"
          >
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </aside>

        {/* ── Main Layout Column ────────────────────────────────────────── */}
        <div className={cn(
          'flex-1 flex flex-col min-w-0 max-w-full transition-all duration-200 overflow-x-hidden',
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        )}>
          {/* ── Sticky Top Header Bar ──────────────────────────────────── */}
          <header className="sticky top-0 z-30 h-14 border-b border-surface-border flex items-center px-4 sm:px-6 gap-3 shrink-0 bg-canvas/90 backdrop-blur-md transition-colors">
            {/* Mobile menu hamburger button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open mobile menu"
              className="lg:hidden text-ink-secondary hover:text-ink-primary transition-colors p-1.5 rounded-lg hover:bg-surface border border-transparent hover:border-surface-border"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Clickable Brand Logo on Mobile / Small screens */}
            <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
              <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center border border-accent/30 shadow-glow-accent">
                <Zap className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="font-bold text-sm text-ink-primary">
                PowerBlind<span className="text-accent">+</span>
              </span>
            </Link>

            {/* Global Search Bar (Desktop / Tablet) */}
            <div className="hidden sm:flex items-center flex-1 max-w-md">
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                aria-label="Search telemetry and consumers"
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-surface-border bg-surface/50 text-ink-secondary text-xs hover:border-accent/40 hover:text-ink-primary hover:bg-surface transition-all"
              >
                <span className="flex items-center gap-2 text-ink-muted">
                  <Search className="w-3.5 h-3.5" />
                  <span>Search consumers, readings, or predictions…</span>
                </span>
                <kbd className="font-mono text-[10px] bg-canvas border border-surface-border px-1.5 py-0.5 rounded text-ink-primary">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Header Right Items */}
            <div className="ml-auto flex items-center gap-2.5">
              {/* Quick Search Icon on mobile */}
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                aria-label="Search"
                className="sm:hidden text-ink-muted hover:text-ink-primary p-1.5 rounded-md hover:bg-surface"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Theme toggle button */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle dark/light theme"
                className="text-ink-muted hover:text-ink-primary transition-colors p-1.5 rounded-md hover:bg-surface border border-transparent hover:border-surface-border"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
              </button>

              {/* Grid Live Status indicator */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-risk-normal-muted border border-risk-normal/30">
                <span className="w-2 h-2 rounded-full bg-risk-normal animate-pulse shadow-glow-normal" />
                <span className="text-[10px] font-mono text-risk-normal font-semibold hidden md:inline">27017 ONLINE</span>
              </div>
            </div>
          </header>

          {/* ── Main View Content ──────────────────────────────────────── */}
          <main id="main-content" className="flex-1 overflow-x-hidden max-w-full" tabIndex={-1}>
            <Outlet />
          </main>

          {/* ── Comprehensive Enterprise Footer ────────────────────────── */}
          <footer className="border-t border-surface-border bg-canvas-50/70 py-6 px-4 sm:px-8 mt-auto no-print">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Brand and Copyright */}
              <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
                <Link to="/dashboard" className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-accent/20 flex items-center justify-center border border-accent/30">
                    <Zap className="w-3 h-3 text-accent" />
                  </div>
                  <span className="font-bold text-xs text-ink-primary">PowerBlind<span className="text-accent">+</span></span>
                </Link>
                <span className="text-xs text-ink-muted font-mono">
                  © {new Date().getFullYear()} PowerBlind+ Grid Analytics. All rights reserved.
                </span>
              </div>

              {/* Footer Quick Links & Clickable Contacts */}
              <div className="flex items-center gap-4 text-xs text-ink-secondary flex-wrap justify-center font-medium">
                <Link to="/dashboard" className="hover:text-accent transition-colors">Dashboard</Link>
                <Link to="/consumers" className="hover:text-accent transition-colors">Consumers</Link>
                <Link to="/inspections" className="hover:text-accent transition-colors">Inspections</Link>
                <Link to="/settings" className="hover:text-accent transition-colors">Settings</Link>
                <span className="text-surface-border">|</span>
                {/* Clickable Phone Number */}
                <a
                  href="tel:+18005550199"
                  className="flex items-center gap-1 hover:text-accent transition-colors text-ink-muted"
                  title="Call Dispatch Hotline"
                >
                  <Phone className="w-3 h-3" />
                  <span>+1 (800) 555-0199</span>
                </a>
                {/* Clickable Email */}
                <a
                  href="mailto:support@powerblind.local"
                  className="flex items-center gap-1 hover:text-accent transition-colors text-ink-muted"
                  title="Email Grid Operations"
                >
                  <Mail className="w-3 h-3" />
                  <span>support@powerblind.local</span>
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* ── Floating Utilities & Modals ─────────────────────────────────── */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <CookieBanner />
      <BackToTop />
      <FloatingContact />

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        open={logoutModalOpen}
        title="Sign Out of PowerBlind+"
        message="Are you sure you want to end your current grid monitoring session? You will need to sign in again to access the operations console."
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        isDestructive={true}
        loading={loggingOut}
        onConfirm={handleLogoutConfirm}
        onClose={() => setLogoutModalOpen(false)}
      />
    </div>
  );
}

function NavSection({ collapsed, items, onNavigate }) {
  return (
    <div className="px-2 space-y-1">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group relative',
            isActive
              ? 'bg-accent/15 text-accent font-semibold shadow-[inset_3px_0_0_0_var(--color-accent)] border-r-0'
              : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary',
            collapsed && 'justify-center px-2',
          )}
        >
          <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" aria-hidden="true" />
          {!collapsed && <span>{label}</span>}
          {collapsed && (
            <span
              className="absolute left-full ml-2 px-2.5 py-1 bg-surface border border-surface-border rounded-md text-xs font-medium text-ink-primary whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-glass"
              role="tooltip"
            >
              {label}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );
}
