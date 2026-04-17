import { useMemo, useState } from 'react';
import { useHabitStore } from '../../store/HabitContext';
import { DayCategorySection } from './DayCategorySection';
import { CategoryPickerModal } from '../CategoryPickerModal';
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
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

export const ScheduleView = () => {
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
    const [weekOffset, setWeekOffset] = useState(0);
    const weekStart = useMemo(() => {
        const base = startOfWeek(today, { weekStartsOn: 1 });
        return weekOffset === 0 ? base : weekOffset > 0 ? addWeeks(base, weekOffset) : subWeeks(base, -weekOffset);
    }, [today, weekOffset]);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }, [weekStart]);

    const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
        const todayDow = today.getDay(); // 0=Sun
        // Convert to Mon-start index: Mon=0, Tue=1, ... Sun=6
        return todayDow === 0 ? 6 : todayDow - 1;
    });

    const selectedDate = weekDays[selectedDayIndex];
    const selectedDayKey = format(selectedDate, 'yyyy-MM-dd');

    const [dayViewData, setDayViewData] = useState<DayViewData | null>(null);
    const [dayViewLoading, setDayViewLoading] = useState(true);
    const [dayViewError, setDayViewError] = useState<string | null>(null);
    const [categoryPickerHabit, setCategoryPickerHabit] = useState<Habit | null>(null);
    const [showDailyHabits, setShowDailyHabits] = useState(false);

    useEffect(() => {
        const loadDayView = async () => {
            setDayViewLoading(true);
            setDayViewError(null);
            try {
                const data = await fetchDayView(selectedDayKey, getLocalTimeZone());
                setDayViewData(data);
            } catch (err) {
                console.error('Failed to load day view:', err);
                setDayViewError(err instanceof Error ? err.message : 'Failed to load day view');
            } finally {
                setDayViewLoading(false);
            }
        };
        loadDayView();
    }, [selectedDayKey]);

    const habitStatusMap = useMemo(() => {
        if (!dayViewData) return new Map<string, DayViewHabitStatus>();
        return new Map(dayViewData.habits.map(status => [status.habit.id, status]));
    }, [dayViewData]);

    // Build child ID set
    const childIds = useMemo(() => {
        const ids = new Set<string>();
        habits.forEach(h => {
            if (h.type === 'bundle' && h.subHabitIds) {
                h.subHabitIds.forEach(id => ids.add(id));
            }
        });
        return ids;
    }, [habits]);

    // Get day-of-week for selected day (0=Sun..6=Sat)
    const selectedDow = selectedDate.getDay();

    // Separate scheduled habits vs daily habits
    const { scheduledHabits, dailyHabits } = useMemo(() => {
        const scheduled: Habit[] = [];
        const daily: Habit[] = [];

        habits.forEach(h => {
            if (h.archived) return;
            if (childIds.has(h.id)) return;

            const hasAssignedDays = h.assignedDays && h.assignedDays.length > 0;
            const hasTimesPerWeek = h.timesPerWeek != null && h.timesPerWeek > 0;

            // Habits with specific days or weekly quota are "scheduled"
            if (hasAssignedDays || hasTimesPerWeek) {
                // Only show if scheduled on this day
                if (hasAssignedDays && !h.assignedDays!.includes(selectedDow)) return;
                scheduled.push(h);
            } else {
                // Pure daily habits (every day, no special scheduling)
                daily.push(h);
            }
        });

        return { scheduledHabits: scheduled, dailyHabits: daily };
    }, [habits, childIds, selectedDow]);

    const allHabitsLookup = useMemo(() => {
        return new Map(habits.map(h => [h.id, h]));
    }, [habits]);

    // Merge context logs for immediate UI updates
    const resolvedHabitStatusMap = useMemo(() => {
        const map = new Map(habitStatusMap);
        const allRelevantHabits = [...scheduledHabits, ...dailyHabits];

        const mergeHabitLog = (habit: Habit) => {
            const key = `${habit.id}-${selectedDayKey}`;
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

        allRelevantHabits.forEach(mergeHabitLog);
        allRelevantHabits.forEach(habit => {
            if (habit.type === 'bundle' && habit.subHabitIds) {
                habit.subHabitIds.forEach(subId => {
                    const subHabit = allHabitsLookup.get(subId);
                    if (subHabit) mergeHabitLog(subHabit);
                });
            }
        });

        return map;
    }, [habitStatusMap, logs, scheduledHabits, dailyHabits, selectedDayKey, allHabitsLookup]);

    // Group habits by category
    const UNCATEGORIZED_ID = '__uncategorized__';
    const groupByCategory = (habitList: Habit[]) => {
        const groups = new Map<string, Habit[]>();
        categories.forEach(c => groups.set(c.id, []));

        habitList.forEach(h => {
            const list = groups.get(h.categoryId);
            if (list) list.push(h);
            else {
                const uncategorized = groups.get(UNCATEGORIZED_ID) || [];
                uncategorized.push(h);
                groups.set(UNCATEGORIZED_ID, uncategorized);
            }
        });
        return groups;
    };

    const scheduledGrouped = useMemo(() => groupByCategory(scheduledHabits), [scheduledHabits, categories]);
    const dailyGrouped = useMemo(() => groupByCategory(dailyHabits), [dailyHabits, categories]);

    const handleToggle = async (habitId: string) => {
        await toggleHabit(habitId, selectedDayKey);
    };

    const handlePin = async (habitId: string) => {
        const habit = habits.find(h => h.id === habitId);
        if (habit) {
            await updateHabit(habitId, { pinned: !habit.pinned });
        }
    };

    const renderCategoryGroups = (groups: Map<string, Habit[]>) => (
        <>
            {categories.map(cat => {
                const catHabits = groups.get(cat.id) || [];
                if (catHabits.length === 0) return null;

                return (
                    <DayCategorySection
                        key={cat.id}
                        category={cat}
                        habits={catHabits}
                        habitStatusMap={resolvedHabitStatusMap}
                        dateStr={selectedDayKey}
                        onToggle={handleToggle}
                        onPin={handlePin}
                        onMoveToCategory={(h) => setCategoryPickerHabit(h)}
                        allHabitsLookup={allHabitsLookup}
                        onUpdateHabitEntry={upsertHabitEntry}
                        deleteHabitEntryByKey={deleteHabitEntryByKey}
                    />
                );
            })}
            {(groups.get(UNCATEGORIZED_ID) || []).length > 0 && (
                <DayCategorySection
                    key={UNCATEGORIZED_ID}
                    category={{ id: UNCATEGORIZED_ID, name: 'Uncategorized', color: 'bg-amber-600' }}
                    habits={groups.get(UNCATEGORIZED_ID)!}
                    habitStatusMap={resolvedHabitStatusMap}
                    dateStr={selectedDayKey}
                    onToggle={handleToggle}
                    onPin={handlePin}
                    onMoveToCategory={(h) => setCategoryPickerHabit(h)}
                    allHabitsLookup={allHabitsLookup}
                    onUpdateHabitEntry={upsertHabitEntry}
                    deleteHabitEntryByKey={deleteHabitEntryByKey}
                />
            )}
        </>
    );

    const todayKey = format(today, 'yyyy-MM-dd');
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="flex flex-col w-full max-w-6xl mx-auto pb-24 px-4 sm:px-6">
            {/* Week Navigation */}
            <div className="py-3 flex items-center justify-between">
                <button
                    onClick={() => setWeekOffset(w => w - 1)}
                    className="p-1 text-content-secondary hover:text-content-primary transition-colors"
                    aria-label="Previous week"
                >
                    <ChevronLeft size={20} />
                </button>
                <button
                    onClick={() => setWeekOffset(0)}
                    className="text-content-secondary font-medium text-sm hover:text-content-primary transition-colors"
                >
                    {weekOffset === 0 ? 'This Week' : `${format(weekStart, 'MMM d')} – ${format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'MMM d')}`}
                </button>
                <button
                    onClick={() => setWeekOffset(w => w + 1)}
                    className="p-1 text-content-secondary hover:text-content-primary transition-colors"
                    aria-label="Next week"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* 7-Day Strip */}
            <div className="grid grid-cols-7 gap-1 mb-4">
                {weekDays.map((day, i) => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const isSelected = i === selectedDayIndex;
                    const isToday = dayKey === todayKey;

                    return (
                        <button
                            key={dayKey}
                            onClick={() => setSelectedDayIndex(i)}
                            className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all text-xs ${
                                isSelected
                                    ? 'bg-accent-soft border border-emerald-500/50 text-accent-contrast'
                                    : isToday
                                        ? 'bg-surface-1 border border-line-subtle text-content-primary'
                                        : 'bg-surface-1/50 border border-transparent text-content-secondary hover:bg-surface-1'
                            }`}
                        >
                            <span className="font-medium">{dayNames[i]}</span>
                            <span className={`text-lg font-semibold ${isSelected ? 'text-accent-contrast' : ''}`}>
                                {format(day, 'd')}
                            </span>
                        </button>
                    );
                })}
            </div>

            {dayViewLoading && (
                <div className="flex items-center justify-center py-8">
                    <p className="text-content-muted">Loading...</p>
                </div>
            )}

            {dayViewError && (
                <div className="flex items-center justify-center py-8">
                    <p className="text-red-500">Error: {dayViewError}</p>
                </div>
            )}

            {!dayViewLoading && !dayViewError && (
                <div className="flex flex-col gap-2">
                    {/* Scheduled Habits Section */}
                    {scheduledHabits.length > 0 ? (
                        renderCategoryGroups(scheduledGrouped)
                    ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center">
                            <div className="w-12 h-12 bg-surface-1 rounded-full flex items-center justify-center mb-3">
                                <Calendar size={24} className="text-content-muted" />
                            </div>
                            <p className="text-sm text-content-muted">
                                No scheduled habits for {format(selectedDate, 'EEEE')}
                            </p>
                        </div>
                    )}

                    {/* Daily Habits Collapsible Section */}
                    {dailyHabits.length > 0 && (
                        <div className="mt-2">
                            <button
                                onClick={() => setShowDailyHabits(!showDailyHabits)}
                                className="flex items-center gap-2 w-full py-2 px-3 rounded-lg bg-surface-1/50 border border-line-subtle text-content-secondary hover:text-content-primary transition-colors"
                            >
                                {showDailyHabits ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                <span className="text-sm font-medium">Daily Habits</span>
                                <span className="text-xs text-content-muted ml-auto">{dailyHabits.length}</span>
                            </button>
                            {showDailyHabits && (
                                <div className="mt-2 flex flex-col gap-2">
                                    {renderCategoryGroups(dailyGrouped)}
                                </div>
                            )}
                        </div>
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
