import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressOverview } from '../types';
import { fetchProgressOverview } from './persistenceClient';
import { invalidateAllGoalCaches } from './goalDataCache';
import { useProgressOverview } from './useProgressOverview';

vi.mock('./persistenceClient', () => ({
    fetchProgressOverview: vi.fn(),
}));

function overview(todayDate: string): ProgressOverview {
    return {
        todayDate,
        habitsToday: [],
        goalsWithProgress: [],
        momentum: {
            global: { state: 'Ready', activeDays: 0, trend: 'neutral', copy: '' },
            category: {},
        },
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(resolvePromise => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

describe('useProgressOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateAllGoalCaches();
    });

    it('keeps cached progress visible and non-blocking during a manual refresh', async () => {
        const initial = overview('2026-08-01');
        vi.mocked(fetchProgressOverview).mockResolvedValueOnce(initial);
        const { result } = renderHook(() => useProgressOverview());

        await waitFor(() => expect(result.current.data).toEqual(initial));
        expect(result.current.loading).toBe(false);

        const backgroundRequest = deferred<ProgressOverview>();
        vi.mocked(fetchProgressOverview).mockReturnValueOnce(backgroundRequest.promise);
        act(() => result.current.refresh());

        expect(result.current.loading).toBe(false);
        expect(result.current.data).toEqual(initial);

        const refreshed = overview('2026-08-02');
        await act(async () => {
            backgroundRequest.resolve(refreshed);
            await backgroundRequest.promise;
        });
        await waitFor(() => expect(result.current.data).toEqual(refreshed));
    });
});
