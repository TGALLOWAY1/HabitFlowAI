import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { Category, Habit, DayLog } from '../../types';
import { HabitGridCell } from './HabitGridCell';
import { cn } from '../../utils/cn';

interface DayCategorySectionProps {
    category: Category;
    habits: Habit[]; // Just the habits (roots) for this category
    logs: Record<string, DayLog>;
    dateStr: string;
    onToggle: (habitId: string) => void;
    onPin: (habitId: string) => void;
    onUpdateEstimate: (habitId: string, minutes: number) => void;

    // Pass entire habits list to resolve subHabits if needed?
    // Or simpler: We expect `habits` to be the *root* habits to display.
    // If a habit is a bundle, we need to be able to find its children.
    // Let's assume the parent `DayView` passes a lookup or we use context?
    // Passing allHabits is safest for bundle resolution.
    allHabitsLookup: Map<string, Habit>;

    // Choice bundle selection
    onUpdateHabitEntry: (habitId: string, dateKey: string, data: any) => Promise<void>;
    deleteHabitEntryByKey: (habitId: string, dateKey: string) => Promise<void>;
}

export const DayCategorySection = ({
    category,
    habits,
    logs,
    dateStr,
    onToggle,
    onPin,
    onUpdateEstimate,
    allHabitsLookup,
    onUpdateHabitEntry,
    deleteHabitEntryByKey
}: DayCategorySectionProps) => { // Removed unused logs prop
    // Sort habits by order
    const sortedHabits = useMemo(() => {
        return [...habits].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    }, [habits]);

    // Compute completion status for default collapse
    const { allDone, completedCount } = useMemo(() => {
        if (habits.length === 0) return { allDone: true, completedCount: 0 };

        let done = 0;
        habits.forEach(h => {
            // Basic boolean/bundle check
            // For bundles, we check if the parent feels "done" or if logged as done.
            // DayLog usually tracks parent completion for bundles too (computed).
            const log = logs[`${h.id}-${dateStr}`];
            if (log?.completed) done++;
        });

        return { allDone: done === habits.length, completedCount: done };
    }, [habits, logs, dateStr]);

    // State for Accordion Logic (Single Expanded Item)
    const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Initial Collapse Logic: If all done (and not empty), collapse.
    // We use a ref to only trigger this on mount or significant data changes? 
    // Actually, sticky user preference is better, but PRD says "Default expansion: Expanded if category has ≥1 incomplete".
    // So distinct state that syncs with "allDone" changes? 
    useEffect(() => {
        if (allDone && habits.length > 0) {
            setIsCollapsed(true);
        } else {
            setIsCollapsed(false);
        }
    }, [allDone, habits.length]); // Dependency on allDone means it auto-collapses when finished.

    if (habits.length === 0) return null;

    return (
        <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-2 mb-3 px-1 w-full text-left group transition-opacity hover:opacity-80"
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
                {!allDone && completedCount > 0 && (
                    <span className="ml-auto text-xs text-neutral-600">
                        {completedCount}/{habits.length}
                    </span>
                )}
            </button>

            {/* Content - GRID LAYOUT */}
            {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                    {sortedHabits.map(habit => {
                        const log = logs[`${habit.id}-${dateStr}`];
                        // If bundle, resolve children
                        let subHabits: Habit[] | undefined;
                        if (habit.type === 'bundle' && habit.subHabitIds) {
                            subHabits = habit.subHabitIds
                                .map(id => allHabitsLookup.get(id))
                                .filter((h): h is Habit => !!h);
                        }

                        // Choice Bundle Selection
                        const selectedChoice = log?.bundleOptionId;

                        return (
                            <HabitGridCell
                                key={habit.id}
                                habit={habit}
                                log={log}
                                isCompleted={!!log?.completed}
                                isExpanded={expandedHabitId === habit.id}
                                onToggle={() => onToggle(habit.id)}
                                onExpand={() => setExpandedHabitId(prev => prev === habit.id ? null : habit.id)}
                                onPin={onPin}
                                onUpdateEstimate={onUpdateEstimate}
                                subHabits={subHabits}

                                // Helper for choice select
                                selectedChoice={selectedChoice}
                                onChoiceSelect={(optionKey) => {
                                    if (selectedChoice === optionKey) {
                                        // Deselect
                                        deleteHabitEntryByKey(habit.id, dateStr);
                                    } else {
                                        // Select (Upsert)
                                        // We need to save 'bundleOptionId' in the entry.
                                        // Assuming upsertHabitEntryContext allows passing extra data object?
                                        // HabitContext.upsertHabitEntry signature: (habitId, dateKey, data?)
                                        onUpdateHabitEntry(habit.id, dateStr, {
                                            bundleOptionId: optionKey,
                                            value: 1, // Considered "done"
                                            source: 'manual'
                                        });
                                    }
                                }}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};
