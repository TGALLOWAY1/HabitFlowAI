import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Habit } from '../../types';
import { fetchDayView } from '../../lib/persistenceClient';
import { useDayViewData } from './useDayViewData';

vi.mock('../../lib/persistenceClient', () => ({
    fetchDayView: vi.fn(),
    getLocalTimeZone: () => 'America/New_York',
}));

const habits: Habit[] = [];
const initialData = { dayKey: '2026-08-02', habits: [] };

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

describe('useDayViewData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps existing day content visible during a mutation refresh', async () => {
        vi.mocked(fetchDayView).mockResolvedValueOnce(initialData);
        const { result } = renderHook(() => useDayViewData(initialData.dayKey, habits));

        await waitFor(() => expect(result.current.dayViewData).toEqual(initialData));
        expect(result.current.dayViewLoading).toBe(false);

        const backgroundRequest = deferred<typeof initialData>();
        vi.mocked(fetchDayView).mockReturnValueOnce(backgroundRequest.promise);

        let refreshPromise!: Promise<void>;
        act(() => {
            refreshPromise = result.current.refreshDayView();
        });

        expect(result.current.dayViewLoading).toBe(false);
        expect(result.current.dayViewData).toEqual(initialData);

        await act(async () => {
            backgroundRequest.resolve(initialData);
            await refreshPromise;
        });
    });

    it('uses a blocking state when navigating to a different day', async () => {
        vi.mocked(fetchDayView).mockResolvedValueOnce(initialData);
        const nextRequest = deferred<{ dayKey: string; habits: [] }>();
        const { result, rerender } = renderHook(
            ({ dayKey }) => useDayViewData(dayKey, habits),
            { initialProps: { dayKey: initialData.dayKey } },
        );
        await waitFor(() => expect(result.current.dayViewData).toEqual(initialData));

        vi.mocked(fetchDayView).mockReturnValueOnce(nextRequest.promise);
        rerender({ dayKey: '2026-08-01' });

        expect(result.current.dayViewLoading).toBe(true);
        expect(result.current.dayViewData).toBeNull();

        await act(async () => {
            nextRequest.resolve({ dayKey: '2026-08-01', habits: [] });
            await nextRequest.promise;
        });
        await waitFor(() => expect(result.current.dayViewLoading).toBe(false));
    });

    it('retains existing content when a background refresh fails', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(fetchDayView).mockResolvedValueOnce(initialData);
        const { result } = renderHook(() => useDayViewData(initialData.dayKey, habits));
        await waitFor(() => expect(result.current.dayViewData).toEqual(initialData));

        vi.mocked(fetchDayView).mockRejectedValueOnce(new Error('offline'));
        await act(async () => {
            await result.current.refreshDayView();
        });

        expect(result.current.dayViewData).toEqual(initialData);
        expect(result.current.dayViewLoading).toBe(false);
        expect(result.current.dayViewError).toBeNull();
        expect(consoleError).toHaveBeenCalledWith('Failed to load day view:', expect.any(Error));
        consoleError.mockRestore();
    });
});
