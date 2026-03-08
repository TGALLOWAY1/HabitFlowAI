/**
 * AuthContext — session-based authentication for production.
 *
 * On mount, checks GET /api/auth/me.
 * Provides login(), redeemInvite(), logout().
 * Listens for 401 events dispatched by persistenceClient.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../lib/persistenceConfig';

export interface AuthUser {
  householdId: string;
  userId: string;
  email?: string;
  displayName?: string;
  role?: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  redeemInvite: (inviteCode: string, email: string, password: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/**
 * Whether we're running in dev demo mode where session auth is optional.
 * In dev + demo mode, the backend accepts X-Household-Id / X-User-Id headers,
 * so we skip the session check and let the user through.
 */
function isDevDemoMode(): boolean {
  return import.meta.env.DEV && localStorage.getItem('habitflow_active_user_mode') === 'demo';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const checkSession = useCallback(async () => {
    // In dev demo mode, skip session check entirely
    if (isDevDemoMode()) {
      setState({
        user: { householdId: 'default-household', userId: 'demo_emotional_wellbeing' },
        loading: false,
        error: null,
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setState({ user: data, loading: false, error: null });
      } else {
        setState({ user: null, loading: false, error: null });
      }
    } catch {
      // Network error — assume not authenticated
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Listen for 401 events from persistenceClient
  useEffect(() => {
    const handler = () => {
      setState((prev) => ({ ...prev, user: null, error: 'Session expired. Please log in again.' }));
    };
    window.addEventListener('habitflow:session-expired', handler);
    return () => window.removeEventListener('habitflow:session-expired', handler);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setState({ user: data.user, loading: false, error: null });
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Login failed.' };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const redeemInvite = useCallback(async (
    inviteCode: string,
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/invite/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteCode, email, password, displayName }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setState({ user: data.user, loading: false, error: null });
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Invite redemption failed.' };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout — clear local state regardless
    }
    setState({ user: null, loading: false, error: null });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, redeemInvite, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};
