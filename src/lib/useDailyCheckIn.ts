import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { fetchDailyCheckIn, getActiveUserMode, saveDailyCheckIn } from './persistenceClient';
import type { DailyCheckIn, DailyCheckInStatus, HabitCheckIn } from '../models/persistenceTypes';

/**
 * Daily Check-in draft state for one day.
 *
 * Persistence follows the app's server-first model (MongoDB via
 * /api/dailyCheckIns) with an on-device mirror so a refresh, app switch, or
 * flaky network never loses input:
 *   - every change is written to the mirror immediately and synced to the
 *     server after a short debounce (flushed on step changes, completion,
 *     tab hide and unmount);
 *   - a mirror with unsynced ("dirty") changes wins over the server copy on
 *     the next load and is re-synced.
 * The read-only public demo keeps the draft in memory only.
 */

export type DailyCheckInPhase = 'not_started' | 'in_progress' | 'complete';

export interface DailyCheckInDraft {
    status: DailyCheckInStatus;
    currentStep: number;
    habits: Record<string, HabitCheckIn>;
    startedAt: string | null;
    completedAt: string | null;
}

interface StoredDraft {
    draft: DailyCheckInDraft | null;
    dirty: boolean;
}

const SYNC_DEBOUNCE_MS = 600;
const STORAGE_PREFIX = 'hf_daily_checkin_v1';

// Survives unmounts so the dashboard card and the flow share state instantly.
const memoryCache = new Map<string, StoredDraft>();

export function __resetDailyCheckInCacheForTests(): void {
    memoryCache.clear();
}

export function emptyHabitCheckIn(habitId: string): HabitCheckIn {
    return { habitId, completionStatus: null, moodScore: null, moodTags: [], effortScore: null, journalEntry: null };
}

function fromServer(checkIn: DailyCheckIn): DailyCheckInDraft {
    return {
        status: checkIn.status,
        currentStep: checkIn.currentStep,
        habits: Object.fromEntries(checkIn.habits.map(habit => [habit.habitId, habit])),
        startedAt: checkIn.startedAt,
        completedAt: checkIn.completedAt,
    };
}

function toPayload(draft: DailyCheckInDraft) {
    return { status: draft.status, currentStep: draft.currentStep, habits: Object.values(draft.habits) };
}

function readMirror(storageKey: string | null): StoredDraft | null {
    if (!storageKey) return null;
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredDraft;
        return parsed && typeof parsed === 'object' && 'draft' in parsed ? parsed : null;
    } catch {
        return null;
    }
}

function writeMirror(storageKey: string | null, stored: StoredDraft): void {
    if (!storageKey) return;
    try {
        if (stored.draft === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
        // Storage full or unavailable — the server copy remains the source of truth.
    }
}

export function useDailyCheckIn(dayKey: string) {
    const { user } = useAuth();
    const readOnly = getActiveUserMode() === 'demo';
    const userKey = user?.userId ?? 'anonymous';
    const cacheKey = `${userKey}:${dayKey}`;
    // Keyed by the session user so a shared device never mixes accounts' drafts.
    const storageKey = !readOnly && user?.userId ? `${STORAGE_PREFIX}:${user.userId}:${dayKey}` : null;

    // dayKey is fixed for a mounted consumer, so the cached draft is read once.
    const [initial] = useState<StoredDraft | null>(() => memoryCache.get(cacheKey) ?? readMirror(storageKey));

    const [draft, setDraft] = useState<DailyCheckInDraft | null>(initial?.draft ?? null);
    const [loading, setLoading] = useState(!initial);
    const [saveError, setSaveError] = useState<string | null>(null);

    const draftRef = useRef<DailyCheckInDraft | null>(initial?.draft ?? null);
    const dirtyRef = useRef(initial?.dirty ?? false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlightRef = useRef<Promise<unknown> | null>(null);

    const remember = useCallback((next: DailyCheckInDraft | null, dirty: boolean) => {
        memoryCache.set(cacheKey, { draft: next, dirty });
        writeMirror(storageKey, { draft: next, dirty });
    }, [cacheKey, storageKey]);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    /** Push unsynced changes now. Resolves true once the latest state is saved. */
    const flush = useCallback(async (): Promise<boolean> => {
        clearTimer();
        if (readOnly) {
            dirtyRef.current = false;
            return true;
        }
        // Serialize writes so the server always receives edits in order.
        while (inFlightRef.current) {
            await inFlightRef.current.catch(() => undefined);
        }
        const snapshot = draftRef.current;
        if (!dirtyRef.current || !snapshot) return true;

        dirtyRef.current = false;
        const request = saveDailyCheckIn(dayKey, toPayload(snapshot));
        inFlightRef.current = request;
        try {
            const saved = await request;
            setSaveError(null);
            // Adopt server-owned lifecycle fields without clobbering newer local edits.
            const current = draftRef.current ?? snapshot;
            const merged: DailyCheckInDraft = {
                ...current,
                status: saved.status,
                startedAt: saved.startedAt,
                completedAt: saved.completedAt,
            };
            draftRef.current = merged;
            setDraft(merged);
            remember(merged, dirtyRef.current);
            return !dirtyRef.current;
        } catch (error) {
            console.error('[useDailyCheckIn] Failed to save check-in:', error);
            dirtyRef.current = true;
            setSaveError("Couldn't sync your check-in. Your answers are saved on this device and will retry.");
            return false;
        } finally {
            if (inFlightRef.current === request) inFlightRef.current = null;
        }
    }, [dayKey, readOnly, remember]);

    const flushRef = useRef(flush);
    flushRef.current = flush;

    const mutate = useCallback((recipe: (current: DailyCheckInDraft) => DailyCheckInDraft) => {
        const base: DailyCheckInDraft = draftRef.current ?? {
            status: 'in_progress',
            currentStep: 1,
            habits: {},
            startedAt: new Date().toISOString(),
            completedAt: null,
        };
        const next = recipe(base);
        if (next === draftRef.current) return;
        draftRef.current = next;
        dirtyRef.current = true;
        setDraft(next);
        remember(next, true);
        clearTimer();
        timerRef.current = setTimeout(() => { void flushRef.current(); }, SYNC_DEBOUNCE_MS);
    }, [remember]);

    // Load the server copy; unsynced local changes win and get re-synced.
    useEffect(() => {
        let cancelled = false;
        if (readOnly && memoryCache.has(cacheKey)) {
            setLoading(false);
            return;
        }
        fetchDailyCheckIn(dayKey)
            .then(serverCheckIn => {
                if (cancelled) return;
                if (dirtyRef.current) {
                    void flushRef.current();
                } else {
                    const next = serverCheckIn ? fromServer(serverCheckIn) : null;
                    draftRef.current = next;
                    setDraft(next);
                    remember(next, false);
                }
            })
            .catch(error => {
                console.error('[useDailyCheckIn] Failed to load check-in:', error);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [cacheKey, dayKey, readOnly, remember]);

    // Never strand edits: flush when the tab is hidden and on unmount.
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') void flushRef.current();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            void flushRef.current();
        };
    }, []);

    const setStep = useCallback((step: number) => {
        // Merely viewing the intro must not start a check-in.
        if (!draftRef.current && step <= 1) return;
        mutate(current => (current.currentStep === step ? current : { ...current, currentStep: step }));
    }, [mutate]);

    const updateHabit = useCallback((habitId: string, patch: Partial<Omit<HabitCheckIn, 'habitId'>>) => {
        mutate(current => ({
            ...current,
            habits: {
                ...current.habits,
                [habitId]: { ...(current.habits[habitId] ?? emptyHabitCheckIn(habitId)), ...patch, habitId },
            },
        }));
    }, [mutate]);

    const complete = useCallback(async (): Promise<boolean> => {
        mutate(current => ({
            ...current,
            status: 'complete',
            currentStep: 5,
            completedAt: current.completedAt ?? new Date().toISOString(),
        }));
        return flush();
    }, [flush, mutate]);

    const phase: DailyCheckInPhase = !draft ? 'not_started' : draft.status === 'complete' ? 'complete' : 'in_progress';

    return { draft, phase, loading, saveError, readOnly, setStep, updateHabit, complete, flush };
}
