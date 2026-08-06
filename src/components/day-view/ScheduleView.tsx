import { useCallback, useMemo, useState } from 'react';
import { useHabitStore } from '../../store/HabitContext';
import { DayCategorySection } from './DayCategorySection';
import { CategoryPickerModal } from '../CategoryPickerModal';
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { getLocalTimeZone } from '../../lib/persistenceClient';
import { getBundleChildIds } from '../../utils/habitUtils';

import type { Habit } from '../../types';
import { resolveLocalHabitStatuses, type DayViewHabitStatus } from './habitStatusResolution';
import { isHabitScheduledOnDay } from '../../domain/habits/schedule';
import { resolveHabitTrackingForDay } from '../../domain/habits/trackingHistory';
import { useDayViewData } from './useDayViewData';

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

    const { dayViewData, dayViewLoading, dayViewError, refreshDayView } = useDayViewData(selectedDayKey, habits);
    const [categoryPickerHabit, setCategoryPickerHabit] = useState<Habit | null>(null);
    const [showDailyHabits, setShowDailyHabits] = useState(false);

    const habitStatusMap = useMemo(() => {
        if (!dayViewData) return new Map<string, DayViewHabitStatus>();
        return new Map(dayViewData.habits.map(status => [status.habit.id, status]));
    }, [dayViewData]);

    // Build child ID set. Shared helper: only ACTIVE parents hide their
    // children, so children of archived/deleted bundles stay reachable.
    const childIds = useMemo(() => getBundleChildIds(habits), [habits]);

    // Separate scheduled habits vs daily habits
    const { scheduledHabits, dailyHabits } = useMemo(() => {
        const scheduled: Habit[] = [];
        const daily: Habit[] = [];

        habits.forEach(h => {
            if (h.archived) return;
            if (childIds.has(h.id)) return;
            if (!isHabitScheduledOnDay(h, selectedDayKey, getLocalTimeZone())) return;

            const tracking = resolveHabitTrackingForDay(h, selectedDayKey);
            const hasAssignedDays = !!tracking.assignedDays?.length;
            const hasTimesPerWeek = tracking.timesPerWeek != null && tracking.timesPerWeek > 0;

            // Habits with specific days or weekly quota are "scheduled"
            if (hasAssignedDays || hasTimesPerWeek) {
                scheduled.push(h);
            } else {
                // Pure daily habits (every day, no special scheduling)
                daily.push(h);
            }
        });

        return { scheduledHabits: scheduled, dailyHabits: daily };
    }, [habits, childIds, selectedDayKey]);

    const allHabitsLookup = useMemo(() => {
        return new Map(habits.map(h => [h.id, h]));
    }, [habits]);

    // Merge context logs for immediate UI updates
    const resolvedHabitStatusMap = useMemo(() => {
        const rootHabits = [...scheduledHabits, ...dailyHabits];
        const allRelevantHabits = [...rootHabits];
        rootHabits.forEach(habit => {
            if (habit.type === 'bundle' && habit.subHabitIds) {
                habit.subHabitIds.forEach(subId => {
                    const subHabit = allHabitsLookup.get(subId);
                    if (subHabit) allRelevantHabits.push(subHabit);
                });
            }
        });
        return resolveLocalHabitStatuses({
            baseStatuses: habitStatusMap,
            habits: allRelevantHabits,
            logs,
            dayKey: selectedDayKey,
        });
    }, [habitStatusMap, logs, scheduledHabits, dailyHabits, selectedDayKey, allHabitsLookup]);

    // Group habits by category
    const UNCATEGORIZED_ID = '__uncategorized__';
    const groupByCategory = useCallback((habitList: Habit[]) => {
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
    }, [categories]);

    const scheduledGrouped = useMemo(() => groupByCategory(scheduledHabits), [scheduledHabits, groupByCategory]);
    const dailyGrouped = useMemo(() => groupByCategory(dailyHabits), [dailyHabits, groupByCategory]);

    const handleToggle = async (habitId: string) => {
        await toggleHabit(habitId, selectedDayKey);
        await refreshDayView();
    };

    const handleUpsertHabitEntry = async (habitId: string, dayKey: string, data: unknown) => {
        await upsertHabitEntry(habitId, dayKey, data);
        await refreshDayView();
    };

    const handleDeleteHabitEntry = async (habitId: string, dayKey: string) => {
        await deleteHabitEntryByKey(habitId, dayKey);
        await refreshDayView();
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
                        onUpdateHabitEntry={handleUpsertHabitEntry}
                        deleteHabitEntryByKey={handleDeleteHabitEntry}
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
                    onUpdateHabitEntry={handleUpsertHabitEntry}
                    deleteHabitEntryByKey={handleDeleteHabitEntry}
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
                    className="p-1 text-neutral-400 hover:text-white transition-colors"
                    aria-label="Previous week"
                >
                    <ChevronLeft size={20} />
                </button>
                <button
                    onClick={() => setWeekOffset(0)}
                    className="text-neutral-400 font-medium text-sm hover:text-white transition-colors"
                >
                    {weekOffset === 0 ? 'This Week' : `${format(weekStart, 'MMM d')} – ${format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'MMM d')}`}
                </button>
                <button
                    onClick={() => setWeekOffset(w => w + 1)}
                    className="p-1 text-neutral-400 hover:text-white transition-colors"
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
                                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                                    : isToday
                                        ? 'bg-neutral-800 border border-white/10 text-white'
                                        : 'bg-neutral-800/50 border border-transparent text-neutral-400 hover:bg-neutral-800'
                            }`}
                        >
                            <span className="font-medium">{dayNames[i]}</span>
                            <span className={`text-lg font-semibold ${isSelected ? 'text-emerald-400' : ''}`}>
                                {format(day, 'd')}
                            </span>
                        </button>
                    );
                })}
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
                    {/* Scheduled Habits Section */}
                    {scheduledHabits.length > 0 ? (
                        renderCategoryGroups(scheduledGrouped)
                    ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center">
                            <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mb-3">
                                <Calendar size={24} className="text-neutral-500" />
                            </div>
                            <p className="text-sm text-neutral-500">
                                No scheduled habits for {format(selectedDate, 'EEEE')}
                            </p>
                        </div>
                    )}

                    {/* Daily Habits Collapsible Section */}
                    {dailyHabits.length > 0 && (
                        <div className="mt-2">
                            <button
                                onClick={() => setShowDailyHabits(!showDailyHabits)}
                                className="flex items-center gap-2 w-full py-2 px-3 rounded-lg bg-neutral-800/50 border border-white/5 text-neutral-400 hover:text-white transition-colors"
                            >
                                {showDailyHabits ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                <span className="text-sm font-medium">Daily Habits</span>
                                <span className="text-xs text-neutral-500 ml-auto">{dailyHabits.length}</span>
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
