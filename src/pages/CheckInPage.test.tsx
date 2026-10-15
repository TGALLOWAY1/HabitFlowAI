import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import type { Category, DayLog, Habit } from '../types';
import type { DailyCheckIn } from '../models/persistenceTypes';
import { __resetDailyCheckInCacheForTests } from '../lib/useDailyCheckIn';
import { CheckInPage } from './CheckInPage';

const TODAY = format(new Date(), 'yyyy-MM-dd');

const mocks = vi.hoisted(() => ({
    store: {} as Record<string, unknown>,
    fetchDailyCheckIn: vi.fn(),
    saveDailyCheckIn: vi.fn(),
    showToast: vi.fn(),
}));

vi.mock('../store/HabitContext', () => ({ useHabitStore: () => mocks.store }));
vi.mock('../store/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'user-1', householdId: 'house-1' } }) }));
vi.mock('../store/DashboardPrefsContext', () => ({ useDashboardPrefs: () => ({ hideStreaks: false }) }));
vi.mock('../components/Toast', () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock('../lib/useProgressOverview', () => ({
    useProgressOverview: () => ({
        data: {
            todayDate: TODAY,
            habitsToday: [{ habit: { id: 'sunlight' }, currentStreak: 12, formattedStreak: '12 days' }],
            goalsWithProgress: [],
            momentum: { global: { state: 'Building', activeDays: 3, trend: 'up', copy: 'Momentum is building' }, category: {} },
        },
        loading: false,
        refresh: vi.fn(),
    }),
}));
vi.mock('../lib/persistenceClient', () => ({
    fetchDailyCheckIn: mocks.fetchDailyCheckIn,
    saveDailyCheckIn: mocks.saveDailyCheckIn,
    getActiveUserMode: () => 'real',
}));

const categories: Category[] = [{ id: 'cat-1', name: 'Health', color: 'bg-emerald-500' }];

function habit(overrides: Partial<Habit> & Pick<Habit, 'id' | 'name'>): Habit {
    return {
        categoryId: 'cat-1',
        goal: { type: 'boolean', frequency: 'daily' },
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

const sunlight = habit({ id: 'sunlight', name: 'Morning Sunlight', order: 1 });
const skincare = habit({ id: 'skincare', name: 'Skin care', order: 2 });
const protein = habit({ id: 'protein', name: 'Protein Target', order: 3, goal: { type: 'number', frequency: 'daily', target: 140, unit: 'g' } });

function completedLog(habitId: string, value = 1): Record<string, DayLog> {
    return { [`${habitId}-${TODAY}`]: { habitId, date: TODAY, value, completed: true } };
}

function setupStore(habits: Habit[], logs: Record<string, DayLog> = {}) {
    mocks.store = {
        habits,
        categories,
        logs,
        loading: false,
        upsertHabitEntry: vi.fn().mockResolvedValue(undefined),
        deleteHabitEntryByKey: vi.fn().mockResolvedValue(undefined),
        toggleHabit: vi.fn().mockResolvedValue(undefined),
    };
    return mocks.store as {
        upsertHabitEntry: ReturnType<typeof vi.fn>;
        deleteHabitEntryByKey: ReturnType<typeof vi.fn>;
        toggleHabit: ReturnType<typeof vi.fn>;
    };
}

function serverCheckIn(overrides: Partial<DailyCheckIn> = {}): DailyCheckIn {
    return {
        id: 'ci-1', userId: 'user-1', dayKey: TODAY, status: 'in_progress', currentStep: 2, habits: [],
        startedAt: '2026-10-15T20:00:00.000Z', completedAt: null,
        createdAt: '2026-10-15T20:00:00.000Z', updatedAt: '2026-10-15T20:00:00.000Z',
        ...overrides,
    };
}

async function renderAt(step: number) {
    window.history.replaceState({}, '', `/?view=check-in&step=${step}`);
    const onExit = vi.fn();
    render(<CheckInPage onExit={onExit} />);
    await waitFor(() => expect(screen.queryByText('Loading your check-in…')).not.toBeInTheDocument());
    return { onExit };
}

function card(name: string) {
    return screen.getByRole('heading', { name, level: 3 }).closest('li') as HTMLElement;
}

function lastSavedPayload() {
    const calls = mocks.saveDailyCheckIn.mock.calls;
    return calls[calls.length - 1]?.[1];
}

describe('CheckInPage', () => {
    beforeEach(() => {
        __resetDailyCheckInCacheForTests();
        mocks.fetchDailyCheckIn.mockReset().mockResolvedValue(null);
        mocks.saveDailyCheckIn.mockReset().mockImplementation(async (_day: string, payload: { status: DailyCheckIn['status']; currentStep: number }) =>
            serverCheckIn({ status: payload.status, currentStep: payload.currentStep }),
        );
        mocks.showToast.mockReset();
    });

    afterEach(() => {
        window.history.replaceState({}, '', '/');
    });

    it("lists today's habits on the intro and starts the flow on page 2", async () => {
        setupStore([sunlight, skincare]);
        await renderAt(1);

        expect(screen.getByRole('heading', { name: 'Daily Check-in' })).toBeInTheDocument();
        expect(screen.getByText('2 habits to check in today')).toBeInTheDocument();
        expect(screen.getByRole('progressbar', { name: 'Daily check-in progress' })).toHaveAttribute('aria-valuetext', 'Step 1 of 5');
        // Viewing the intro never creates a check-in.
        expect(mocks.saveDailyCheckIn).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /Start Daily Check-in/ }));

        expect(screen.getByRole('heading', { name: 'What did you complete?' })).toBeInTheDocument();
        expect(new URLSearchParams(window.location.search).get('step')).toBe('2');
        expect(screen.getByRole('progressbar', { name: 'Daily check-in progress' })).toHaveAttribute('aria-valuetext', 'Step 2 of 5');
        expect(within(card('Morning Sunlight')).getByText('12 day streak')).toBeInTheDocument();
        await waitFor(() => expect(lastSavedPayload()).toMatchObject({ status: 'in_progress', currentStep: 2 }));
    });

    it('writes Done through the habit store and records Skip without touching entries', async () => {
        const store = setupStore([sunlight, skincare]);
        await renderAt(2);

        fireEvent.click(within(card('Morning Sunlight')).getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(store.upsertHabitEntry).toHaveBeenCalledWith('sunlight', TODAY, { value: 1, source: 'manual' }));

        fireEvent.click(within(card('Skin care')).getByRole('button', { name: 'Skip' }));
        expect(within(card('Skin care')).getByRole('button', { name: 'Skip' })).toHaveAttribute('aria-pressed', 'true');
        expect(store.deleteHabitEntryByKey).not.toHaveBeenCalled();

        await waitFor(() => expect(lastSavedPayload()?.habits).toEqual(expect.arrayContaining([
            expect.objectContaining({ habitId: 'skincare', completionStatus: 'skipped' }),
        ])));
        // "done" is never stored on the check-in.
        expect(JSON.stringify(mocks.saveDailyCheckIn.mock.calls)).not.toContain('"done"');
    });

    it('un-completes a completed habit when it is switched to Partial', async () => {
        const store = setupStore([sunlight], completedLog('sunlight'));
        await renderAt(2);

        expect(within(card('Morning Sunlight')).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(within(card('Morning Sunlight')).getByRole('button', { name: 'Partial' }));

        await waitFor(() => expect(store.deleteHabitEntryByKey).toHaveBeenCalledWith('sunlight', TODAY));
    });

    it('saves a below-target amount for a numeric Partial', async () => {
        const store = setupStore([protein]);
        await renderAt(2);

        fireEvent.click(within(card('Protein Target')).getByRole('button', { name: 'Partial' }));
        fireEvent.change(screen.getByLabelText(/How much did you get/), { target: { value: '90' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(store.upsertHabitEntry).toHaveBeenCalledWith('protein', TODAY, { value: 90, source: 'manual' }));
    });

    it('cycles through habits on the mood page without changing the page count', async () => {
        setupStore([sunlight, skincare], { ...completedLog('sunlight'), ...completedLog('skincare') });
        await renderAt(3);

        expect(screen.getByRole('region', { name: 'Morning Sunlight, habit 1 of 2' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: '4 of 5, Good' }));
        fireEvent.click(screen.getByRole('button', { name: 'Calm' }));
        expect(screen.getByRole('radio', { name: '4 of 5, Good' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: /Next habit/ }));
        expect(screen.getByRole('region', { name: 'Skin care, habit 2 of 2' })).toBeInTheDocument();
        expect(screen.getByRole('progressbar', { name: 'Daily check-in progress' })).toHaveAttribute('aria-valuetext', 'Step 3 of 5');
        expect(screen.getByRole('radio', { name: '4 of 5, Good' })).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(screen.getByRole('button', { name: 'Previous habit' }));
        expect(screen.getByRole('radio', { name: '4 of 5, Good' })).toHaveAttribute('aria-checked', 'true');

        await waitFor(() => expect(lastSavedPayload()?.habits).toEqual([
            expect.objectContaining({ habitId: 'sunlight', moodScore: 4, moodTags: ['calm'] }),
        ]));
    });

    it('supports arrow keys on the emoji scale and effort selector', async () => {
        setupStore([sunlight], completedLog('sunlight'));
        await renderAt(3);

        const neutral = screen.getByRole('radio', { name: '3 of 5, Neutral' });
        fireEvent.keyDown(neutral, { key: 'ArrowRight' });
        expect(screen.getByRole('radio', { name: '4 of 5, Good' })).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
        expect(screen.getByRole('heading', { name: 'How much effort did it take?' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: '2, Easy' }));
        expect(screen.getByText('Easy')).toBeInTheDocument();
        await waitFor(() => expect(lastSavedPayload()?.habits).toEqual([
            expect.objectContaining({ habitId: 'sunlight', moodScore: 4, effortScore: 2 }),
        ]));
    });

    it('skips the mood and effort pages when nothing needs reflection', async () => {
        setupStore([skincare]);
        await renderAt(2);

        fireEvent.click(within(card('Skin care')).getByRole('button', { name: 'Skip' }));
        fireEvent.click(screen.getByRole('button', { name: /^Continue/ }));

        expect(screen.getByRole('heading', { name: 'Wrap up your day' })).toBeInTheDocument();
        // In-app back pops the history entry pushed on the way forward (async popstate).
        fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
        expect(await screen.findByRole('heading', { name: 'What did you complete?' })).toBeInTheDocument();
        expect(new URLSearchParams(window.location.search).get('step')).toBe('2');
    });

    it('goes back a page through browser history', async () => {
        setupStore([sunlight]);
        await renderAt(1);

        fireEvent.click(screen.getByRole('button', { name: /Start Daily Check-in/ }));
        fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
        expect(screen.getByRole('heading', { name: 'Wrap up your day' })).toBeInTheDocument();

        await act(async () => {
            window.history.back();
            await new Promise(resolve => setTimeout(resolve, 50));
        });
        expect(screen.getByRole('heading', { name: 'What did you complete?' })).toBeInTheDocument();
    });

    it('saves the journal, completes the check-in and exits with a confirmation', async () => {
        setupStore([sunlight], completedLog('sunlight'));
        const { onExit } = await renderAt(5);

        expect(screen.getByText('1 of 1 habit completed')).toBeInTheDocument();
        expect(screen.getByText('12 day streak')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Journal note for Morning Sunlight'), { target: { value: 'Outside by 8!' } });
        fireEvent.click(screen.getByRole('button', { name: /Complete Check-in/ }));

        await waitFor(() => expect(onExit).toHaveBeenCalled());
        expect(lastSavedPayload()).toMatchObject({
            status: 'complete',
            habits: [expect.objectContaining({ habitId: 'sunlight', journalEntry: 'Outside by 8!' })],
        });
        expect(mocks.showToast).toHaveBeenCalledWith('Daily check-in complete — nice work!', 'success');
    });

    it('offers to continue an in-progress check-in where the user stopped', async () => {
        mocks.fetchDailyCheckIn.mockResolvedValue(serverCheckIn({
            currentStep: 4,
            habits: [{ habitId: 'sunlight', completionStatus: null, moodScore: 5, moodTags: [], effortScore: null, journalEntry: null }],
        }));
        setupStore([sunlight], completedLog('sunlight'));
        await renderAt(1);

        fireEvent.click(await screen.findByRole('button', { name: /Continue Daily Check-in/ }));
        expect(screen.getByRole('heading', { name: 'How much effort did it take?' })).toBeInTheDocument();
    });

    it('shows a friendly empty state when nothing is scheduled today', async () => {
        setupStore([]);
        const { onExit } = await renderAt(1);

        expect(screen.getByText('No habits scheduled today')).toBeInTheDocument();
        // Both the back arrow and the primary action lead back to the dashboard.
        const exits = screen.getAllByRole('button', { name: /Back to Dashboard/ });
        expect(exits).toHaveLength(2);
        fireEvent.click(exits[1]);
        expect(onExit).toHaveBeenCalled();
    });
});
