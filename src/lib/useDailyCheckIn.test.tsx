import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyCheckIn } from '../models/persistenceTypes';
import { __resetDailyCheckInCacheForTests, useDailyCheckIn } from './useDailyCheckIn';

const DAY = '2026-10-12';
const STORAGE_KEY = `hf_daily_checkin_v1:user-1:${DAY}`;

const mocks = vi.hoisted(() => ({
    fetchDailyCheckIn: vi.fn(),
    saveDailyCheckIn: vi.fn(),
    mode: 'real' as 'real' | 'demo',
}));

vi.mock('../store/AuthContext', () => ({
    useAuth: () => ({ user: { userId: 'user-1', householdId: 'house-1' } }),
}));

vi.mock('./persistenceClient', () => ({
    fetchDailyCheckIn: mocks.fetchDailyCheckIn,
    saveDailyCheckIn: mocks.saveDailyCheckIn,
    getActiveUserMode: () => mocks.mode,
}));

function serverCheckIn(overrides: Partial<DailyCheckIn> = {}): DailyCheckIn {
    return {
        id: 'ci-1',
        userId: 'user-1',
        dayKey: DAY,
        status: 'in_progress',
        currentStep: 2,
        habits: [],
        startedAt: '2026-10-12T20:00:00.000Z',
        completedAt: null,
        createdAt: '2026-10-12T20:00:00.000Z',
        updatedAt: '2026-10-12T20:00:00.000Z',
        ...overrides,
    };
}

function echoSave() {
    mocks.saveDailyCheckIn.mockImplementation(async (_dayKey: string, payload: { status: DailyCheckIn['status']; currentStep: number }) =>
        serverCheckIn({
            status: payload.status,
            currentStep: payload.currentStep,
            completedAt: payload.status === 'complete' ? '2026-10-12T21:00:00.000Z' : null,
        }),
    );
}

function readMirror() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
}

describe('useDailyCheckIn', () => {
    beforeEach(() => {
        __resetDailyCheckInCacheForTests();
        mocks.fetchDailyCheckIn.mockReset();
        mocks.saveDailyCheckIn.mockReset();
        mocks.mode = 'real';
        echoSave();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('is not started when the server has none, and viewing the intro creates nothing', async () => {
        mocks.fetchDailyCheckIn.mockResolvedValue(null);
        const { result } = renderHook(() => useDailyCheckIn(DAY));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.phase).toBe('not_started');
        act(() => result.current.setStep(1));
        await act(async () => { await result.current.flush(); });
        expect(mocks.saveDailyCheckIn).not.toHaveBeenCalled();
        expect(result.current.draft).toBeNull();
    });

    it('mirrors edits on-device immediately and syncs them after a debounce', async () => {
        mocks.fetchDailyCheckIn.mockResolvedValue(null);
        const { result } = renderHook(() => useDailyCheckIn(DAY));
        await waitFor(() => expect(result.current.loading).toBe(false));

        vi.useFakeTimers();
        act(() => {
            result.current.setStep(2);
            result.current.updateHabit('h1', { completionStatus: 'skipped' });
            result.current.updateHabit('h1', { journalEntry: 'Too tired tonight' });
        });

        expect(result.current.phase).toBe('in_progress');
        expect(readMirror()).toMatchObject({ dirty: true, draft: { currentStep: 2 } });
        expect(mocks.saveDailyCheckIn).not.toHaveBeenCalled();

        await act(async () => { await vi.advanceTimersByTimeAsync(700); });

        expect(mocks.saveDailyCheckIn).toHaveBeenCalledTimes(1);
        expect(mocks.saveDailyCheckIn).toHaveBeenCalledWith(DAY, {
            status: 'in_progress',
            currentStep: 2,
            habits: [{
                habitId: 'h1', completionStatus: 'skipped', moodScore: null, moodTags: [], effortScore: null, journalEntry: 'Too tired tonight',
            }],
        });
        expect(readMirror()).toMatchObject({ dirty: false });
    });

    it('resumes an unsynced on-device draft after a refresh and re-syncs it', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            dirty: true,
            draft: {
                status: 'in_progress',
                currentStep: 5,
                habits: { h1: { habitId: 'h1', completionStatus: null, moodScore: 4, moodTags: ['calm'], effortScore: 2, journalEntry: 'Typed right before refresh' } },
                startedAt: '2026-10-12T20:00:00.000Z',
                completedAt: null,
            },
        }));
        mocks.fetchDailyCheckIn.mockResolvedValue(serverCheckIn({ currentStep: 3 }));

        const { result } = renderHook(() => useDailyCheckIn(DAY));

        // Rendered from the device copy immediately — no loading flash.
        expect(result.current.loading).toBe(false);
        expect(result.current.draft?.habits.h1.journalEntry).toBe('Typed right before refresh');

        await waitFor(() => expect(mocks.saveDailyCheckIn).toHaveBeenCalledTimes(1));
        expect(mocks.saveDailyCheckIn.mock.calls[0][1]).toMatchObject({ currentStep: 5 });
        expect(result.current.draft?.currentStep).toBe(5);
    });

    it('prefers the server copy when the device copy is already synced', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            dirty: false,
            draft: { status: 'in_progress', currentStep: 2, habits: {}, startedAt: null, completedAt: null },
        }));
        mocks.fetchDailyCheckIn.mockResolvedValue(serverCheckIn({
            currentStep: 4,
            habits: [{ habitId: 'h2', completionStatus: null, moodScore: 5, moodTags: [], effortScore: null, journalEntry: null }],
        }));

        const { result } = renderHook(() => useDailyCheckIn(DAY));
        await waitFor(() => expect(result.current.draft?.currentStep).toBe(4));
        expect(result.current.draft?.habits.h2.moodScore).toBe(5);
        expect(mocks.saveDailyCheckIn).not.toHaveBeenCalled();
    });

    it('complete() saves immediately and reports the complete phase', async () => {
        mocks.fetchDailyCheckIn.mockResolvedValue(serverCheckIn());
        const { result } = renderHook(() => useDailyCheckIn(DAY));
        await waitFor(() => expect(result.current.loading).toBe(false));

        let saved = false;
        await act(async () => { saved = await result.current.complete(); });

        expect(saved).toBe(true);
        expect(mocks.saveDailyCheckIn).toHaveBeenCalledWith(DAY, expect.objectContaining({ status: 'complete', currentStep: 5 }));
        expect(result.current.phase).toBe('complete');
        expect(result.current.draft?.completedAt).toBe('2026-10-12T21:00:00.000Z');
    });

    it('never lets the response to an older in-flight save downgrade a completion', async () => {
        mocks.fetchDailyCheckIn.mockResolvedValue(serverCheckIn());
        const { result } = renderHook(() => useDailyCheckIn(DAY));
        await waitFor(() => expect(result.current.loading).toBe(false));

        // An autosave is still in flight when the user taps Complete.
        let releaseAutosave!: () => void;
        mocks.saveDailyCheckIn.mockImplementationOnce((_dayKey: string, payload: { status: DailyCheckIn['status']; currentStep: number }) =>
            new Promise<DailyCheckIn>(resolve => {
                releaseAutosave = () => resolve(serverCheckIn({ status: payload.status, currentStep: payload.currentStep }));
            }),
        );
        act(() => result.current.updateHabit('h1', { journalEntry: 'Wrote this just before completing' }));
        let autosave!: Promise<boolean>;
        let completion!: Promise<boolean>;
        act(() => {
            autosave = result.current.flush();
            completion = result.current.complete();
        });

        let completed = false;
        await act(async () => {
            releaseAutosave();
            await autosave;
            completed = await completion;
        });

        expect(completed).toBe(true);
        const calls = mocks.saveDailyCheckIn.mock.calls;
        expect(calls).toHaveLength(2);
        expect(calls[1][1]).toMatchObject({ status: 'complete', currentStep: 5 });
        expect(result.current.phase).toBe('complete');
    });

    it('keeps edits on-device and surfaces an error when sync fails, then retries', async () => {
        mocks.fetchDailyCheckIn.mockResolvedValue(serverCheckIn());
        mocks.saveDailyCheckIn.mockRejectedValueOnce(new Error('offline'));
        const { result } = renderHook(() => useDailyCheckIn(DAY));
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.updateHabit('h1', { moodScore: 3 }));
        let ok = true;
        await act(async () => { ok = await result.current.flush(); });

        expect(ok).toBe(false);
        expect(result.current.saveError).toMatch(/saved on this device/);
        expect(readMirror()).toMatchObject({ dirty: true });

        await act(async () => { ok = await result.current.flush(); });
        expect(ok).toBe(true);
        expect(result.current.saveError).toBeNull();
        expect(mocks.saveDailyCheckIn).toHaveBeenCalledTimes(2);
    });

    it('keeps the read-only demo draft in memory without writing anywhere', async () => {
        mocks.mode = 'demo';
        mocks.fetchDailyCheckIn.mockResolvedValue(null);
        const { result } = renderHook(() => useDailyCheckIn(DAY));
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.updateHabit('h1', { moodScore: 5 }));
        await act(async () => { await result.current.flush(); });

        expect(result.current.draft?.habits.h1.moodScore).toBe(5);
        expect(mocks.saveDailyCheckIn).not.toHaveBeenCalled();
        expect(readMirror()).toBeNull();
    });
});
