/**
 * ThemeContext — theme mode state + side effects.
 *
 * Responsibilities:
 *   - Holds the user's choice: `'light' | 'dark' | 'system'`
 *   - Resolves that to the concrete applied mode (`'light' | 'dark'`)
 *     by listening to `prefers-color-scheme` when mode === 'system'
 *   - Applies `class="dark"` / `class="light"` to the <html> element
 *   - Updates CSS `color-scheme` so scrollbars / native form controls follow
 *   - Persists the chosen mode to localStorage (for pre-hydration sync)
 *     and to the backend via DashboardPrefs (for cross-device sync)
 *
 * The pre-hydration script in index.html reads the same localStorage key
 * before React boots, so first paint is never mismatched.
 *
 * Persistence to DashboardPrefs happens in src/store/DashboardPrefsContext
 * (it calls setMode on mount once prefs arrive from the server).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ResolvedThemeMode, ThemeMode } from './palette';
import { ensureThemeVarsInjected } from './cssVars';

export const THEME_STORAGE_KEY = 'hf_theme_mode';

interface ThemeContextValue {
  /** User's choice: light / dark / system */
  mode: ThemeMode;
  /** The concrete mode currently applied to the document */
  resolvedMode: ResolvedThemeMode;
  /**
   * Update the user's mode preference. Persists to localStorage
   * immediately. Does NOT persist to the backend — that's the caller's
   * responsibility (see DashboardPrefsContext integration).
   */
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'dark';
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'dark'; // default per product decision — preserve current appearance
}

function readSystemPreference(): ResolvedThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveMode(mode: ThemeMode): ResolvedThemeMode {
  return mode === 'system' ? readSystemPreference() : mode;
}

function applyMode(resolved: ResolvedThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
  root.style.colorScheme = resolved;
}

// Inject CSS vars once at module import so the first render already sees them.
// `index.css` contains hand-written fallback values, so this is purely "keep in sync
// with palette.ts" — not a first-paint dependency.
if (typeof document !== 'undefined') {
  ensureThemeVarsInjected();
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [resolvedMode, setResolvedMode] = useState<ResolvedThemeMode>(() => resolveMode(readStoredMode()));

  // Apply the current resolved mode to <html> whenever it changes.
  useEffect(() => {
    applyMode(resolvedMode);
  }, [resolvedMode]);

  // When mode === 'system', listen to OS preference changes.
  useEffect(() => {
    if (mode !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => {
      setResolvedMode(event.matches ? 'dark' : 'light');
    };

    // Sync immediately in case the preference changed while mode was 'explicit'
    setResolvedMode(mql.matches ? 'dark' : 'light');

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // Legacy Safari fallback
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setResolvedMode(resolveMode(next));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // quota errors / private-mode — ignore; in-memory state still works
      }
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Graceful fallback for components rendered outside the provider
    // (e.g. ErrorBoundary). Returns dark-mode defaults; no subscription.
    return {
      mode: 'dark',
      resolvedMode: 'dark',
      setMode: () => {},
    };
  }
  return ctx;
}
