import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, registerTokenProvider } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user,        setUser]        = useState(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const tokenRef    = useRef(null);
  const timerRef    = useRef(null);
  const navigateRef = useRef(null); // set lazily to avoid hook-order issues

  // Keep ref in sync so the token provider closure always has the latest value
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

  const scheduleRefresh = useCallback((expiresIn) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const ms = Math.max((expiresIn - 60) * 1000, 10_000);
    timerRef.current = setTimeout(doRefresh, ms);
  }, []); // eslint-disable-line

  const applySession = useCallback((token, userData, expiresIn) => {
    setAccessToken(token);
    setUser(userData);
    tokenRef.current = token;
    scheduleRefresh(expiresIn);
  }, [scheduleRefresh]);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    tokenRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const doRefresh = useCallback(async () => {
    try {
      const data = await api.post('/api/auth/refresh', {}, { _retried: true });
      applySession(data.accessToken, data.user, data.expiresIn);
      return data.accessToken;
    } catch {
      clearSession();
      return null;
    }
  }, [applySession, clearSession]);

  // Register token provider so api.js can auto-refresh on 401
  useEffect(() => {
    registerTokenProvider({
      getToken:  () => tokenRef.current,
      onRefresh: doRefresh,
      onLogout:  () => {
        clearSession();
        navigateRef.current?.('/login', { state: { sessionExpired: true } });
      },
    });
  }, [doRefresh, clearSession]);

  // Mount: attempt silent refresh to restore session across page reloads
  useEffect(() => {
    doRefresh().finally(() => setIsLoading(false));
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line

  const login = useCallback(async (email, password, rememberMe = false) => {
    const data = await api.post('/api/auth/login', { email, password, rememberMe });
    applySession(data.accessToken, data.user, data.expiresIn);
    return data;
  }, [applySession]);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout', {}); } catch { /* best-effort */ }
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{
      accessToken, user, isLoading,
      isAuthenticated: !!accessToken && !!user,
      isAdmin:         user?.role === 'ADMIN',
      login, logout, navigateRef,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
