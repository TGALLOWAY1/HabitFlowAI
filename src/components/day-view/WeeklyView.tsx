import { useMemo, useState } from 'react';
import { useHabitStore } from '../../store/HabitContext';
import { DayCategorySection } from './DayCategorySection';
import { CategoryPickerModal } from '../CategoryPickerModal';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Calendar } from 'lucide-react';
import { fetchDayView, getLocalTimeZone } from '../../lib/persistenceClient';
import { useEffect } from 'react';

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

export const WeeklyView = () => {
    const {
        habits,
        categories,
        logs,
        toggleHabit,
        updateHabit,
        upsertHabitEntry,
        deleteHabitEntryByKey,
    } = useHabitStore();

    const today = useMemo(() => new Date(), []);
    const dateStr = format(today, 'yyyy-MM-dd');
    const weekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
    const weekEnd = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
    const displayRange = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;

    const [dayViewData, setDayViewData] = useState<DayViewData | null>(null);
    const [dayViewLoading, setDayViewLoading] = useState(true);
    const [dayViewError, setDayViewError] = useState<string | null>(null);
    const [categoryPickerHabit, setCategoryPickerHabit] = useState<Habit | null>(null);

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

    const habitStatusMap = useMemo(() => {
        if (!dayViewData) return new Map<string, DayViewHabitStatus>();
        return new Map(dayViewData.habits.map(status => [status.habit.id, status]));
    }, [dayViewData]);

    // Filter to weekly habits only (root level, not archived)
    const weeklyHabits = useMemo(() => {
        const childIds = new Set<string>();
        habits.forEach(h => {
            if (h.type === 'bundle' && h.subHabitIds) {
                h.subHabitIds.forEach(id => childIds.add(id));
            }
        });

        return habits.filter(h => {
            if (h.archived) return false;
            if (childIds.has(h.id)) return false;
            const frequency = h.frequency || h.goal.frequency;
            return frequency === 'weekly';
        });
    }, [habits]);

    const allHabitsLookup = useMemo(() => {
        return new Map(habits.map(h => [h.id, h]));
    }, [habits]);

    // Merge context logs for immediate UI updates
    const resolvedHabitStatusMap = useMemo(() => {
        const map = new Map(habitStatusMap);

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

        weeklyHabits.forEach(mergeHabitLog);
        weeklyHabits.forEach(habit => {
            if (habit.type === 'bundle' && habit.subHabitIds) {
                habit.subHabitIds.forEach(subId => {
                    const subHabit = allHabitsLookup.get(subId);
                    if (subHabit) mergeHabitLog(subHabit);
                });
            }
        });

        return map;
    }, [habitStatusMap, logs, weeklyHabits, dateStr, allHabitsLookup]);

    // Group by category
    const UNCATEGORIZED_ID = '__uncategorized__';
    const groupedHabits = useMemo(() => {
        const groups = new Map<string, Habit[]>();
        categories.forEach(c => groups.set(c.id, []));

        weeklyHabits.forEach(h => {
            const list = groups.get(h.categoryId);
            if (list) list.push(h);
            else {
                const uncategorized = groups.get(UNCATEGORIZED_ID) || [];
                uncategorized.push(h);
                groups.set(UNCATEGORIZED_ID, uncategorized);
            }
        });
        return groups;
    }, [weeklyHabits, categories]);

    const handleToggle = async (habitId: string) => {
        await toggleHabit(habitId, dateStr);
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

    // Empty state
    if (!dayViewLoading && weeklyHabits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-6 sm:p-10 text-center">
                <div className="w-14 h-14 bg-neutral-800 rounded-full flex items-center justify-center mb-5">
                    <Calendar size={28} className="text-neutral-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                    No weekly habits yet
                </h3>
                <p className="text-sm text-neutral-400 mb-5 max-w-sm leading-relaxed">
                    Create habits with a weekly frequency to track goals you want to hit each week.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full max-w-6xl mx-auto pb-24 px-4 sm:px-6">
            {/* Header */}
            <div className="py-3 flex items-center justify-between">
                <p className="text-neutral-400 font-medium">Week of {displayRange}</p>
            </div>

            {dayViewLoading && (
                <div className="flex items-center justify-center py-8">
                    <p className="text-neutral-500">Loading...</p>
                </div>
            )}

            {dayViewError && (
                <div className="flex items-center justify-center py-8">
                    <p className="text-red-500">Error: {dayViewError}</p>
                </div>
            )}

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
                    {(groupedHabits.get(UNCATEGORIZED_ID) || []).length > 0 && (
                        <DayCategorySection
                            key={UNCATEGORIZED_ID}
                            category={{ id: UNCATEGORIZED_ID, name: 'Uncategorized', color: 'bg-amber-600' }}
                            habits={groupedHabits.get(UNCATEGORIZED_ID)!}
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
                    )}
                </div>
            )}

            <div className="h-12" />

            <CategoryPickerModal
                isOpen={!!categoryPickerHabit}
                onClose={() => setCategoryPickerHabit(null)}
                habitId={categoryPickerHabit?.id ?? ''}
                currentCategoryId={categoryPickerHabit?.categoryId ?? ''}
            />
        </div>
    );
};
