import { useMemo } from 'react';
import { useHabitStore } from '../../store/HabitContext';
import { getHabitsForDate } from '../../utils/habitUtils';
import { PinnedHabitsStrip } from './PinnedHabitsStrip';
import { DayCategorySection } from './DayCategorySection';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

import type { Habit } from '../../types';

export const DayView = () => {
    const {
        habits,
        categories,
        logs,
        toggleHabit,
        updateHabit,
        upsertHabitEntry,
        deleteHabitEntryByKey
    } = useHabitStore();

    // Use Today
    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
    const displayDate = format(today, 'EEEE · MMM d');

    // 1. Filter Habits for Today (Root level, frequency match)
    const todaysHabits = useMemo(() => {
        if (!habits) return [];
        return getHabitsForDate(habits, today);
    }, [habits, today]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Lookup Map for Bundle Resolution
    const allHabitsLookup = useMemo(() => {
        return new Map(habits.map(h => [h.id, h]));
    }, [habits]);

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

    // Empty State?
    if (todaysHabits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-8">
                <Calendar size={48} className="mb-4 opacity-50" />
                <p>No habits scheduled for today.</p>
                <p className="text-sm mt-2">Enjoy your free time!</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full max-w-6xl mx-auto pb-24 px-4 sm:px-6">
            {/* Header */}
            <div className="py-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                    Today
                </h1>
                <p className="text-neutral-500 font-medium mt-1">{displayDate}</p>
            </div>

            {/* Pinned / Focus Section */}
            {pinnedHabits.length > 0 && (
                <PinnedHabitsStrip
                    habits={pinnedHabits}
                    onUnpin={handlePin}
                    onToggle={handleToggle}
                    checkStatus={(id) => !!logs[`${id}-${dateStr}`]?.completed}
                />
            )}

            {/* Categories */}
            <div className="flex flex-col gap-2">
                {categories.map(cat => {
                    const catHabits = groupedHabits.get(cat.id) || [];
                    if (catHabits.length === 0) return null;

                    return (
                        <DayCategorySection
                            key={cat.id}
                            category={cat}
                            habits={catHabits}
                            logs={logs}
                            dateStr={dateStr}
                            onToggle={handleToggle}
                            onPin={handlePin}
                            onUpdateEstimate={handleUpdateEstimate}
                            allHabitsLookup={allHabitsLookup}
                            onUpdateHabitEntry={upsertHabitEntry}
                            deleteHabitEntryByKey={deleteHabitEntryByKey}
                        />
                    );
                })}
            </div>

            {/* Footer / Empty Space for scrolling */}
            <div className="h-12" />
        </div>
    );
};
