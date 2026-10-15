import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import type { DayLog, Habit } from '../../types';
import type { DailyCheckIn } from '../../models/persistenceTypes';
import { __resetDailyCheckInCacheForTests } from '../../lib/useDailyCheckIn';
import { DailyCheckInCard } from './DailyCheckInCard';

const TODAY = format(new Date(), 'yyyy-MM-dd');

const mocks = vi.hoisted(() => ({
    store: {} as Record<string, unknown>,
    fetchDailyCheckIn: vi.fn(),
}));

vi.mock('../../store/HabitContext', () => ({ useHabitStore: () => mocks.store }));
vi.mock('../../store/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'user-1', householdId: 'house-1' } }) }));
vi.mock('../../lib/persistenceClient', () => ({
    fetchDailyCheckIn: mocks.fetchDailyCheckIn,
    saveDailyCheckIn: vi.fn(),
    getActiveUserMode: () => 'real',
}));

function habit(id: string): Habit {
    return { id, name: id, categoryId: 'cat-1', goal: { type: 'boolean', frequency: 'daily' }, archived: false, createdAt: '2026-01-01T00:00:00.000Z' };
}

const FOUR_HABITS = ['sunlight', 'protein', 'skincare', 'bed'].map(habit);

function setStore(habits: Habit[], logs: Record<string, DayLog> = {}) {
    mocks.store = { habits, categories: [{ id: 'cat-1', name: 'Health', color: 'bg-emerald-500' }], logs, loading: false };
}

function checkIn(overrides: Partial<DailyCheckIn>): DailyCheckIn {
    return {
        id: 'ci-1', userId: 'user-1', dayKey: TODAY, status: 'in_progress', currentStep: 3, habits: [],
        startedAt: '2026-10-15T20:00:00.000Z', completedAt: null,
        createdAt: '2026-10-15T20:00:00.000Z', updatedAt: '2026-10-15T20:00:00.000Z',
        ...overrides,
    };
}

describe('DailyCheckInCard', () => {
    beforeEach(() => {
        __resetDailyCheckInCacheForTests();
        mocks.fetchDailyCheckIn.mockReset();
    });

    it("invites the user to start with today's real habit count", async () => {
        setStore(FOUR_HABITS);
        mocks.fetchDailyCheckIn.mockResolvedValue(null);
        const onOpen = vi.fn();
        render(<DailyCheckInCard onOpen={onOpen} />);

        expect(await screen.findByText('4 habits waiting · ~2 min')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Start check-in' }));
        expect(onOpen).toHaveBeenCalledWith(1);
    });

    it('offers to continue an in-progress check-in at the saved page', async () => {
        setStore(FOUR_HABITS);
        mocks.fetchDailyCheckIn.mockResolvedValue(checkIn({ currentStep: 3 }));
        const onOpen = vi.fn();
        render(<DailyCheckInCard onOpen={onOpen} />);

        expect(await screen.findByText(/2 of 5 steps complete/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Continue check-in' }));
        expect(onOpen).toHaveBeenCalledWith(3);
    });

    it('shows the completed state with logged habits and a summary link', async () => {
        const logs = { [`sunlight-${TODAY}`]: { habitId: 'sunlight', date: TODAY, value: 1, completed: true } };
        setStore(FOUR_HABITS, logs);
        mocks.fetchDailyCheckIn.mockResolvedValue(checkIn({
            status: 'complete',
            currentStep: 5,
            completedAt: '2026-10-15T21:00:00.000Z',
            habits: [
                { habitId: 'protein', completionStatus: 'partial', moodScore: null, moodTags: [], effortScore: null, journalEntry: null },
                { habitId: 'skincare', completionStatus: 'skipped', moodScore: null, moodTags: [], effortScore: null, journalEntry: null },
            ],
        }));
        const onOpen = vi.fn();
        render(<DailyCheckInCard onOpen={onOpen} />);

        expect(await screen.findByRole('heading', { name: "Today's check-in complete" })).toBeInTheDocument();
        expect(screen.getByText('3 habits logged')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'View summary' }));
        expect(onOpen).toHaveBeenCalledWith(5);
    });

    it('moves on to the new day when the app is resumed after midnight', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            vi.setSystemTime(new Date(2026, 9, 12, 23, 58));
            setStore(FOUR_HABITS);
            mocks.fetchDailyCheckIn.mockImplementation(async (dayKey: string) => (
                dayKey === '2026-10-12'
                    ? checkIn({ dayKey, status: 'complete', currentStep: 5, completedAt: '2026-10-12T23:00:00.000Z' })
                    : null
            ));
            const onOpen = vi.fn();
            render(<DailyCheckInCard onOpen={onOpen} />);
            expect(await screen.findByRole('heading', { name: "Today's check-in complete" })).toBeInTheDocument();

            // The suspended app comes back the next morning.
            vi.setSystemTime(new Date(2026, 9, 13, 7, 30));
            act(() => { document.dispatchEvent(new Event('visibilitychange')); });

            expect(await screen.findByText('4 habits waiting · ~2 min')).toBeInTheDocument();
            expect(mocks.fetchDailyCheckIn).toHaveBeenLastCalledWith('2026-10-13');
            fireEvent.click(screen.getByRole('button', { name: 'Start check-in' }));
            expect(onOpen).toHaveBeenCalledWith(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('stays hidden when nothing is scheduled and no check-in exists', async () => {
        setStore([]);
        mocks.fetchDailyCheckIn.mockResolvedValue(null);
        const { container } = render(<DailyCheckInCard onOpen={vi.fn()} />);
        await waitFor(() => expect(mocks.fetchDailyCheckIn).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
