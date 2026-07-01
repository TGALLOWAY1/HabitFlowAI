/**
 * AuthContext — session-based authentication for production.
 *
 * On mount, checks GET /api/auth/me.
 * Provides login(), redeemInvite(), logout().
 * Listens for 401 events dispatched by persistenceClient.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../lib/persistenceConfig';
import { ACTIVE_USER_MODE_STORAGE_KEY, DEMO_USER_ID, PUBLIC_DEMO_HOUSEHOLD_ID } from '../shared/demo';
import { exitDemoMode } from '../lib/demoMode';

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
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/**
 * Whether we're in demo mode, where session auth is bypassed.
 * The demo works without an account: persistenceClient sends the X-Demo-Mode
 * header and the server (dev: DEMO_MODE_ENABLED, prod: PUBLIC_DEMO_ENABLED)
 * scopes every request to the fixed, read-only demo identity.
 */
function isDemoSession(): boolean {
  return localStorage.getItem(ACTIVE_USER_MODE_STORAGE_KEY) === 'demo';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const checkSession = useCallback(async () => {
    // In demo mode, skip session check entirely
    if (isDemoSession()) {
      setState({
        user: { householdId: PUBLIC_DEMO_HOUSEHOLD_ID, userId: DEMO_USER_ID, displayName: 'Demo Explorer' },
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

  // Listen for 401 events from persistenceClient. In demo mode a 401 means the
  // server's public demo is disabled — don't loop on "session expired".
  useEffect(() => {
    const handler = () => {
      if (isDemoSession()) return;
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
    // Leaving the demo is a mode switch, not a session logout.
    if (isDemoSession()) {
      exitDemoMode();
      return;
    }
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

  const requestPasswordReset = useCallback(async (email: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) return { ok: true };
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || 'Could not request password reset.' };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      if (res.ok) return { ok: true };
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || 'Password reset failed.' };
    } catch {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, redeemInvite, logout, clearError, requestPasswordReset, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};
