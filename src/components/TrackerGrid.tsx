import React, { useMemo, useState } from 'react';
import { format, eachDayOfInterval, subDays, isToday, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { type Habit, type DayLog, type Routine, type HabitPotentialEvidence } from '../types';
import { cn } from '../utils/cn';
import { Check, Plus, Trash2, GripVertical, Pencil, Trophy, Play, Flame, History, Zap } from 'lucide-react';

import { NumericInputPopover } from './NumericInputPopover';
import { HabitHistoryModal } from './HabitHistoryModal';
import { HabitLogModal } from './HabitLogModal';
import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { useProgressOverview } from '../lib/useProgressOverview';



import { computeBundleStatus, getBundleStats } from '../utils/habitUtils';
import { WeeklyHabitCard } from './WeeklyHabitCard';
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
    onLogChoice?: (payload: {
        habitId: string;
        date: string;
        bundleOptionId: string;
        bundleOptionLabel: string;
        value?: number | null;
        unitSnapshot?: string;
    }) => Promise<void>;
    onAddHabit: () => void;
    onEditHabit: (habit: Habit) => void;
    onRunRoutine?: (routine: Routine) => void;
    onViewHistory: (habit: Habit) => void;
    potentialEvidence?: HabitPotentialEvidence[];
}

// --- Shared Components ---

const HabitActionButtons = ({
    habit,
    onEdit,
    onViewHistory,
    onDelete,
    deleteConfirmId,
    setDeleteConfirmId,
    onRunRoutine
}: {
    habit: Habit,
    onEdit: () => void,
    onViewHistory: () => void,
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
                    onViewHistory();
                }}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors"
                title="View History"
            >
                <History size={14} />
            </button>
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
// --- Row Components ---

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
    attributes?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    listeners?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    isDragging?: boolean;
    setNodeRef?: (node: HTMLElement | null) => void;
    style?: React.CSSProperties;
    bundleStatus?: { completed: boolean; value: number };
    onToggle: (habitId: string, date: string) => Promise<void>;
    onRunRoutine?: (routine: Routine) => void;
    streak?: number;
    onViewHistory: (habit: Habit) => void;
    potentialEvidence?: HabitPotentialEvidence[];
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
    onRunRoutine,
    streak,
    onViewHistory,
    potentialEvidence
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
    }, [habit.nonNegotiable, habit.nonNegotiableDays, today]); // eslint-disable-line react-hooks/exhaustive-deps

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
                "flex border-b border-white/5 transition-colors group",
                habit.isVirtual ? "bg-neutral-800/30" : "bg-neutral-900/50", // Difference for virtual
                isDragging && "shadow-xl ring-1 ring-emerald-500/50 z-50 bg-neutral-900",
                priorityRingClass
            )}
        >
            <div
                className="w-64 flex-shrink-0 p-4 border-r border-white/5 flex items-center justify-between group-hover:bg-white/[0.02] transition-colors relative"
                style={{ paddingLeft: `${16 + (depth * 24)}px` }} // Dynamic Indentation
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {/* Drag Handle (Only for depth 0 and NOT virtual) */}
                    {depth === 0 && !habit.isVirtual && (
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
                                    (depth > 0 || habit.isVirtual) ? "text-neutral-400 italic text-sm" : "text-neutral-200"
                                )}
                                title={habit.name}
                            >
                                {habit.name}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            {habit.goal.type === 'number' && habit.goal.target && (
                                <span className="text-xs text-neutral-500 truncate">
                                    Target: {habit.goal.target} {habit.goal.unit}
                                </span>
                            )}

                            {/* Streak Display */}
                            {streak !== undefined && streak > 0 && (
                                <div className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded-full border border-orange-400/20">
                                    <Flame size={10} className="fill-orange-400" />
                                    <span className="font-bold">{streak}</span>
                                </div>
                            )}

                            {/* Potential Evidence Indicator */}
                            {potentialEvidence && potentialEvidence.some(e => e.habitId === habit.id && e.date === todayStr) && !isCompletedToday && (
                                <div className="flex items-center gap-1 text-[10px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded-full border border-purple-400/20 animate-pulse" title="Routine Activity Detected: Verify completion">
                                    <Zap size={10} className="fill-purple-400" />
                                    <span className="font-bold">Routine Activity</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <HabitActionButtons
                    habit={habit}
                    onEdit={() => onEditHabit(habit)}
                    onDelete={deleteHabit}
                    deleteConfirmId={deleteConfirmId}
                    setDeleteConfirmId={setDeleteConfirmId}
                    onRunRoutine={onRunRoutine}
                    onViewHistory={() => onViewHistory(habit)}
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
                    const log = logs[`${habit.id}-${dateStr}`];

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

                    const isFrozen = log?.isFrozen;

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
                                onClick={habit.type === 'bundle' && habit.bundleType !== 'choice' ? handleBundleClick : (isInteractive ? (e) => handleCellClick(e, habit, dateStr, log) : undefined)}
                                onDoubleClick={isInteractive ? (e) => handleCellClick(e, habit, dateStr, log) : undefined}
                                disabled={!isInteractive}
                                className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 relative overflow-hidden",
                                    habit.type === 'bundle'
                                        ? "bg-neutral-800 border border-white/5 hover:bg-neutral-700 text-neutral-200"
                                        : isFrozen
                                            ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" // Frozen visual
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
                                title={
                                    habit.type === 'bundle'
                                        ? (habit.bundleType === 'choice' ? "Click to log choice" : "Click to toggle all sub-habits")
                                        : isFrozen
                                            ? `Streak protected (${habit.freezeCount ?? 3} freezes left)`
                                            : !isInteractive
                                                ? "Derived from sub-habits"
                                                : undefined
                                }
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
                                        <Check size={20} strokeWidth={3} className={cn("transition-transform duration-200", isCompleted ? "scale-100" : isFrozen ? "scale-100 opacity-50" : "scale-50")} />
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
    onRunRoutine,
    streak,
    onViewHistory,
    potentialEvidence
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
    streak?: number;
    onViewHistory: (habit: Habit) => void;
    potentialEvidence?: HabitPotentialEvidence[];
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
        // Option 1: Unified Choice Bundles (Children as Habits)
        // If subHabitIds are present, prioritize them over virtual options.
        if (habit.subHabitIds && habit.subHabitIds.length > 0) {
            return habit.subHabitIds
                .map(id => allHabits.find(h => h.id === id))
                .filter((h): h is Habit => !!h);
        }

        // Option 2: Legacy Choice Habits (Virtual Children)
        if (habit.bundleType === 'choice' && habit.bundleOptions) {
            return habit.bundleOptions.map(opt => {
                const metricMode = opt.metricConfig?.mode || 'none';
                return {
                    id: `virtual-${habit.id}-${opt.id}`,
                    categoryId: habit.categoryId,
                    name: opt.label,
                    goal: {
                        ...habit.goal,
                        type: metricMode === 'required' ? 'number' : 'boolean',
                        unit: opt.metricConfig?.unit,
                        target: 0
                    },
                    archived: false,
                    createdAt: habit.createdAt,
                    type: 'bundle-option-virtual' as any, // Only for internal distinction if needed
                    isVirtual: true,
                    associatedOptionId: opt.id,
                    bundleParentId: habit.id,
                } as Habit;
            });
        }

        // Option 2: Standard/Legacy Bundles
        if (habit.type !== 'bundle' || !habit.subHabitIds) return [];
        // Map IDs to habit objects, preserving order
        return habit.subHabitIds
            .map(id => allHabits.find(h => h.id === id))
            .filter((h): h is Habit => !!h);
    }, [habit, allHabits]);

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
                streak={habit.type !== 'bundle' ? streak : undefined}
                onViewHistory={onViewHistory}
                potentialEvidence={potentialEvidence}
            />

            {/* Child Rows - Rendered when expanded */}
            {isExpanded && children.map(child => (
                <HabitRowContent
                    key={child.id}
                    habit={child}
                    depth={child.isVirtual ? 0 : 1} // User requested 'No Indent' for choice, so depth 0. Checklist depth 1.
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
                    onViewHistory={onViewHistory}
                    potentialEvidence={potentialEvidence}
                />
            ))}
        </div>
    );
};

// --- Weekly Habit Row ---

// SortableWeeklyHabitRow removed/commented out as it is replaced by WeeklyHabitCard
/*
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
    onRunRoutine,
    onViewHistory,
    potentialEvidence
}: {
    habit: Habit;
    allHabits: Habit[];
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    logs: Record<string, DayLog>;
    onToggleToday: (habit: Habit) => void;
    onOpenPopover: (e: React.MouseEvent, habit: Habit, date: string, currentValue: number) => void;
    deleteHabit: (id: string) => Promise<void>;
    deleteConfirmId: string | null;
    setDeleteConfirmId: (id: string | null) => void;
    onEditHabit: (habit: Habit) => void;
    onRunRoutine?: (routine: Routine) => void;
    onViewHistory: (habit: Habit) => void;
    potentialEvidence?: HabitPotentialEvidence[];
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
            {/* Parent Row }
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
                onViewHistory={onViewHistory}
                potentialEvidence={potentialEvidence}
            />

            {/* Child Rows }
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
                    onViewHistory={onViewHistory}
                    potentialEvidence={potentialEvidence}
                />
            ))}
        </div>
    );
};
*/

// [REPLACED TRACKER GRID DEFINITION]
export const TrackerGrid = ({
    habits,
    logs,
    onAddHabit,
    onEditHabit,
    onRunRoutine,
    potentialEvidence
}: TrackerGridProps) => {
    const {
        deleteHabit,
        reorderHabits,
        upsertHabitEntry,
        deleteHabitEntryByKey
    } = useHabitStore();
    const { data: progressData, refresh: refreshProgress } = useProgressOverview();

    const [popoverState, setPopoverState] = useState<{
        isOpen: boolean;
        habitId: string;
        date: string;
        initialValue: number;
        unit?: string;
        bundleOptionId?: string; // Support for Choice Options
        position: { top: number; left: number };
    }>({
        isOpen: false,
        habitId: '',
        date: '',
        initialValue: 0,
        position: { top: 0, left: 0 },
    });

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [historyModalHabitId, setHistoryModalHabitId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [choiceLogState, setChoiceLogState] = useState<{ habit: Habit; date: string } | null>(null);

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
    const dailyHabits = useMemo(() => rootHabits.filter(h => !h.goal?.frequency || h.goal.frequency === 'daily'), [rootHabits]);
    const weeklyHabits = useMemo(() => rootHabits.filter(h => h.goal.frequency === 'weekly'), [rootHabits]);

    // Generate dates: Today + Last 13 days
    const dates = useMemo(() => {
        const today = new Date();
        const interval = eachDayOfInterval({
            start: subDays(today, 13),
            end: today,
        });
        return interval.reverse();
    }, []);

    // Optimistic Progress Map
    const habitProgressMap = useMemo(() => {
        const map = new Map<string, { streak: number; freezeStatus?: string }>();
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        if (progressData?.habitsToday) {
            progressData.habitsToday.forEach(h => {
                const habitId = h.habit.id;
                const logKey = `${habitId}-${todayStr}`;
                const optimisticLog = logs[logKey];
                const isOptimisticallyCompleted = optimisticLog?.completed || false;
                const serverCompleted = h.completed;

                let effectiveStreak = h.streak;

                if (isOptimisticallyCompleted && !serverCompleted) {
                    effectiveStreak += 1;
                } else if (!isOptimisticallyCompleted && serverCompleted && effectiveStreak > 0) {
                    effectiveStreak -= 1;
                }

                map.set(habitId, {
                    streak: effectiveStreak,
                    freezeStatus: h.freezeStatus
                });
            });
        }
        return map;
    }, [progressData, logs]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = habits.findIndex((h) => h.id === active.id);
            const newIndex = habits.findIndex((h) => h.id === over?.id);
            const newOrder = arrayMove(habits, oldIndex, newIndex).map(h => h.id);
            reorderHabits(newOrder);
        }
    };

    // Toggle Handler
    const handleToggle = async (habitId: string, date: string) => {
        const log = logs[`${habitId}-${date}`];
        const isCompleted = log?.completed || false;
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        if (isCompleted) {
            await deleteHabitEntryByKey(habitId, date);
        } else {
            await upsertHabitEntry(habitId, date, { value: 1 });
        }
        refreshProgress();
    };

    // Choice Log Handlers


    const handleChoiceSave = async (payload: {
        habitId: string;
        date: string;
        bundleOptionId: string;
        bundleOptionLabel: string;
        value?: number | null;
        unitSnapshot?: string;
    }) => {
        await upsertHabitEntry(payload.habitId, payload.date, {
            bundleOptionId: payload.bundleOptionId,
            bundleOptionLabel: payload.bundleOptionLabel,
            value: payload.value,
            unitSnapshot: payload.unitSnapshot
        });
        refreshProgress();
    };

    const handleOpenPopover = (e: React.MouseEvent, habit: Habit, date: string, val: number) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPopoverState({
            isOpen: true,
            habitId: habit.id,
            date: date,
            initialValue: val,
            unit: habit.goal.unit,
            position: { top: rect.bottom + 8, left: rect.left - 40 },
        });
    };

    const handleCellClick = async (e: React.MouseEvent, habit: Habit, dateStr: string, log?: DayLog) => {

        // Handle Unified Choice Children (Real Habits)
        if (habit.bundleParentId && !habit.isVirtual) {
            const parent = habits.find(h => h.id === habit.bundleParentId);
            if (parent && parent.bundleType === 'choice') {
                const parentLog = logs[`${parent.id}-${dateStr}`];
                const isCompleted = parentLog?.completedOptions?.[habit.id] !== undefined;

                if (isCompleted) {
                    // CHECK GOAL TYPE
                    if (habit.goal.type === 'number') {
                        // Open Popover for numeric habits
                        handleOpenPopover(e, habit, dateStr, parentLog?.completedOptions?.[habit.id] || 0);
                    } else {
                        // Direct upsert for boolean habits
                        await upsertHabitEntry(parent.id, dateStr, {
                            choiceChildHabitId: habit.id,
                            value: 1
                        });
                        refreshProgress();
                    }
                    return;
                }
            }
        }

        // Handle Virtual Choice Options (Legacy)
        if (habit.isVirtual && habit.associatedOptionId && habit.bundleParentId) {
            e.stopPropagation();

            const parentLog = logs[`${habit.bundleParentId}-${dateStr}`];
            const currentOptionValue = parentLog?.completedOptions?.[habit.associatedOptionId];
            const isOptionCompleted = currentOptionValue !== undefined && currentOptionValue !== null;

            if (habit.goal.type === 'boolean') {
                if (isOptionCompleted) {
                    await upsertHabitEntry(habit.bundleParentId, dateStr, {
                        bundleOptionId: habit.associatedOptionId,
                        bundleOptionLabel: habit.name,
                        value: 0,
                        completed: false
                    });
                } else {
                    await upsertHabitEntry(habit.bundleParentId, dateStr, {
                        bundleOptionId: habit.associatedOptionId,
                        bundleOptionLabel: habit.name,
                        value: 1
                    });
                }
                refreshProgress();
            } else {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setPopoverState({
                    isOpen: true,
                    habitId: habit.bundleParentId,
                    date: dateStr,
                    initialValue: typeof currentOptionValue === 'number' ? currentOptionValue : 0,
                    unit: habit.goal.unit,
                    bundleOptionId: habit.associatedOptionId,
                    position: { top: rect.bottom + 8, left: rect.left - 40 },
                });
            }
            return;
        }

        // Parent Bundle (Choice): Expand/Collapse
        if (habit.bundleType === 'choice') {
            toggleExpand(habit.id);
            return;
        }

        // Standard Habit Logic
        if (habit.goal.type === 'boolean') {
            handleToggle(habit.id, dateStr);
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPopoverState({
                isOpen: true,
                habitId: habit.id,
                date: dateStr,
                initialValue: log?.value || 0,
                unit: habit.goal.unit,
                position: { top: rect.bottom + 8, left: rect.left - 40 },
            });
        }
    };





    return (
        <div className="w-full overflow-x-auto pb-20">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                    {/* Header */}
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
                                        onToggle={handleToggle}
                                        onRunRoutine={onRunRoutine}
                                        streak={habitProgressMap.get(habit.id)?.streak}
                                        onViewHistory={(h) => setHistoryModalHabitId(h.id)}
                                        potentialEvidence={potentialEvidence}
                                    />
                                ))}
                            </SortableContext>
                        ) : (
                            <div className="p-8 text-center text-neutral-500 text-sm italic">
                                No daily habits yet. Click the + button to add one.
                            </div>
                        )}
                    </div>

                    {/* Weekly Habits Section - Redesigned as Cards */}

                    {weeklyHabits.length > 0 && (
                        <div className="flex flex-col border-t border-white/5 mt-8 pt-8">
                            <div className="px-6 mb-6">
                                <h3 className="text-lg font-medium text-emerald-400 flex items-center gap-2">
                                    <span>Weekly Progress</span>
                                    <span className="text-xs text-neutral-500 font-normal px-2 py-0.5 rounded-full bg-neutral-800 border border-white/5">Resets Monday</span>
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-6">
                                {weeklyHabits.map(habit => (
                                    <WeeklyHabitCard
                                        key={habit.id}
                                        habit={habit}
                                        logs={logs}
                                        goals={progressData?.goalsWithProgress.map(g => g.goal)}
                                        potentialEvidence={potentialEvidence?.some(e => e.habitId === habit.id)}
                                        onToggle={(h) => handleToggle(h.id, format(new Date(), 'yyyy-MM-dd'))}
                                        onLogValue={(e, h, val) => {
                                            // Open popover for quantity inputs
                                            handleOpenPopover(e, h, format(new Date(), 'yyyy-MM-dd'), val);
                                        }}
                                        onEdit={(h) => onEditHabit(h)}
                                        onViewHistory={(h) => setHistoryModalHabitId(h.id)}
                                        onDelete={(h) => setDeleteConfirmId(h.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DndContext>

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-2">Delete Habit?</h3>
                        <p className="text-neutral-400 mb-6 text-sm">
                            Are you sure you want to delete this habit? This action cannot be undone and all history will be lost.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (deleteConfirmId) {
                                        await deleteHabit(deleteConfirmId);
                                        setDeleteConfirmId(null);
                                    }
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <NumericInputPopover
                isOpen={popoverState.isOpen}
                onClose={() => setPopoverState(prev => ({ ...prev, isOpen: false }))}
                onSubmit={async (val) => {
                    try {
                        const { habitId, date } = popoverState;
                        // Use type assertion to access potential extra fields
                        const state = popoverState as any;
                        if (state.bundleOptionId) {
                            await upsertHabitEntry(habitId, date, {
                                value: val,
                                bundleOptionId: state.bundleOptionId
                            });
                        } else {
                            await upsertHabitEntry(habitId, date, { value: val });
                        }
                        refreshProgress();
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

            {historyModalHabitId && (
                <HabitHistoryModal
                    habitId={historyModalHabitId}
                    onClose={() => setHistoryModalHabitId(null)}
                />
            )}

            {/* Habit Choice Log Modal */}
            {choiceLogState && (
                <HabitLogModal
                    isOpen={!!choiceLogState}
                    onClose={() => setChoiceLogState(null)}
                    habit={choiceLogState.habit}
                    date={choiceLogState.date}
                    existingEntry={logs[`${choiceLogState.habit.id}-${choiceLogState.date}`] ? {
                        bundleOptionId: logs[`${choiceLogState.habit.id}-${choiceLogState.date}`].bundleOptionId,
                        value: logs[`${choiceLogState.habit.id}-${choiceLogState.date}`].value
                    } : undefined}
                    onSave={handleChoiceSave}
                />
            )}
        </div>
    );
};

export default TrackerGrid;
