import React, { useMemo, useState } from 'react';
import { format, eachDayOfInterval, subDays, isToday, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { type Habit, type DayLog, type Routine } from '../types';
import { cn } from '../utils/cn';
import { Check, Plus, Trash2, GripVertical, Pencil, Trophy, Play } from 'lucide-react';
import { NumericInputPopover } from './NumericInputPopover';
import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { computeBundleStatus, getBundleStats } from '../utils/habitUtils';
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
    onRunRoutine?: (routine: Routine) => void;
}

// --- Shared Components ---

const HabitActionButtons = ({
    habit,
    onEdit,
    onDelete,
    deleteConfirmId,
    setDeleteConfirmId,
    onRunRoutine
}: {
    habit: Habit,
    onEdit: () => void,
    onDelete: (id: string) => Promise<void>,
    deleteConfirmId: string | null,
    setDeleteConfirmId: (id: string | null) => void,
    onRunRoutine?: (routine: Routine) => void
}) => {
    const { routines } = useRoutineStore();
    const linkedRoutines = routines.filter(r => r.linkedHabitIds?.includes(habit.id));

    return (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            {linkedRoutines.length > 0 && onRunRoutine && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRunRoutine(linkedRoutines[0]);
                    }}
                    className="p-1.5 rounded-lg hover:bg-neutral-800 text-emerald-500 hover:text-emerald-400 transition-colors"
                    title={`Run Routine: ${linkedRoutines[0].title}`}
                >
                    <Play size={14} />
                </button>
            )}
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
};

// --- Daily Habit Row ---

interface HabitRowContentProps {
    habit: Habit;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    onToggleExpand: () => void;
    logs: Record<string, DayLog>;
    dates: Date[];
    handleCellClick: (e: React.MouseEvent, habit: Habit, dateStr: string, log?: DayLog) => void;
    deleteHabit: (id: string) => Promise<void>;
    deleteConfirmId: string | null;
    setDeleteConfirmId: (id: string | null) => void;
    onEditHabit: (habit: Habit) => void;
    // Drag & Drop props (optional, only for root)
    attributes?: any;
    listeners?: any;
    isDragging?: boolean;
    setNodeRef?: (node: HTMLElement | null) => void;
    style?: React.CSSProperties;
    // Computed status for bundles
    bundleStatus?: { completed: boolean; value: number };
    onToggle: (habitId: string, date: string) => Promise<void>;
    onRunRoutine?: (routine: Routine) => void;
}

const HabitRowContent = ({
    habit,
    depth,
    isExpanded,
    hasChildren,
    onToggleExpand,
    logs,
    dates,
    handleCellClick,
    deleteHabit,
    deleteConfirmId,
    setDeleteConfirmId,
    onEditHabit,
    attributes,
    listeners,
    isDragging,
    setNodeRef,
    style,
    bundleStatus,
    onToggle,
    onRunRoutine
}: HabitRowContentProps) => {

    // Non-Negotiable Logic
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const todayLog = logs[`${habit.id}-${todayStr}`];

    // For bundles, we use the computed status if provided, otherwise the log status
    const isCompletedToday = bundleStatus ? bundleStatus.completed : todayLog?.completed;

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

    // const indentClass = depth > 0 ? `ml-${depth * 6}` : ""; // Tailwind arbitrary values or standard spacing? using padding style is safer.

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
            <div
                className="w-64 flex-shrink-0 p-4 border-r border-white/5 flex items-center justify-between group-hover:bg-white/[0.02] transition-colors relative"
                style={{ paddingLeft: `${16 + (depth * 24)}px` }} // Dynamic Indentation
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {/* Drag Handle (Only for depth 0) */}
                    {depth === 0 && (
                        <button
                            {...attributes}
                            {...listeners}
                            className="text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing p-1 -ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            title="Drag to reorder"
                        >
                            <GripVertical size={16} />
                        </button>
                    )}

                    <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    "font-medium truncate transition-colors",
                                    depth > 0 ? "text-neutral-400 italic text-sm" : "text-neutral-200"
                                )}
                                title={habit.name}
                            >
                                {habit.name}
                            </span>
                            {/* Expand/Collapse Toggle Removed */}
                            {/* {hasChildren && ( ... )} */}
                        </div>
                        {habit.goal.type === 'number' && habit.goal.target && (
                            <span className="text-xs text-neutral-500 mt-1 truncate">
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
                    onRunRoutine={onRunRoutine}
                />

                {/* Bundle Expand/Collapse "Drawer Handle" */}
                {hasChildren && (
                    <div
                        className="absolute bottom-0 left-0 right-0 h-[6px] cursor-pointer hover:bg-white/[0.03] transition-colors flex items-end justify-center pb-[2px] z-10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand();
                        }}
                        title={isExpanded ? "Click to Collapse Bundle" : "Click to Expand Bundle"}
                    >
                        <div
                            className={cn(
                                "w-12 h-1 rounded-full transition-all duration-300",
                                isExpanded
                                    ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                    : "bg-neutral-700 hover:bg-blue-400"
                            )}
                        />
                    </div>
                )}
            </div>

            <div className="flex">
                {dates.map((date) => {
                    const dateStr = format(date, 'yyyy-MM-dd');

                    // Logic:
                    // If bundle, current status is computed from children.
                    // If regular habit, status is from logs.
                    let isCompleted = false;
                    let hasValue = false;
                    let value = 0;
                    let log = logs[`${habit.id}-${dateStr}`];

                    if (habit.type === 'bundle' && hasChildren) {
                        const status = computeBundleStatus(habit, logs, dateStr);
                        isCompleted = status.completed;
                        value = status.value;
                        hasValue = value > 0;
                    } else {
                        isCompleted = log?.completed || false;
                        hasValue = habit.goal.type === 'number' && typeof log?.value === 'number' && log.value > 0;
                        value = log?.value || 0;
                    }

                    const isPartial = hasValue && !isCompleted;

                    const isInteractive = true; // Bundles are now interactive

                    // Bundle Click Handler
                    const handleBundleClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (habit.type !== 'bundle') return;

                        const stats = getBundleStats(habit, logs, dateStr);
                        const childrenToToggle = habit.subHabitIds || [];
                        const allDone = stats.isAllDone;

                        // Toggle Logic: If ALL done, clear all. Else, complete remaining.
                        childrenToToggle.forEach(childId => {
                            const childLog = logs[`${childId}-${dateStr}`];
                            const isChildDone = childLog?.completed;

                            if (allDone) {
                                // Turn OFF if on
                                if (isChildDone) onToggle(childId, dateStr);
                            } else {
                                // Turn ON if off
                                if (!isChildDone) onToggle(childId, dateStr);
                            }
                        });
                    };

                    return (
                        <div
                            key={dateStr}
                            className="w-16 flex-shrink-0 border-r border-white/5 flex items-center justify-center p-2"
                        >
                            <button
                                onClick={habit.type === 'bundle' ? handleBundleClick : (isInteractive ? (e) => handleCellClick(e, habit, dateStr, log) : undefined)}
                                onDoubleClick={isInteractive ? (e) => handleCellClick(e, habit, dateStr, log) : undefined}
                                disabled={!isInteractive}
                                className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 relative overflow-hidden",
                                    habit.type === 'bundle'
                                        ? "bg-neutral-800 border border-white/5 hover:bg-neutral-700 text-neutral-200"
                                        : isCompleted
                                            ? habit.nonNegotiable
                                                ? "bg-yellow-500 text-neutral-900 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-gold-burst"
                                                : "bg-emerald-500 text-neutral-900 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-90"
                                            : isPartial
                                                ? "bg-blue-500 text-neutral-900 shadow-[0_0_15px_rgba(59,130,246,0.4)] scale-95" // Partial
                                                : "bg-neutral-800/50 text-transparent hover:bg-neutral-800 hover:text-neutral-600 border border-white/5 hover:border-white/10",
                                    !isInteractive && isCompleted && "opacity-80 cursor-default",
                                    !isInteractive && "cursor-default hover:bg-neutral-800/50 hover:text-transparent"
                                )}
                                title={habit.type === 'bundle' ? "Click to toggle all sub-habits" : (!isInteractive ? "Derived from sub-habits" : undefined)}
                            >
                                {habit.type === 'bundle' ? (
                                    <>
                                        {/* Bundle Progress Background */}
                                        <div
                                            className="absolute inset-0 bg-emerald-500/20 transition-all duration-500 pointer-events-none"
                                            style={{
                                                height: `${getBundleStats(habit, logs, dateStr).percent}%`,
                                                bottom: 0,
                                                top: 'auto'
                                            }}
                                        />
                                        {/* Bundle Content */}
                                        <span className="relative z-10 text-[10px] font-bold leading-tight flex flex-col items-center">
                                            {getBundleStats(habit, logs, dateStr).isAllDone ? (
                                                <Check size={18} strokeWidth={3} className="text-emerald-500" />
                                            ) : (
                                                getBundleStats(habit, logs, dateStr).completed > 0 ? (
                                                    <>
                                                        <span>{getBundleStats(habit, logs, dateStr).completed}</span>
                                                        <span className="w-full h-[1px] bg-neutral-500/50 my-[1px]" />
                                                        <span>{getBundleStats(habit, logs, dateStr).total}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-neutral-600 opacity-0 hover:opacity-100 transition-opacity text-xs">+</span>
                                                )
                                            )}
                                        </span>
                                    </>
                                ) : (
                                    habit.goal.type === 'number' && value > 0 ? (
                                        <span className="text-xs font-bold">{value}</span>
                                    ) : (
                                        <Check size={20} strokeWidth={3} className={cn("transition-transform duration-200", isCompleted ? "scale-100" : "scale-50")} />
                                    )
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SortableHabitRow = ({
    habit,
    allHabits,
    expandedIds,
    onToggleExpand,
    logs,
    dates,
    handleCellClick,
    deleteHabit,
    deleteConfirmId,
    setDeleteConfirmId,
    onEditHabit,
    onToggle,
    onRunRoutine
}: {
    habit: Habit;
    allHabits: Habit[];
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    logs: Record<string, DayLog>;
    dates: Date[];
    handleCellClick: (e: React.MouseEvent, habit: Habit, dateStr: string, log?: DayLog) => void;
    deleteHabit: (id: string) => Promise<void>;
    deleteConfirmId: string | null;
    setDeleteConfirmId: (id: string | null) => void;
    onEditHabit: (habit: Habit) => void;
    onToggle: (habitId: string, date: string) => Promise<void>;
    onRunRoutine?: (routine: Routine) => void;
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

    // Find children
    const children = useMemo(() => {
        if (habit.type !== 'bundle' || !habit.subHabitIds) return [];
        // Map IDs to habit objects, preserving order
        return habit.subHabitIds
            .map(id => allHabits.find(h => h.id === id))
            .filter((h): h is Habit => !!h);
    }, [habit, allHabits]);

    // DEBUG LOG
    if (habit.type === 'bundle') {
        console.log(`[SortableHabitRow] Bundle: ${habit.name} (${habit.id})`);
        console.log(`  - subHabitIds:`, habit.subHabitIds);
        console.log(`  - Resolved Children:`, children.length);
        if (habit.subHabitIds && children.length !== habit.subHabitIds.length) {
            console.warn(`  - MISMATCH: Expected ${habit.subHabitIds.length} children but found ${children.length}. Missing IDs?`);
            habit.subHabitIds.forEach(id => {
                if (!allHabits.find(h => h.id === id)) console.warn(`    - Missing Child ID: ${id}`);
            });
        }
    }

    const isExpanded = expandedIds.has(habit.id);
    const hasChildren = children.length > 0;

    return (
        <div className="flex flex-col">
            {/* Parent Row - Draggable/Sortable */}
            <HabitRowContent
                habit={habit}
                depth={0}
                isExpanded={isExpanded}
                hasChildren={hasChildren}
                onToggleExpand={() => onToggleExpand(habit.id)}
                logs={logs}
                dates={dates}
                handleCellClick={handleCellClick}
                deleteHabit={deleteHabit}
                deleteConfirmId={deleteConfirmId}
                setDeleteConfirmId={setDeleteConfirmId}
                onEditHabit={onEditHabit}
                // Drag props
                attributes={attributes}
                listeners={listeners}
                isDragging={isDragging}
                setNodeRef={setNodeRef}
                style={style}
                onToggle={onToggle}
                onRunRoutine={onRunRoutine}
            />

            {/* Child Rows - Rendered when expanded */}
            {isExpanded && children.map(child => (
                <HabitRowContent
                    key={child.id}
                    habit={child}
                    depth={1}
                    isExpanded={false}
                    hasChildren={false} // Assume 1 level for MVP
                    onToggleExpand={() => { }}
                    logs={logs}
                    dates={dates}
                    handleCellClick={handleCellClick}
                    deleteHabit={deleteHabit}
                    deleteConfirmId={deleteConfirmId}
                    setDeleteConfirmId={setDeleteConfirmId}
                    onEditHabit={onEditHabit}
                    onToggle={onToggle}
                    // No drag props
                    style={{ transition }} // Maintain transition if needed
                    onRunRoutine={onRunRoutine}
                />
            ))}
        </div>
    );
};

// --- Weekly Habit Row ---

interface WeeklyHabitRowContentProps {
    habit: Habit;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    onToggleExpand: () => void;
    logs: Record<string, DayLog>;
    onEditHabit: (habit: Habit) => void;
    deleteHabit: (id: string) => Promise<void>;
    deleteConfirmId: string | null;
    setDeleteConfirmId: (id: string | null) => void;
    onToggleToday: (habit: Habit) => void;
    onOpenPopover: (e: React.MouseEvent, habit: Habit, date: string, currentValue: number) => void;
    // Drag props
    attributes?: any;
    listeners?: any;
    isDragging?: boolean;
    setNodeRef?: (node: HTMLElement | null) => void;
    style?: React.CSSProperties;
    onRunRoutine?: (routine: Routine) => void;
}

const WeeklyHabitRowContent = ({
    habit,
    depth,
    isExpanded,
    hasChildren,
    onToggleExpand,
    logs,
    onEditHabit,
    deleteHabit,
    deleteConfirmId,
    setDeleteConfirmId,
    onToggleToday,
    onOpenPopover,
    attributes,
    listeners,
    isDragging,
    setNodeRef,
    style,
    onRunRoutine
}: WeeklyHabitRowContentProps) => {

    // Calculate Weekly Progress
    const { currentCount, target, isCompletedToday, todayLogValue } = useMemo(() => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
        const end = endOfWeek(today, { weekStartsOn: 1 });

        let count = 0;
        let completedToday = false;
        let todayVal = 0;
        const todayStr = format(today, 'yyyy-MM-dd');
        const isQuantitative = habit.goal.type === 'number';

        // Iterate logs to find matches for this habit in range
        Object.values(logs).forEach(log => {
            if (log.habitId === habit.id) {
                const logDate = parseISO(log.date);
                if (isWithinInterval(logDate, { start, end })) {
                    // For quantitative, sum the values. For boolean, count completed.
                    if (isQuantitative) {
                        count += (log.value || 0);
                    } else if (log.completed) {
                        count++;
                    }
                }
                if (log.date === todayStr) {
                    todayVal = log.value || 0;
                    if (log.completed || (isQuantitative && todayVal > 0)) {
                        completedToday = true;
                    }
                }
            }
        });

        // Current Habit Goal Target logic
        const goalTarget = habit.goal.target || 3;

        return {
            currentCount: count,
            target: goalTarget,
            isCompletedToday: completedToday,
            todayLogValue: todayVal
        };
    }, [habit.id, habit.goal.target, habit.goal.type, logs]);

    const isQuantitative = habit.goal.type === 'number';
    const progressPercent = Math.min(100, Math.max(0, (currentCount / target) * 100));

    const priorityRingClass = habit.nonNegotiable
        ? isCompletedToday
            ? "ring-1 ring-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
            : "ring-1 ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-pulse"
        : "";

    // Indentation Style
    // Using padding for indentation to match Daily Grid
    const indentStyle = { paddingLeft: `${16 + (depth * 24)}px` };

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
            {/* Sidebar: Matches Daily Row width and layout, but with dynamic indentation */}
            <div
                className="w-64 flex-shrink-0 p-4 border-r border-white/5 flex items-center justify-between relative"
                style={indentStyle}
            >
                <div className="flex items-center gap-3">
                    {/* Drag Handle (Only for depth 0) */}
                    {depth === 0 && (
                        <button
                            {...attributes}
                            {...listeners}
                            className="text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing p-1 -ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Drag to reorder"
                        >
                            <GripVertical size={16} />
                        </button>
                    )}

                    <div className="flex flex-col">
                        <span className={cn(
                            "font-medium transition-colors",
                            depth > 0 ? "text-neutral-400 italic text-sm" : "text-neutral-200"
                        )}>
                            {habit.name}
                        </span>
                        <span className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
                            {/* Display e.g. "Weekly Goal: 25 / 50 reps" or "Weekly Goal: 3 / 5" */}
                            Goal: {Math.round(currentCount * 10) / 10} / {target} {habit.goal.unit}
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
                    onRunRoutine={onRunRoutine}
                />

                {/* Bundle Expand/Collapse "Drawer Handle" */}
                {hasChildren && (
                    <div
                        className="absolute bottom-0 left-0 right-0 h-[6px] cursor-pointer hover:bg-white/[0.03] transition-colors flex items-end justify-center pb-[2px] z-10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand();
                        }}
                        title={isExpanded ? "Click to Collapse Bundle" : "Click to Expand Bundle"}
                    >
                        <div
                            className={cn(
                                "w-12 h-1 rounded-full transition-all duration-300",
                                isExpanded
                                    ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                    : "bg-neutral-700 hover:bg-blue-400"
                            )}
                        />
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex items-center justify-between p-4">
                {/* Progress Visuals */}
                <div className="flex items-center gap-1 flex-1 mr-8">
                    {isQuantitative ? (
                        // Progress Bar for Quantitative
                        <div className="w-full h-3 bg-neutral-800 border border-white/10 rounded-full overflow-hidden relative">
                            <div
                                className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-500 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    ) : (
                        // Circles for Boolean
                        Array.from({ length: target }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-3 h-3 rounded-full transition-all",
                                    i < currentCount
                                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                        : "bg-neutral-800 border border-white/10"
                                )}
                            />
                        ))
                    )}
                </div>

                {/* Mark Done / Log Value Button */}
                <button
                    onClick={(e) => {
                        if (isQuantitative) {
                            const todayStr = format(new Date(), 'yyyy-MM-dd');
                            onOpenPopover(e, habit, todayStr, todayLogValue);
                        } else {
                            onToggleToday(habit);
                        }
                    }}
                    className={cn(
                        "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all min-w-[140px]",
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
                            <span>{isQuantitative ? `${todayLogValue} ${habit.goal.unit || ''}` : 'Done Today'}</span>
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


const SortableWeeklyHabitRow = ({
    habit,
    allHabits,
    expandedIds,
    onToggleExpand,
    logs,
    onToggleToday,
    onOpenPopover,
    deleteHabit,
    deleteConfirmId,
    setDeleteConfirmId,
    onEditHabit,
    onRunRoutine
}: {
    habit: Habit;
    allHabits: Habit[];
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    logs: Record<string, DayLog>; // All logs passed in, we filter inside
    onToggleToday: (habit: Habit) => void;
    onOpenPopover: (e: React.MouseEvent, habit: Habit, date: string, currentValue: number) => void;
    deleteHabit: (id: string) => Promise<void>;
    deleteConfirmId: string | null;
    setDeleteConfirmId: (id: string | null) => void;
    onEditHabit: (habit: Habit) => void;
    onRunRoutine?: (routine: Routine) => void;
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

    // Find children
    const children = useMemo(() => {
        if (habit.type !== 'bundle' || !habit.subHabitIds) return [];
        return habit.subHabitIds
            .map(id => allHabits.find(h => h.id === id))
            .filter((h): h is Habit => !!h);
    }, [habit, allHabits]);

    const isExpanded = expandedIds.has(habit.id);
    const hasChildren = children.length > 0;

    return (
        <div className="flex flex-col">
            {/* Parent Row */}
            <WeeklyHabitRowContent
                habit={habit}
                depth={0}
                isExpanded={isExpanded}
                hasChildren={hasChildren}
                onToggleExpand={() => onToggleExpand(habit.id)}
                logs={logs}
                onEditHabit={onEditHabit}
                deleteHabit={deleteHabit}
                deleteConfirmId={deleteConfirmId}
                setDeleteConfirmId={setDeleteConfirmId}
                onToggleToday={onToggleToday}
                onOpenPopover={onOpenPopover}
                // Drag Props
                attributes={attributes}
                listeners={listeners}
                isDragging={isDragging}
                setNodeRef={setNodeRef}
                style={style}
                onRunRoutine={onRunRoutine}
            />

            {/* Child Rows */}
            {isExpanded && children.map(child => (
                <WeeklyHabitRowContent
                    key={child.id}
                    habit={child}
                    depth={1}
                    isExpanded={false}
                    hasChildren={false} // 1 level deep
                    onToggleExpand={() => { }}
                    logs={logs}
                    onEditHabit={onEditHabit}
                    deleteHabit={deleteHabit}
                    deleteConfirmId={deleteConfirmId}
                    setDeleteConfirmId={setDeleteConfirmId}
                    onToggleToday={onToggleToday}
                    onOpenPopover={onOpenPopover}
                    // No drag props
                    style={{ transition }}
                    onRunRoutine={onRunRoutine}
                />
            ))}
        </div>
    );
};

export const TrackerGrid: React.FC<TrackerGridProps> = ({ habits, logs, onToggle, onUpdateValue, onAddHabit, onEditHabit, onRunRoutine }) => {
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
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Filter Roots: Habits that are not children of any bundle
    const rootHabits = useMemo(() => {
        const childIds = new Set<string>();
        habits.forEach(h => {
            if (h.type === 'bundle' && h.subHabitIds) {
                h.subHabitIds.forEach(id => childIds.add(id));
            }
        });
        return habits.filter(h => !childIds.has(h.id));
    }, [habits]);

    // Initial Split based on Roots
    const dailyHabits = useMemo(() => rootHabits.filter(h => h.goal.frequency === 'daily'), [rootHabits]);
    const weeklyHabits = useMemo(() => rootHabits.filter(h => h.goal.frequency === 'weekly'), [rootHabits]);

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

            // Reconstruct full list order:
            // We want to preserve relations.
            // Simplified strategy: Just send new order of roots + any remaining habits (children) to backend?
            // Backend reorderHabits takes a list of IDs.
            // If we only reorder roots, children will stick to their parents implicitly if we don't persist order for them?
            // No, habits have an order.

            // Get all roots in new order
            // const newRoots = arrayMove(dailyHabits, oldDailyIndex, newDailyIndex);
            arrayMove(dailyHabits, oldDailyIndex, newDailyIndex);

            // Construct full list: newRoots + weeklyRoots + children (appended or interleaved?)
            // If children order matters, we should probably keep them.
            // Safest: Current reorder implementation just updates index.
            // If we send ONLY roots, children might get pushed to end?
            // We should send ALL habits.

            // Let's preserve the relative order of non-moved items.
            // This is complex.
            // MVP: Just send IDs of daily roots first, then weekly roots?
            // What about children? They need to be in the list too to have an index.

            const rootIds = [...newOrder, ...weeklyHabits.map(h => h.id)];
            const childIds = habits.filter(h => !rootIds.includes(h.id)).map(h => h.id);

            const fullListIds = [...rootIds, ...childIds];
            reorderHabits(fullListIds);
            return;
        }

        // Try find in weekly list
        const oldWeeklyIndex = weeklyHabits.findIndex(h => h.id === active.id);
        const newWeeklyIndex = weeklyHabits.findIndex(h => h.id === over.id);

        if (oldWeeklyIndex !== -1 && newWeeklyIndex !== -1) {
            // Reordering Weekly
            const newOrder = arrayMove(weeklyHabits, oldWeeklyIndex, newWeeklyIndex).map(h => h.id);
            const rootIds = [...dailyHabits.map(h => h.id), ...newOrder];
            const childIds = habits.filter(h => !rootIds.includes(h.id)).map(h => h.id);
            const fullListIds = [...rootIds, ...childIds];

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
                                            allHabits={habits}
                                            expandedIds={expandedIds}
                                            onToggleExpand={toggleExpand}
                                            logs={logs}
                                            dates={dates}
                                            handleCellClick={handleCellClick}
                                            deleteHabit={deleteHabit}
                                            deleteConfirmId={deleteConfirmId}
                                            setDeleteConfirmId={setDeleteConfirmId}
                                            onEditHabit={onEditHabit}
                                            onToggle={onToggle}
                                            onRunRoutine={onRunRoutine}
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
                                            allHabits={habits}
                                            expandedIds={expandedIds}
                                            onToggleExpand={toggleExpand}
                                            logs={logs}
                                            onToggleToday={handleToggleToday}
                                            onOpenPopover={(e, habit, date, val) => {
                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                setPopoverState({
                                                    isOpen: true,
                                                    habitId: habit.id,
                                                    date: date,
                                                    initialValue: val,
                                                    unit: habit.goal.unit,
                                                    position: { top: rect.bottom + 8, left: rect.left - 40 }, // Center-ish
                                                });
                                            }}
                                            deleteHabit={deleteHabit}
                                            deleteConfirmId={deleteConfirmId}
                                            setDeleteConfirmId={setDeleteConfirmId}
                                            onEditHabit={onEditHabit}
                                            onRunRoutine={onRunRoutine}
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
