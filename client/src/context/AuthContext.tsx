import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginInput, RegisterInput, UserDto } from '@audio-commerce/shared';
import { apiFetch, setAccessToken, refreshAccessToken } from '../lib/apiClient.js';

type Status = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: UserDto | null;
  status: Status;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    // Goes through the single-flight gate (Task 12) so this effect running
    // twice under StrictMode still issues exactly one network request.
    refreshAccessToken()
      .then(async () => {
        if (cancelled) return;
        const { user } = await apiFetch<{ user: UserDto }>('/api/auth/me');
        if (!cancelled) {
          setUser(user);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const { user, accessToken } = await apiFetch<{ user: UserDto; accessToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setAccessToken(accessToken);
    setUser(user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user, accessToken } = await apiFetch<{ user: UserDto; accessToken: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setAccessToken(accessToken);
    setUser(user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return <AuthContext.Provider value={{ user, status, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
