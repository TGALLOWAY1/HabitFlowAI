import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDayView, getLocalTimeZone } from '../../lib/persistenceClient';
import type { Habit } from '../../types';
import type { DayViewHabitStatus } from './habitStatusResolution';

export interface DayViewData {
    dayKey: string;
    habits: DayViewHabitStatus[];
}

type DayViewRequestState = {
    dayKey: string | null;
    data: DayViewData | null;
    loading: boolean;
    error: string | null;
};

const INITIAL_STATE: DayViewRequestState = {
    dayKey: null,
    data: null,
    loading: true,
    error: null,
};

/**
 * Loads canonical day-view data without replacing already rendered content
 * with a blocking loading state during mutation refreshes.
 */
export function useDayViewData(dayKey: string, habits: readonly Habit[]) {
    const [state, setState] = useState<DayViewRequestState>(INITIAL_STATE);
    const stateRef = useRef(state);
    const requestIdRef = useRef(0);

    const updateState = useCallback((next: DayViewRequestState) => {
        stateRef.current = next;
        setState(next);
    }, []);

    const refresh = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        const currentState = stateRef.current;
        const hasCurrentData = currentState.dayKey === dayKey && currentState.data !== null;

        try {
            const data = await fetchDayView(dayKey, getLocalTimeZone()) as DayViewData;
            if (requestId !== requestIdRef.current) return;
            updateState({ dayKey, data, loading: false, error: null });
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error('Failed to load day view:', err);

            // A background refresh failure must not hide valid, locally updated
            // content. Initial/date-change failures still surface normally.
            if (!hasCurrentData) {
                updateState({
                    dayKey,
                    data: null,
                    loading: false,
                    error: err instanceof Error ? err.message : 'Failed to load day view',
                });
            }
        }
    }, [dayKey, updateState]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void refresh();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [refresh, habits]);

    useEffect(() => () => {
        requestIdRef.current += 1;
    }, []);

    if (state.dayKey !== dayKey) {
        return { dayViewData: null, dayViewLoading: true, dayViewError: null, refreshDayView: refresh };
    }

    return {
        dayViewData: state.data,
        dayViewLoading: state.loading,
        dayViewError: state.error,
        refreshDayView: refresh,
    };
}
