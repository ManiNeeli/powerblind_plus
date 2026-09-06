/**
 * PowerBlind+ API client — Phase 2 upgrade
 *
 * Features:
 * - Auto-refresh: on 401, tries /api/auth/refresh once, then retries original request
 * - Token injector: pulls fresh token from a registered getter (set by AuthContext)
 * - Consistent ApiError shape across all callers
 * - Cancellation via AbortSignal
 */

const BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(message, code, status, fields) {
    super(message);
    this.name   = 'ApiError';
    this.code   = code;
    this.status = status;
    this.fields = fields ?? null;
  }
}

// Token provider — registered by AuthContext so the API client
// can always get the latest access token without prop-drilling.
let _getToken  = () => null;
let _onRefresh = null;   // async () => string | null — called on 401
let _onLogout  = null;   // () => void — called when refresh also fails

export function registerTokenProvider({ getToken, onRefresh, onLogout }) {
  _getToken  = getToken;
  _onRefresh = onRefresh;
  _onLogout  = onLogout;
}

let _refreshing = null; // deduplicate concurrent refresh attempts

async function silentRefresh() {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      if (_onRefresh) return await _onRefresh();
      return null;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

async function rawRequest(method, path, body, { token, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token ?? _getToken();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  let data;
  try {
    data = res.headers.get('content-type')?.includes('application/json')
      ? await res.json()
      : await res.text();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(
      err.message ?? `Request failed (${res.status})`,
      err.code    ?? 'REQUEST_FAILED',
      res.status,
      err.fields  ?? null,
    );
  }
  return data;
}

async function request(method, path, body, opts = {}) {
  try {
    return await rawRequest(method, path, body, opts);
  } catch (err) {
    // On 401: try silent refresh, then retry once (never on auth endpoints)
    if (err.status === 401 && !opts._retried && _onRefresh && !path.startsWith('/api/auth')) {
      const newToken = await silentRefresh();
      if (newToken) {
        return rawRequest(method, path, body, { ...opts, token: newToken, _retried: true });
      }
      // Refresh failed — force logout
      _onLogout?.();
    }
    throw err;
  }
}

export const api = {
  get:    (path, opts)        => request('GET',    path, undefined, opts),
  post:   (path, body, opts)  => request('POST',   path, body,      opts),
  patch:  (path, body, opts)  => request('PATCH',  path, body,      opts),
  delete: (path, opts)        => request('DELETE', path, undefined, opts),
};
