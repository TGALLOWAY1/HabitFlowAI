import { useMemo, useState, useEffect } from 'react';
import { useHabitStore } from '../../store/HabitContext';
import { getHabitsForDate } from '../../utils/habitUtils';
import { PinnedHabitsStrip } from './PinnedHabitsStrip';
import { DayCategorySection } from './DayCategorySection';
import { CategoryPickerModal } from '../CategoryPickerModal';
import { format } from 'date-fns';
import { Calendar, Plus, ListTodo, Layers } from 'lucide-react';
import { fetchDayView, getLocalTimeZone } from '../../lib/persistenceClient';

import type { Habit } from '../../types';

interface DayViewHabitStatus {
    habit: Habit;
    isComplete: boolean;
    currentValue: number;
    targetValue: number;
    progressPercent: number;
    weekComplete?: boolean;
    completedChildrenCount?: number;
    totalChildrenCount?: number;
}

interface DayViewData {
    dayKey: string;
    habits: DayViewHabitStatus[];
}

interface DayViewProps {
    onAddHabit?: () => void;
}

export const DayView = ({ onAddHabit }: DayViewProps = {}) => {
    const {
        habits,
        categories,
        logs,
        toggleHabit,
        updateHabit,
        upsertHabitEntry,
        deleteHabitEntryByKey
    } = useHabitStore();

    // Use Today — stable reference to avoid re-computation on every render
    const today = useMemo(() => new Date(), []);
    const dateStr = format(today, 'yyyy-MM-dd');
    const displayDate = format(today, 'EEEE · MMM d');

    // Day View state (from truthQuery)
    const [dayViewData, setDayViewData] = useState<DayViewData | null>(null);
    const [dayViewLoading, setDayViewLoading] = useState(true);
    const [dayViewError, setDayViewError] = useState<string | null>(null);
    const [categoryPickerHabit, setCategoryPickerHabit] = useState<Habit | null>(null);

    // Fetch day view from truthQuery endpoint
    useEffect(() => {
        const loadDayView = async () => {
            setDayViewLoading(true);
            setDayViewError(null);
            try {
                const data = await fetchDayView(dateStr, getLocalTimeZone());
                setDayViewData(data);
            } catch (err) {
                console.error('Failed to load day view:', err);
                setDayViewError(err instanceof Error ? err.message : 'Failed to load day view');
            } finally {
                setDayViewLoading(false);
            }
        };

        loadDayView();
    }, [dateStr]);

    // Create lookup map for habit statuses (from API)
    const habitStatusMap = useMemo(() => {
        if (!dayViewData) return new Map<string, DayViewHabitStatus>();
        return new Map(dayViewData.habits.map(status => [status.habit.id, status]));
    }, [dayViewData]);

    // 1. Filter Habits for Today (Root level, frequency match)
    const todaysHabits = useMemo(() => {
        if (!habits) return [];
        return getHabitsForDate(habits, today);
    }, [habits, today]);

    // Lookup Map for Bundle Resolution
    const allHabitsLookup = useMemo(() => {
        return new Map(habits.map(h => [h.id, h]));
    }, [habits]);

    // Merge with context logs so toggles from Today view update UI immediately
    const resolvedHabitStatusMap = useMemo(() => {
        const map = new Map(habitStatusMap);

        // Helper to merge a single habit's log into the map
        const mergeHabitLog = (habit: Habit) => {
            const key = `${habit.id}-${dateStr}`;
            const log = logs[key];
            if (log !== undefined) {
                const isComplete = habit.goal?.type === 'number'
                    ? (habit.goal.target ? ((log.value ?? 0) >= habit.goal.target) : (log.value ?? 0) > 0)
                    : !!log.completed;
                const existing = map.get(habit.id);
                if (existing) {
                    map.set(habit.id, { ...existing, isComplete, currentValue: log.value ?? 0 });
                } else {
                    map.set(habit.id, {
                        habit,
                        isComplete,
                        currentValue: log.value ?? 0,
                        targetValue: habit.goal?.target ?? 0,
                        progressPercent: habit.goal?.target ? Math.min(100, ((log.value ?? 0) / habit.goal.target) * 100) : 0
                    });
                }
            }
        };

        // Merge root habits
        todaysHabits.forEach(mergeHabitLog);

        // Merge sub-habits of bundles so DayCategorySection can look up their status
        todaysHabits.forEach(habit => {
            if (habit.type === 'bundle' && habit.subHabitIds) {
                habit.subHabitIds.forEach(subId => {
                    const subHabit = allHabitsLookup.get(subId);
                    if (subHabit) mergeHabitLog(subHabit);
                });
            }
        });

        return map;
    }, [habitStatusMap, logs, todaysHabits, dateStr, allHabitsLookup]);

    // 2. Identify Pinned Habits
    const pinnedHabits = useMemo(() => {
        return todaysHabits.filter(h => h.pinned);
    }, [todaysHabits]);

    // 3. Group by Category
    const groupedHabits = useMemo(() => {
        const groups = new Map<string, Habit[]>();
        categories.forEach(c => groups.set(c.id, [])); // Init groups

        todaysHabits.forEach(h => {
            const list = groups.get(h.categoryId);
            if (list) list.push(h);
            else {
                // Fallback if category missing?
                // Ignore or add to 'Uncategorized'? safe to ignore for now
            }
        });
        return groups;
    }, [todaysHabits, categories]);

    // Handlers
    const handleToggle = (habitId: string) => {
        toggleHabit(habitId, dateStr);
    };

    const handlePin = async (habitId: string) => {
        const habit = habits.find(h => h.id === habitId);
        if (habit) {
            await updateHabit(habitId, { pinned: !habit.pinned });
        }
    };

    const handleUpdateEstimate = async (habitId: string, minutes: number) => {
        await updateHabit(habitId, { timeEstimate: minutes });
    };

    // Sort categories (optional, if categories have order)
    // Assuming categories array is sorted or we verify sort?
    // HabitContext usually returns them in DB order?
    // Let's rely on categories array order.

    // Empty State — show actionable guidance for new users
    if (todaysHabits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-6 sm:p-10 text-center">
                <div className="w-14 h-14 bg-neutral-800 rounded-full flex items-center justify-center mb-5">
                    <Calendar size={28} className="text-neutral-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                    Habits are actions that, when done consistently, move you towards your goals.
                </h3>
                <p className="text-sm text-neutral-400 mb-5 max-w-sm leading-relaxed">
                    Start with 1–3 habits you want to repeat most days.
                </p>

                {/* Example habits by category */}
                <div className="w-full max-w-sm space-y-3 mb-5 text-left">
                    <div>
                        <p className="text-xs font-semibold text-emerald-400 mb-1.5 uppercase tracking-wider">Physical Health</p>
                        <div className="flex flex-wrap gap-2">
                            {['Morning Walk', 'Drink Water', 'Stretching'].map((ex) => (
                                <span key={ex} className="px-3 py-1 text-xs text-neutral-400 bg-neutral-800/80 rounded-full border border-white/5">{ex}</span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-emerald-400 mb-1.5 uppercase tracking-wider">Mental Health</p>
                        <div className="flex flex-wrap gap-2">
                            {['Meditation', 'Gratitude Journal', 'Reading'].map((ex) => (
                                <span key={ex} className="px-3 py-1 text-xs text-neutral-400 bg-neutral-800/80 rounded-full border border-white/5">{ex}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bundle examples */}
                <div className="w-full max-w-sm space-y-2 mb-6 text-left">
                    <p className="text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Habit Bundles</p>
                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/60 rounded-lg border border-white/5">
                        <ListTodo size={14} className="text-indigo-400 flex-shrink-0" />
                        <span className="text-xs text-neutral-400"><span className="text-neutral-300">Collection:</span> Morning Routine — Make Bed + Brush Teeth + Vitamins</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/60 rounded-lg border border-white/5">
                        <Layers size={14} className="text-amber-400 flex-shrink-0" />
                        <span className="text-xs text-neutral-400"><span className="text-neutral-300">Choice:</span> Cardio — Run OR Bike OR Swim</span>
                    </div>
                </div>

                {onAddHabit && (
                    <button
                        onClick={onAddHabit}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                        Create Your First Habit
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full max-w-6xl mx-auto pb-24 px-4 sm:px-6">
            {/* Header */}
            <div className="py-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                        Today
                    </h1>
                    <p className="text-neutral-500 font-medium mt-1">{displayDate}</p>
                </div>
                {onAddHabit && (
                    <button
                        onClick={onAddHabit}
                        className="p-2 rounded-lg hover:bg-neutral-800 text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="Add New Habit"
                    >
                        <Plus size={22} />
                    </button>
                )}
            </div>

            {/* Loading State */}
            {dayViewLoading && (
                <div className="flex items-center justify-center py-8">
                    <p className="text-neutral-500">Loading...</p>
                </div>
            )}

            {/* Error State */}
            {dayViewError && (
                <div className="flex items-center justify-center py-8">
                    <p className="text-red-500">Error: {dayViewError}</p>
                </div>
            )}

            {/* Pinned / Focus Section */}
            {!dayViewLoading && !dayViewError && pinnedHabits.length > 0 && (
                <PinnedHabitsStrip
                    habits={pinnedHabits}
                    onUnpin={handlePin}
                    onToggle={handleToggle}
                    checkStatus={(id) => {
                        const status = resolvedHabitStatusMap.get(id);
                        return status?.isComplete ?? false;
                    }}
                />
            )}

            {/* Categories */}
            {!dayViewLoading && !dayViewError && (
                <div className="flex flex-col gap-2">
                    {categories.map(cat => {
                        const catHabits = groupedHabits.get(cat.id) || [];
                        if (catHabits.length === 0) return null;

                        return (
                            <DayCategorySection
                                key={cat.id}
                                category={cat}
                                habits={catHabits}
                                habitStatusMap={resolvedHabitStatusMap}
                                dateStr={dateStr}
                                onToggle={handleToggle}
                                onPin={handlePin}
                                onUpdateEstimate={handleUpdateEstimate}
                                onMoveToCategory={(h) => setCategoryPickerHabit(h)}
                                allHabitsLookup={allHabitsLookup}
                                onUpdateHabitEntry={upsertHabitEntry}
                                deleteHabitEntryByKey={deleteHabitEntryByKey}
                            />
                        );
                    })}
                </div>
            )}

            {/* Footer / Empty Space for scrolling */}
            <div className="h-12" />

            {/* Category Picker Modal */}
            <CategoryPickerModal
                isOpen={!!categoryPickerHabit}
                onClose={() => setCategoryPickerHabit(null)}
                habitId={categoryPickerHabit?.id ?? ''}
                currentCategoryId={categoryPickerHabit?.categoryId ?? ''}
            />
        </div>
    );
};
