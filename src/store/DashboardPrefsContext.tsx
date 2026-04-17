import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchDashboardPrefs, updateDashboardPrefs } from '../lib/persistenceClient';
import type { DashboardPrefs } from '../models/persistenceTypes';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeMode } from '../theme/palette';

interface DashboardPrefsContextValue {
  hideStreaks: boolean;
  setHideStreaks: (v: boolean) => void;
  /**
   * Persist the user's theme preference to the backend AND update the
   * active ThemeContext state. Prefer this over calling ThemeContext.setMode
   * directly from UI components so the choice syncs across devices.
   */
  setThemeMode: (mode: ThemeMode) => void;
}

const DashboardPrefsContext = createContext<DashboardPrefsContextValue>({
  hideStreaks: false,
  setHideStreaks: () => {},
  setThemeMode: () => {},
});

export const DashboardPrefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hideStreaks, setHideStreaksLocal] = useState(false);
  const { setMode } = useTheme();
  const syncedThemeRef = useRef(false);

  useEffect(() => {
    fetchDashboardPrefs()
      .then((prefs: DashboardPrefs) => {
        setHideStreaksLocal(Boolean(prefs.hideStreaks));
        // On first successful load, if the backend has an explicit theme mode,
        // apply it. localStorage / pre-hydration already chose a plausible value;
        // this overrides only if the server has a saved choice.
        if (!syncedThemeRef.current && prefs.themeMode) {
          syncedThemeRef.current = true;
          setMode(prefs.themeMode);
        }
      })
      .catch(() => {});
  }, [setMode]);

  const setHideStreaks = useCallback((v: boolean) => {
    setHideStreaksLocal(v);
    updateDashboardPrefs({ hideStreaks: v }).catch(() => {
      setHideStreaksLocal(!v);
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    // Optimistic local update first so the UI responds immediately.
    setMode(mode);
    // Fire-and-forget backend write. Failure leaves the user with the
    // new theme locally (via localStorage) but un-synced across devices;
    // any subsequent successful write will reconcile.
    updateDashboardPrefs({ themeMode: mode }).catch(() => {});
  }, [setMode]);

  return (
    <DashboardPrefsContext.Provider value={{ hideStreaks, setHideStreaks, setThemeMode }}>
      {children}
    </DashboardPrefsContext.Provider>
  );
};

export function useDashboardPrefs(): DashboardPrefsContextValue {
  return useContext(DashboardPrefsContext);
}
