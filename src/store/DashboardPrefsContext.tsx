import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchDashboardPrefs, updateDashboardPrefs } from '../lib/persistenceClient';
import type { DashboardPrefs } from '../models/persistenceTypes';

interface DashboardPrefsContextValue {
  hideStreaks: boolean;
  setHideStreaks: (v: boolean) => void;
}

const DashboardPrefsContext = createContext<DashboardPrefsContextValue>({
  hideStreaks: false,
  setHideStreaks: () => {},
});

export const DashboardPrefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hideStreaks, setHideStreaksLocal] = useState(false);

  useEffect(() => {
    fetchDashboardPrefs()
      .then((prefs: DashboardPrefs) => {
        if (prefs.hideStreaks) setHideStreaksLocal(true);
      })
      .catch(() => {});
  }, []);

  const setHideStreaks = useCallback((v: boolean) => {
    setHideStreaksLocal(v);
    updateDashboardPrefs({ hideStreaks: v }).catch(() => {
      setHideStreaksLocal(!v);
    });
  }, []);

  return (
    <DashboardPrefsContext.Provider value={{ hideStreaks, setHideStreaks }}>
      {children}
    </DashboardPrefsContext.Provider>
  );
};

export function useDashboardPrefs(): DashboardPrefsContextValue {
  return useContext(DashboardPrefsContext);
}
