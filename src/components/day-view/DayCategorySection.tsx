import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, GripVertical } from 'lucide-react';
import type { Category, Habit } from '../../types';
import { HabitGridCell } from './HabitGridCell';
import { NumericInputPopover } from '../NumericInputPopover';
import { cn } from '../../utils/cn';

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

interface DayCategorySectionProps {
    category: Category;
    habits: Habit[];
    habitStatusMap: Map<string, DayViewHabitStatus>;
    dateStr: string;
    onToggle: (habitId: string) => Promise<void>;
    onPin: (habitId: string) => void;
    onMoveToCategory?: (habit: Habit) => void;
    allHabitsLookup: Map<string, Habit>;
    onUpdateHabitEntry: (habitId: string, dateKey: string, data: any) => Promise<void>;
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

    // State for Accordion Logic (Single Expanded Item)
    const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [pendingMutation, setPendingMutation] = useState(false);

    // NumericInputPopover state
    const [popover, setPopover] = useState<{
        isOpen: boolean;
        habitId: string;
        initialValue: number;
        unit?: string;
        position: { top: number; left: number };
    }>({ isOpen: false, habitId: '', initialValue: 0, position: { top: 0, left: 0 } });

    // Initial Collapse Logic: If all done (and not empty), collapse.
    useEffect(() => {
        if (allDone && habits.length > 0) {
            setIsCollapsed(true);
        } else {
            setIsCollapsed(false);
        }
    }, [allDone, habits.length]);

    if (habits.length === 0) return null;

    const handleNumericClick = (e: React.MouseEvent, habit: Habit) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const status = habitStatusMap.get(habit.id);
        setPopover({
            isOpen: true,
            habitId: habit.id,
            initialValue: status?.currentValue ?? 0,
            unit: habit.goal?.unit,
            position: { top: rect.bottom + 4, left: rect.left }
        });
    };

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                    {sortedHabits.map(habit => {
                        // Get status from truthQuery dayView
                        const status = habitStatusMap.get(habit.id);
                        const isCompleted = status?.isComplete ?? false;

                        // If bundle, resolve children and their statuses
                        let subHabits: Habit[] | undefined;
                        let subHabitStatuses: Map<string, boolean> | undefined;
                        if (habit.type === 'bundle' && habit.subHabitIds) {
                            subHabits = habit.subHabitIds
                                .map(id => allHabitsLookup.get(id))
                                .filter((h): h is Habit => !!h);
                            subHabitStatuses = new Map();
                            subHabits.forEach(sub => {
                                const subStatus = habitStatusMap.get(sub.id);
                                subHabitStatuses!.set(sub.id, subStatus?.isComplete ?? false);
                            });
                        }

                        // Choice Bundle: track ALL completed children (multi-select)
                        let selectedChoices: Set<string> | undefined;
                        if (habit.type === 'bundle' && habit.bundleType === 'choice' && subHabits) {
                            const completed = subHabits
                                .filter(sub => habitStatusMap.get(sub.id)?.isComplete)
                                .map(sub => sub.id);
                            if (completed.length > 0) {
                                selectedChoices = new Set(completed);
                            }
                        }

                        return (
                            <HabitGridCell
                                key={habit.id}
                                habit={habit}
                                log={undefined}
                                isCompleted={isCompleted}
                                isExpanded={expandedHabitId === habit.id}
                                onToggle={() => onToggle(habit.id)}
                                onExpand={() => setExpandedHabitId(prev => prev === habit.id ? null : habit.id)}
                                onPin={onPin}
                                onMoveToCategory={onMoveToCategory}
                                subHabits={subHabits}
                                subHabitStatuses={subHabitStatuses}
                                habitStatus={status}
                                onSubHabitToggle={async (subHabitId) => {
                                    if (pendingMutation) return;
                                    setPendingMutation(true);
                                    try { await onToggle(subHabitId); } finally { setPendingMutation(false); }
                                }}
                                onNumericClick={(e) => handleNumericClick(e, habit)}

                                // Choice bundle: toggle individual children (multi-select)
                                selectedChoices={selectedChoices}
                                onChoiceSelect={async (optionKey) => {
                                    if (pendingMutation) return;
                                    setPendingMutation(true);
                                    try {
                                        if (selectedChoices?.has(optionKey)) {
                                            await deleteHabitEntryByKey(optionKey, dateStr);
                                        } else {
                                            await onToggle(optionKey);
                                        }
                                    } finally { setPendingMutation(false); }
                                }}
                            />
                        );
                    })}
                </div>
            )}

            {/* Numeric Input Popover */}
            <NumericInputPopover
                isOpen={popover.isOpen}
                onClose={() => setPopover(prev => ({ ...prev, isOpen: false }))}
                onSubmit={async (value) => {
                    await onUpdateHabitEntry(popover.habitId, dateStr, { value, source: 'manual' });
                }}
                onClear={async () => {
                    await deleteHabitEntryByKey(popover.habitId, dateStr);
                }}
                initialValue={popover.initialValue}
                unit={popover.unit}
                position={popover.position}
            />
        </div>
    );
};
