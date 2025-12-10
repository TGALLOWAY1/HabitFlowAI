import React, { useMemo, useState } from 'react';
import { format, eachDayOfInterval, subDays, isToday, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import type { Habit, DayLog } from '../types';
import { cn } from '../utils/cn';
import { Check, Plus, Trash2, GripVertical, Pencil, Trophy } from 'lucide-react';
import { NumericInputPopover } from './NumericInputPopover';
import { useHabitStore } from '../store/HabitContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TrackerGridProps {
    habits: Habit[];
    logs: Record<string, DayLog>;
    onToggle: (habitId: string, date: string) => Promise<void>;
    onUpdateValue: (habitId: string, date: string, value: number) => Promise<void>;
    onAddHabit: () => void;
    onEditHabit: (habit: Habit) => void;
}

// --- Shared Components ---

const HabitActionButtons = ({
    habit,
    onEdit,
    onDelete,
    deleteConfirmId,
    setDeleteConfirmId
}: {
    habit: Habit,
    onEdit: () => void,
    onDelete: (id: string) => Promise<void>,
    deleteConfirmId: string | null,
    setDeleteConfirmId: (id: string | null) => void
}) => (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <button
            onClick={(e) => {
                e.stopPropagation();
                onEdit();
            }}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
            title="Edit Habit"
        >
            <Pencil size={14} />
        </button>
        <button
            onClick={async (e) => {
                e.stopPropagation();
                if (deleteConfirmId === habit.id) {
                    try {
                        await onDelete(habit.id);
                        setDeleteConfirmId(null);
                    } catch (error) {
                        console.error('Failed to delete habit:', error);
                    }
                } else {
                    setDeleteConfirmId(habit.id);
                    setTimeout(() => setDeleteConfirmId(null), 5000);
                }
            }}
            className={cn(
                "p-1.5 rounded-lg transition-all",
                deleteConfirmId === habit.id
                    ? "bg-red-500/20 text-red-400 opacity-100"
                    : "hover:bg-neutral-800 text-neutral-500 hover:text-red-400"
            )}
            title={deleteConfirmId === habit.id ? "Click again to delete" : "Delete Habit"}
        >
            <Trash2 size={14} />
        </button>
    </div>
);

// --- Daily Habit Row ---

const SortableHabitRow = ({
    habit,
    logs,
    dates,
    handleCellClick,
    deleteHabit,
    deleteConfirmId,
    setDeleteConfirmId,
    onEditHabit
}: {
    habit: Habit;
    logs: Record<string, DayLog>;
    dates: Date[];
    handleCellClick: (e: React.MouseEvent, habit: Habit, dateStr: string, log?: DayLog) => void;
    deleteHabit: (id: string) => Promise<void>;
    deleteConfirmId: string | null;
    setDeleteConfirmId: (id: string | null) => void;
    onEditHabit: (habit: Habit) => void;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: habit.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: isDragging ? 'relative' as const : undefined,
    };

    // Non-Negotiable Logic
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const todayLog = logs[`${habit.id}-${todayStr}`];
    const isCompletedToday = todayLog?.completed;

    const isNonNegotiableToday = useMemo(() => {
        if (!habit.nonNegotiable) return false;
        if (!habit.nonNegotiableDays || habit.nonNegotiableDays.length === 0) return true; // All days if not specified
        return habit.nonNegotiableDays.includes(today.getDay());
    }, [habit.nonNegotiable, habit.nonNegotiableDays]);

    const priorityRingClass = isNonNegotiableToday
        ? isCompletedToday
            ? "ring-1 ring-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]" // Completed: Solid Gold
            : "ring-1 ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse" // Active: Pulsing
        : "";

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex border-b border-white/5 transition-colors group bg-neutral-900/50",
                isDragging && "shadow-xl ring-1 ring-emerald-500/50 z-50 bg-neutral-900",
                priorityRingClass
            )}
        >
            <div className="w-64 flex-shrink-0 p-4 border-r border-white/5 flex items-center justify-between group-hover:bg-white/[0.02] transition-colors relative">
                <div className="flex items-center gap-3">
                    <button
                        {...attributes}
                        {...listeners}
                        className="text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing p-1 -ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Drag to reorder"
                    >
                        <GripVertical size={16} />
                    </button>

                    <div className="flex flex-col">
                        <span className="font-medium text-neutral-200">{habit.name}</span>
                        {habit.goal.target && (
                            <span className="text-xs text-neutral-500 mt-1">
                                Goal: {habit.goal.target} {habit.goal.unit}
                            </span>
                        )}
                    </div>
                </div>

                <HabitActionButtons
                    habit={habit}
                    onEdit={() => onEditHabit(habit)}
                    onDelete={deleteHabit}
                    deleteConfirmId={deleteConfirmId}
                    setDeleteConfirmId={setDeleteConfirmId}
                />
            </div>

            <div className="flex">
                {dates.map((date) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const log = logs[`${habit.id}-${dateStr}`];
                    const isCompleted = log?.completed;

                    return (
                        <div
                            key={dateStr}
                            className="w-16 flex-shrink-0 border-r border-white/5 flex items-center justify-center p-2"
                        >
                            <button
                                onClick={(e) => handleCellClick(e, habit, dateStr, log)}
                                className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
                                    isCompleted
                                        ? habit.nonNegotiable
                                            ? "bg-yellow-500 text-neutral-900 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-gold-burst"
                                            : "bg-emerald-500 text-neutral-900 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-90"
                                        : "bg-neutral-800/50 text-transparent hover:bg-neutral-800 hover:text-neutral-600 border border-white/5 hover:border-white/10"
                                )}
                            >
                                {habit.goal.type === 'number' && log?.value ? (
                                    <span className="text-xs font-bold">{log.value}</span>
                                ) : (
                                    <Check size={20} strokeWidth={3} className={cn("transition-transform duration-200", isCompleted ? "scale-100" : "scale-50")} />
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Weekly Habit Row ---

const SortableWeeklyHabitRow = ({
    habit,
    logs,
    onToggleToday,
    deleteHabit,
    deleteConfirmId,
    setDeleteConfirmId,
    onEditHabit
}: {
    habit: Habit;
    logs: Record<string, DayLog>; // All logs passed in, we filter inside
    onToggleToday: (habit: Habit) => void;
    deleteHabit: (id: string) => Promise<void>;
    deleteConfirmId: string | null;
    setDeleteConfirmId: (id: string | null) => void;
    onEditHabit: (habit: Habit) => void;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: habit.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: isDragging ? 'relative' as const : undefined,
    };

    // Calculate Weekly Progress
    const { currentCount, target, isCompletedToday } = useMemo(() => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
        const end = endOfWeek(today, { weekStartsOn: 1 });

        let count = 0;
        let completedToday = false;
        const todayStr = format(today, 'yyyy-MM-dd');

        // Iterate logs to find matches for this habit in range
        Object.values(logs).forEach(log => {
            if (log.habitId === habit.id) {
                const logDate = parseISO(log.date);
                if (isWithinInterval(logDate, { start, end }) && log.completed) {
                    count++;
                }
                if (log.date === todayStr && log.completed) {
                    completedToday = true;
                }
            }
        });

        return {
            currentCount: count,
            target: habit.goal.target || 3, // Default fallback
            isCompletedToday: completedToday
        };
    }, [habit.id, habit.goal.target, logs]);

    const priorityRingClass = habit.nonNegotiable
        ? isCompletedToday
            ? "ring-1 ring-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
            : "ring-1 ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse"
        : "";

    return (
        <div
            ref={setNodeRef}
            style={style}
            // Use flex row layout similar to SortableHabitRow instead of padding wrapper
            className={cn(
                "flex border-b border-white/5 transition-colors group bg-neutral-900/50 hover:bg-white/[0.02]",
                isDragging && "shadow-xl ring-1 ring-emerald-500/50 z-50 bg-neutral-900",
                priorityRingClass
            )}
        >
            {/* Sidebar: Matches Daily Row width and layout */}
            <div className="w-64 flex-shrink-0 p-4 border-r border-white/5 flex items-center justify-between relative">
                <div className="flex items-center gap-3">
                    <button
                        {...attributes}
                        {...listeners}
                        className="text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing p-1 -ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Drag to reorder"
                    >
                        <GripVertical size={16} />
                    </button>

                    <div className="flex flex-col">
                        <span className="font-medium text-neutral-200">{habit.name}</span>
                        <span className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
                            Weekly Goal: {currentCount} / {target}
                            {currentCount >= target && <Trophy size={12} className="text-yellow-500" />}
                        </span>
                    </div>
                </div>

                <HabitActionButtons
                    habit={habit}
                    onEdit={() => onEditHabit(habit)}
                    onDelete={deleteHabit}
                    deleteConfirmId={deleteConfirmId}
                    setDeleteConfirmId={setDeleteConfirmId}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex items-center justify-between p-4">
                {/* Progress Visuals (Circles) */}
                <div className="flex items-center gap-1">
                    {Array.from({ length: target }).map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-3 h-3 rounded-full transition-all",
                                i < currentCount
                                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                    : "bg-neutral-800 border border-white/10"
                            )}
                        />
                    ))}
                </div>

                {/* Mark Done Button */}
                <button
                    onClick={() => onToggleToday(habit)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                        isCompletedToday
                            ? habit.nonNegotiable
                                ? "bg-yellow-500 text-neutral-900 shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-gold-burst"
                                : "bg-emerald-500 text-neutral-900 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 border border-white/5"
                    )}
                >
                    {isCompletedToday ? (
                        <>
                            <Check size={18} strokeWidth={2.5} />
                            <span>Done Today</span>
                        </>
                    ) : (
                        <>
                            <div className="w-4 h-4 rounded-full border-2 border-current" />
                            <span>Mark Done</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};


export const TrackerGrid: React.FC<TrackerGridProps> = ({ habits, logs, onToggle, onUpdateValue, onAddHabit, onEditHabit }) => {
    const { deleteHabit, reorderHabits } = useHabitStore();
    const [popoverState, setPopoverState] = useState<{
        isOpen: boolean;
        habitId: string;
        date: string;
        initialValue: number;
        unit?: string;
        position: { top: number; left: number };
    }>({
        isOpen: false,
        habitId: '',
        date: '',
        initialValue: 0,
        position: { top: 0, left: 0 },
    });

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Initial Split
    const dailyHabits = useMemo(() => habits.filter(h => h.goal.frequency === 'daily'), [habits]);
    const weeklyHabits = useMemo(() => habits.filter(h => h.goal.frequency === 'weekly'), [habits]);

    // Generate dates: Today + Last 13 days (Reverse Chronological)
    const dates = useMemo(() => {
        const today = new Date();
        const interval = eachDayOfInterval({
            start: subDays(today, 13),
            end: today,
        });
        return interval.reverse(); // Show Today first, then Yesterday, etc.
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Must drag 8px to start, allows clicking
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        // Try to find in daily list
        const oldDailyIndex = dailyHabits.findIndex(h => h.id === active.id);
        const newDailyIndex = dailyHabits.findIndex(h => h.id === over.id);

        if (oldDailyIndex !== -1 && newDailyIndex !== -1) {
            // Reordering Daily
            const newOrder = arrayMove(dailyHabits, oldDailyIndex, newDailyIndex).map(h => h.id);
            // We need to preserve the relative order of weekly habits in the global list ideally,
            // OR just send the IDs of the daily block reordered + weekly block.
            // The backend takes a list of IDs and sets indices [0..N].
            // So we should construct the full list: [...newDaily, ...weekly] (or whatever the global visual order is).
            // Current rendering: Daily Block then Weekly Block.
            const fullListIds = [...newOrder, ...weeklyHabits.map(h => h.id)];
            reorderHabits(fullListIds);
            return;
        }

        // Try find in weekly list
        const oldWeeklyIndex = weeklyHabits.findIndex(h => h.id === active.id);
        const newWeeklyIndex = weeklyHabits.findIndex(h => h.id === over.id);

        if (oldWeeklyIndex !== -1 && newWeeklyIndex !== -1) {
            // Reordering Weekly
            const newOrder = arrayMove(weeklyHabits, oldWeeklyIndex, newWeeklyIndex).map(h => h.id);
            // Full list: [...daily, ...newWeekly]
            const fullListIds = [...dailyHabits.map(h => h.id), ...newOrder];
            reorderHabits(fullListIds);
            return;
        }
    };

    const handleCellClick = (e: React.MouseEvent, habit: Habit, dateStr: string, log?: DayLog) => {
        if (habit.goal.type === 'number') {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPopoverState({
                isOpen: true,
                habitId: habit.id,
                date: dateStr,
                initialValue: log?.value || 0,
                unit: habit.goal.unit,
                position: { top: rect.bottom + 8, left: rect.left - 40 }, // Center-ish alignment
            });
        } else {
            onToggle(habit.id, dateStr).catch(error => {
                console.error('Failed to toggle habit:', error);
            });
        }
    };

    const handleToggleToday = (habit: Habit) => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        onToggle(habit.id, todayStr);
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-neutral-900/50 rounded-2xl border border-white/5 backdrop-blur-sm shadow-2xl relative">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                    {/* --- Daily Habits Section --- */}
                    <div className="flex flex-col border-b border-white/5 last:border-0 h-fit">
                        {/* Header Row - Sticky */}
                        <div className="sticky top-0 z-20 flex border-b border-white/5 bg-neutral-900 shadow-md">
                            <div className="w-64 flex-shrink-0 p-4 font-medium text-emerald-400 border-r border-white/5 flex items-center justify-between bg-neutral-900 group">
                                <span>Daily Habits</span>
                                <button
                                    onClick={onAddHabit}
                                    className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-emerald-400 transition-colors"
                                    title="Add New Habit"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                            <div className="flex overflow-x-auto scrollbar-hide bg-neutral-900">
                                {dates.map((date) => (
                                    <div
                                        key={date.toISOString()}
                                        className={cn(
                                            "w-16 flex-shrink-0 flex flex-col items-center justify-center p-2 border-r border-white/5 transition-colors",
                                            isToday(date) ? "bg-emerald-500/10 text-emerald-400" : "text-neutral-500"
                                        )}
                                    >
                                        <span className="text-xs font-medium uppercase">{format(date, 'EEE')}</span>
                                        <span className={cn(
                                            "text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full mt-1",
                                            isToday(date) && "bg-emerald-500 text-neutral-900"
                                        )}>
                                            {format(date, 'd')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Daily Rows */}
                        <div className="flex-col">
                            {dailyHabits.length > 0 ? (
                                <SortableContext
                                    items={dailyHabits.map(h => h.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {dailyHabits.map((habit) => (
                                        <SortableHabitRow
                                            key={habit.id}
                                            habit={habit}
                                            logs={logs}
                                            dates={dates}
                                            handleCellClick={handleCellClick}
                                            deleteHabit={deleteHabit}
                                            deleteConfirmId={deleteConfirmId}
                                            setDeleteConfirmId={setDeleteConfirmId}
                                            onEditHabit={onEditHabit}
                                        />
                                    ))}
                                </SortableContext>
                            ) : (
                                <div className="p-8 text-center text-neutral-500 text-sm italic">
                                    No daily habits yet. Click the + button to add one.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- Weekly Habits Section --- */}
                    {weeklyHabits.length > 0 && (
                        <div className="flex flex-col border-b border-white/5 last:border-0 h-fit">
                            <div className="sticky top-0 z-10 bg-neutral-900/95 p-4 border-b border-white/5 backdrop-blur-sm">
                                <h3 className="font-medium text-emerald-400 flex items-center gap-2">
                                    <span>Weekly Habits</span>
                                    <span className="text-xs text-neutral-500 font-normal ml-2">(Resets every Monday)</span>
                                </h3>
                            </div>
                            <div className="flex-col">
                                <SortableContext
                                    items={weeklyHabits.map(h => h.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {weeklyHabits.map((habit) => (
                                        <SortableWeeklyHabitRow
                                            key={habit.id}
                                            habit={habit}
                                            logs={logs}
                                            onToggleToday={handleToggleToday}
                                            deleteHabit={deleteHabit}
                                            deleteConfirmId={deleteConfirmId}
                                            setDeleteConfirmId={setDeleteConfirmId}
                                            onEditHabit={onEditHabit}
                                        />
                                    ))}
                                </SortableContext>
                            </div>
                        </div>
                    )}
                </div>
            </DndContext>

            <NumericInputPopover
                isOpen={popoverState.isOpen}
                onClose={() => setPopoverState(prev => ({ ...prev, isOpen: false }))}
                onSubmit={async (val) => {
                    try {
                        await onUpdateValue(popoverState.habitId, popoverState.date, val);
                        setPopoverState(prev => ({ ...prev, isOpen: false }));
                    } catch (error) {
                        console.error('Failed to update log:', error);
                        setPopoverState(prev => ({ ...prev, isOpen: false }));
                    }
                }}
                initialValue={popoverState.initialValue}
                unit={popoverState.unit}
                position={popoverState.position}
            />
        </div>
    );
};
