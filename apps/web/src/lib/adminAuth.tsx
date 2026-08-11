import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
export const AUTH_REQUIRED_EVENT = 'mse:auth-required';

export type AdministratorSession = {
  authenticated: true;
  administrator: { username: string };
  idle_expires_at: string;
  absolute_expires_at: string;
};

type AuthContextValue = {
  status: 'loading' | 'authenticated' | 'anonymous';
  session: AdministratorSession | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function cookieValue(name: string): string {
  const item = document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  if (!item) return '';
  try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return ''; }
}

export function adminAuthorization(): Record<string, string> {
  const csrf = cookieValue('__Host-mse_admin_csrf') || cookieValue('mse_admin_csrf');
  return csrf ? { 'X-CSRF-Token': csrf } : {};
}

export function notifyAuthenticationRequired(): void {
  window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
}

async function authRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, { ...init, credentials: 'include' });
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({})) as { message?: string };
  return new Error(body.message ?? fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [session, setSession] = useState<AdministratorSession | null>(null);
  const clear = useCallback(() => { setSession(null); setStatus('anonymous'); }, []);

  const restore = useCallback(async () => {
    try {
      const response = await authRequest('/api/v1/auth/session');
      if (!response.ok) return clear();
      setSession(await response.json());
      setStatus('authenticated');
    } catch { clear(); }
  }, [clear]);

  useEffect(() => { void restore(); }, [restore]);
  useEffect(() => {
    window.addEventListener(AUTH_REQUIRED_EVENT, clear);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, clear);
  }, [clear]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await authRequest('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
    });
    if (!response.ok) throw await responseError(response, 'Connexion impossible.');
    setSession(await response.json());
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const csrf = adminAuthorization()['X-CSRF-Token'];
    const response = await authRequest('/api/v1/auth/logout', { method: 'POST', headers: csrf ? { 'X-CSRF-Token': csrf } : {} });
    if (!response.ok) throw await responseError(response, 'Déconnexion impossible.');
    clear();
  }, [clear]);

  const value = useMemo(() => ({ status, session, login, logout }), [status, session, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAdminAuth must be used inside AuthProvider.');
  return value;
}
