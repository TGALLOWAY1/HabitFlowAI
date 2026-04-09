import { useState, useEffect, useCallback } from 'react';
import { fetchDashboardPrefs, updateDashboardPrefs } from '../../lib/persistenceClient';

const STORAGE_KEY = 'hf_pinned_journal_templates';

let _cachedPinnedIds: string[] | null = null;

function readLocalStorageIds(): string[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function usePinnedJournalTemplates() {
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        if (_cachedPinnedIds !== null) return _cachedPinnedIds;
        const fromStorage = readLocalStorageIds();
        _cachedPinnedIds = fromStorage;
        return fromStorage;
    });

    useEffect(() => {
        _cachedPinnedIds = pinnedIds;
    }, [pinnedIds]);

    // Hydrate from backend on mount
    useEffect(() => {
        let cancelled = false;
        fetchDashboardPrefs()
            .then(prefs => {
                if (cancelled) return;
                const backendIds = prefs.pinnedJournalTemplateIds ?? [];
                if (backendIds.length > 0 || _cachedPinnedIds === null || _cachedPinnedIds.length === 0) {
                    setPinnedIds(backendIds);
                    _cachedPinnedIds = backendIds;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(backendIds));
                }
            })
            .catch(() => {
                // Keep localStorage/cache fallback on network failure
            });
        return () => { cancelled = true; };
    }, []);

    const togglePin = useCallback((id: string) => {
        setPinnedIds(prev => {
            const next = prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id];
            _cachedPinnedIds = next;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            // Persist to backend (fire-and-forget; localStorage is fallback)
            updateDashboardPrefs({ pinnedJournalTemplateIds: next }).catch(() => {});
            return next;
        });
    }, []);

    const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

    return { pinnedIds, togglePin, isPinned };
}
