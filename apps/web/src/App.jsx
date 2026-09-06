import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth }   from './contexts/AuthContext';
import { ToastProvider }           from './contexts/ToastContext';
import { ThemeProvider }           from './contexts/ThemeContext';
import { ErrorBoundary }           from './components/ui/ErrorBoundary';
import AppLayout          from './components/layout/AppLayout';
import LoginPage          from './pages/LoginPage';
import DashboardPage      from './pages/DashboardPage';
import ConsumersPage      from './pages/ConsumersPage';
import ConsumerDetailPage from './pages/ConsumerDetailPage';
import InspectionsPage    from './pages/InspectionsPage';
import AuditLogPage       from './pages/AuditLogPage';
import UserManagementPage from './pages/UserManagementPage';
import ModelHealthPage    from './pages/ModelHealthPage';
import SettingsPage       from './pages/SettingsPage';
import NotFoundPage       from './pages/NotFoundPage';

function NavigateBridge() {
  const navigate = useNavigate();
  const { navigateRef } = useAuth();
  useEffect(() => { navigateRef.current = navigate; }, [navigate, navigateRef]);
  return null;
}

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-surface-border border-t-accent animate-spin" />
        <span className="text-ink-secondary text-sm">Loading PowerBlind+…</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <NavigateBridge />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<RequireAuth />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard"      element={<DashboardPage />} />
                    <Route path="consumers"      element={<ConsumersPage />} />
                    <Route path="consumers/:id"  element={<ConsumerDetailPage />} />
                    <Route path="inspections"    element={<InspectionsPage />} />
                    <Route path="settings"       element={<SettingsPage />} />
                    <Route element={<RequireAdmin />}>
                      <Route path="audit-log"    element={<AuditLogPage />} />
                      <Route path="users"        element={<UserManagementPage />} />
                      <Route path="model-health" element={<ModelHealthPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
