import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, GripVertical } from 'lucide-react';
import type { Category, Habit } from '../../types';
import { DayHabitGrid } from './DayHabitGrid';
import { cn } from '../../utils/cn';
import type { DayViewHabitStatus } from './habitStatusResolution';

interface DayCategorySectionProps {
    category: Category;
    habits: Habit[];
    habitStatusMap: Map<string, DayViewHabitStatus>;
    dateStr: string;
    onToggle: (habitId: string) => Promise<void>;
    onPin: (habitId: string) => void;
    onMoveToCategory?: (habit: Habit) => void;
    onAddToBundle?: (habit: Habit) => void;
    onViewHistory?: (habit: Habit) => void;
    onEditHabit?: (habit: Habit) => void;
    /** Whether HabitGridCells in this section show the trash/archive button. */
    showRemove?: boolean;
    allHabitsLookup: Map<string, Habit>;
    onUpdateHabitEntry: (habitId: string, dateKey: string, data: unknown) => Promise<void>;
    deleteHabitEntryByKey: (habitId: string, dateKey: string) => Promise<void>;
    dragHandleProps?: Record<string, unknown>;
}

export const DayCategorySection = ({
    category,
    habits,
    habitStatusMap,
    dateStr,
    onToggle,
    onPin,
    onMoveToCategory,
    onAddToBundle,
    onViewHistory,
    onEditHabit,
    showRemove,
    allHabitsLookup,
    onUpdateHabitEntry,
    deleteHabitEntryByKey,
    dragHandleProps
}: DayCategorySectionProps) => {
    // Sort habits by order
    const sortedHabits = useMemo(() => {
        return [...habits].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    }, [habits]);

    // Compute completion status for default collapse (from truthQuery)
    const { allDone, completedCount } = useMemo(() => {
        if (habits.length === 0) return { allDone: true, completedCount: 0 };

        let done = 0;
        habits.forEach(h => {
            const status = habitStatusMap.get(h.id);
            if (status?.isComplete) done++;
        });

        return { allDone: done === habits.length, completedCount: done };
    }, [habits, habitStatusMap]);

    const [isCollapsed, setIsCollapsed] = useState(false);

    // Initial Collapse Logic: If all done (and not empty), collapse.
    useEffect(() => {
        if (allDone && habits.length > 0) {
            setIsCollapsed(true);
        } else {
            setIsCollapsed(false);
        }
    }, [allDone, habits.length]);

    if (habits.length === 0) return null;

    return (
        <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="flex items-center gap-0 mb-3">
                {dragHandleProps && (
                    <div
                        {...dragHandleProps}
                        className="p-1 cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 transition-colors touch-none"
                    >
                        <GripVertical size={18} />
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center gap-2 px-1 flex-1 text-left group transition-opacity hover:opacity-80"
                >
                {(() => {
                    // Determine color application strategy
                    const isTailwindClass = category.color.startsWith('bg-');
                    const textColorClass = isTailwindClass ? category.color.replace('bg-', 'text-') : undefined;
                    const styleColor = !isTailwindClass ? { color: category.color } : undefined;

                    return (
                        <>
                            {isCollapsed ?
                                <ChevronRight size={20} className={textColorClass} style={styleColor} /> :
                                <ChevronDown size={20} className={textColorClass} style={styleColor} />
                            }

                            <h2
                                className={cn("text-lg font-bold transition-colors", textColorClass)}
                                style={styleColor}
                            >
                                {category.name}
                            </h2>
                        </>
                    );
                })()}

                {allDone && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-emerald-500 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={12} />
                        All Done
                    </span>
                )}
                {!allDone && (
                    <span className="ml-auto text-xs text-neutral-600">
                        {completedCount}/{habits.length}
                    </span>
                )}
                </button>
            </div>

            {/* Content - GRID LAYOUT */}
            {!isCollapsed && (
                <DayHabitGrid
                    habits={sortedHabits}
                    habitStatusMap={habitStatusMap}
                    dateStr={dateStr}
                    allHabitsLookup={allHabitsLookup}
                    onToggle={onToggle}
                    onPin={onPin}
                    onMoveToCategory={onMoveToCategory}
                    onAddToBundle={onAddToBundle}
                    onViewHistory={onViewHistory}
                    onEditHabit={onEditHabit}
                    showRemove={showRemove}
                    onUpdateHabitEntry={onUpdateHabitEntry}
                    deleteHabitEntryByKey={deleteHabitEntryByKey}
                />
            )}
        </div>
    );
};
