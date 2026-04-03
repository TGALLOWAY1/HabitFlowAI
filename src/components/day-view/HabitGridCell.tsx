import { Check, Target, Hash, Pin, PinOff, ListTodo, Layers, FolderInput, Trophy, Clock, Calendar, Shield, Repeat, Activity, History, Pencil, Trash2 } from 'lucide-react';
import type { Habit, DayLog } from '../../types';
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

interface HabitGridCellProps {
    habit: Habit;
    log?: DayLog;
    isCompleted: boolean;
    isExpanded: boolean;
    onToggle: () => void | Promise<void>;
    onExpand: () => void;
    onPin: (id: string) => void;
    onMoveToCategory?: (habit: Habit) => void;
    onAddToBundle?: (habit: Habit) => void;
    onViewHistory?: (habit: Habit) => void;
    onEditHabit?: (habit: Habit) => void;
    onDeleteHabit?: (id: string) => Promise<void>;

    // Bundle Props
    subHabits?: Habit[];
    subHabitStatuses?: Map<string, boolean>;
    onSubHabitToggle?: (subHabitId: string) => void | Promise<void>;

    // For Choice Bundles
    onChoiceSelect?: (optionKey: string, e: React.MouseEvent) => void | Promise<void>;
    selectedChoices?: Set<string>;

    // Status & Quantity
    habitStatus?: DayViewHabitStatus;
    onNumericClick?: (e: React.MouseEvent) => void;
    childStatusMap?: Map<string, DayViewHabitStatus>;
}

export const HabitGridCell = ({
    habit,
    isCompleted,
    isExpanded,
    onToggle,
    onExpand,
    onPin,
    onMoveToCategory,
    onAddToBundle,
    onViewHistory,
    onEditHabit,
    onDeleteHabit,
    subHabits,
    subHabitStatuses,
    onSubHabitToggle,
    onChoiceSelect,
    selectedChoices,
    habitStatus,
    onNumericClick,
    log,
    childStatusMap
}: HabitGridCellProps) => {
    const isChecklistBundle = habit.type === 'bundle' && habit.bundleType === 'checklist';
    const isChoiceBundle = habit.type === 'bundle' && habit.bundleType === 'choice';
    const isQuantity = habit.goal?.type === 'number';
    const hasSubHabits = subHabits && subHabits.length > 0;

    // Compute local checklist progress from sub-habit statuses
    const checklistDone = isChecklistBundle && subHabitStatuses
        ? Array.from(subHabitStatuses.values()).filter(Boolean).length
        : (habitStatus?.completedChildrenCount ?? 0);
    const checklistTotal = isChecklistBundle && subHabits
        ? subHabits.length
        : (habitStatus?.totalChildrenCount ?? 0);

    // Render the right-side status badge
    const renderStatusBadge = () => {
        if (isChecklistBundle) {
            return (
                <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-400">
                    <ListTodo size={12} />
                    <span>{checklistDone}/{checklistTotal}</span>
                </span>
            );
        }
        if (isChoiceBundle) {
            const selectedCount = selectedChoices?.size ?? 0;
            const selectedNames = subHabits
                ?.filter(s => selectedChoices?.has(s.id))
                .map(s => s.name);
            return (
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400">
                    <Layers size={12} />
                    <span>
                        {selectedCount === 0
                            ? 'Pick one'
                            : selectedCount === 1
                                ? selectedNames![0]
                                : `${selectedCount} selected`}
                    </span>
                </span>
            );
        }
        if (isQuantity && habitStatus) {
            return (
                <button
                    onClick={(e) => { e.stopPropagation(); onNumericClick?.(e); }}
                    className="flex items-center gap-1 text-[10px] font-medium text-sky-400 hover:text-sky-300 transition-colors"
                >
                    <Hash size={12} />
                </button>
            );
        }
        if (habit.goal) return <Target size={12} className="text-emerald-500" />;
        if (habit.timeEstimate) return <span className="text-[10px] text-neutral-500 font-medium">{habit.timeEstimate}m</span>;
        return null;
    };

    // Handle checkbox click — quantity habits open popover, others toggle
    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isQuantity && onNumericClick) {
            onNumericClick(e);
        } else if (!isChoiceBundle || isCompleted) {
            onToggle();
        }
    };

    // Render quantity progress ring on checkbox
    const renderCheckbox = () => {
        if (isQuantity && habitStatus && habitStatus.targetValue > 0) {
            const pct = Math.min(100, habitStatus.progressPercent);
            return (
                <button
                    onClick={handleCheckboxClick}
                    className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative",
                        isCompleted
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                            : "border-white/20 text-transparent hover:border-emerald-500/50"
                    )}
                    title={`${habitStatus.currentValue}/${habitStatus.targetValue} ${habit.goal?.unit ?? ''}`}
                >
                    {isCompleted ? (
                        <Check size={12} strokeWidth={3} />
                    ) : pct > 0 ? (
                        <span className="text-[8px] font-bold text-neutral-400">{Math.round(pct)}%</span>
                    ) : null}
                </button>
            );
        }

        return (
            <button
                onClick={handleCheckboxClick}
                className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300",
                    isCompleted
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                        : "border-white/20 text-transparent hover:border-emerald-500/50"
                )}
            >
                {isCompleted && <Check size={12} strokeWidth={3} />}
            </button>
        );
    };

    return (
        <div
            className={cn(
                "relative flex flex-col rounded-lg border transition-all duration-300 overflow-hidden",
                isExpanded
                    ? "bg-neutral-800 border-white/10 shadow-lg scale-[1.02] z-10"
                    : "bg-neutral-900/40 border-white/5 hover:bg-neutral-800/60 hover:border-white/10",
                // Claim extra grid rows for bundles with sub-habits
                hasSubHabits && !isExpanded && "row-span-2"
            )}
        >
            {/* COLLAPSED ROW (Always Visible) */}
            <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => onExpand()}
            >
                {/* Checkbox - Left */}
                {renderCheckbox()}

                {/* Name - Center */}
                <span className={cn(
                    "flex-1 text-sm font-medium truncate select-none transition-colors",
                    isCompleted ? "text-neutral-500 line-through decoration-white/20" : "text-neutral-300"
                )}>
                    {habit.name}
                </span>

                {/* Apple Health auto-log indicator */}
                {log?.source === 'apple_health' && (
                    <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-emerald-500/70" title="Auto-logged from Apple Health">
                        <Activity size={10} />
                    </span>
                )}

                {/* Goal Indicator */}
                {habit.linkedGoalId && (
                    <Trophy size={12} className="flex-shrink-0 text-amber-500" />
                )}

                {/* Status Badge - Right */}
                <div className="flex-shrink-0 flex items-center justify-center">
                    {renderStatusBadge()}
                </div>
            </div>

            {/* BUNDLE SUB-HABITS (Always Visible for bundles) */}
            {isChecklistBundle && hasSubHabits && (
                <div className="flex flex-col border-t border-white/5">
                    {subHabits!.map(child => {
                        const childDone = subHabitStatuses?.get(child.id) ?? false;
                        return (
                            <div
                                key={child.id}
                                className="flex items-center gap-2 pl-6 pr-3 py-1.5 hover:bg-white/[0.02] transition-colors"
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSubHabitToggle?.(child.id);
                                    }}
                                    className={cn(
                                        "flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all duration-200",
                                        childDone
                                            ? "bg-indigo-500/20 border-indigo-500 text-indigo-400"
                                            : "border-white/15 text-transparent hover:border-indigo-400/50"
                                    )}
                                >
                                    {childDone && <Check size={10} strokeWidth={3} />}
                                </button>
                                <span className={cn(
                                    "text-xs truncate transition-colors flex items-center gap-1",
                                    childDone ? "text-neutral-600 line-through" : "text-neutral-400"
                                )}>
                                    {child.name}
                                    {child.linkedGoalId && <Trophy size={10} className="flex-shrink-0 text-amber-500" />}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {isChoiceBundle && hasSubHabits && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 pt-0.5">
                    {subHabits!.map(option => (
                        <button
                            key={option.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChoiceSelect?.(option.id, e);
                            }}
                            className={cn(
                                "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                                selectedChoices?.has(option.id)
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                                    : "bg-neutral-800 text-neutral-400 border-white/5 hover:border-white/20 hover:text-white"
                            )}
                        >
                            {option.name}
                            {option.goal?.type === 'number' && childStatusMap?.get(option.id)?.currentValue
                                ? ` (${childStatusMap.get(option.id)!.currentValue}${option.goal.unit ? ` ${option.goal.unit}` : ''})`
                                : null}
                            {option.linkedGoalId && <Trophy size={10} className="flex-shrink-0 text-amber-500" />}
                        </button>
                    ))}
                </div>
            )}

            {/* EXPANDED CONTENT AREA */}
            {isExpanded && (
                <div className="px-3 pb-3 pt-0 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200 cursor-default" onClick={e => e.stopPropagation()}>
                    <div className="h-px w-full bg-white/5 mb-1" />

                    {/* Habit Metadata */}
                    {(habit.timeEstimate || habit.timesPerWeek || habit.nonNegotiable || (isQuantity && habitStatus) || habit.assignedDays) && (
                        <div className="flex flex-wrap gap-2">
                            {habit.timeEstimate && (
                                <span className="flex items-center gap-1 text-[10px] text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full">
                                    <Clock size={10} />
                                    {habit.timeEstimate}m
                                </span>
                            )}
                            {isQuantity && habitStatus && (
                                <span className="flex items-center gap-1 text-[10px] text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full">
                                    <Target size={10} />
                                    {habitStatus.currentValue}/{habitStatus.targetValue} {habit.goal?.unit || ''}
                                </span>
                            )}
                            {habit.timesPerWeek != null && habit.timesPerWeek > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full">
                                    <Repeat size={10} />
                                    {habit.timesPerWeek}x/week
                                </span>
                            )}
                            {habit.nonNegotiable && (
                                <span className="flex items-center gap-1 text-[10px] text-red-400/80 bg-red-500/10 px-2 py-0.5 rounded-full">
                                    <Shield size={10} />
                                    Non-negotiable
                                </span>
                            )}
                            {habit.assignedDays && habit.assignedDays.length > 0 && habit.assignedDays.length < 7 && (
                                <span className="flex items-center gap-1 text-[10px] text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full">
                                    <Calendar size={10} />
                                    {habit.assignedDays.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(', ')}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                        {onAddToBundle && habit.type !== 'bundle' && !habit.bundleParentId && (
                            <button
                                onClick={() => onAddToBundle(habit)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                            >
                                <Layers size={12} />
                                <span>Bundle</span>
                            </button>
                        )}
                        {onMoveToCategory && (
                            <button
                                onClick={() => onMoveToCategory(habit)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                            >
                                <FolderInput size={12} />
                                <span>Move</span>
                            </button>
                        )}
                        {onViewHistory && (
                            <button
                                onClick={() => onViewHistory(habit)}
                                className="p-1.5 rounded-md transition-colors text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                                title="View History"
                            >
                                <History size={12} />
                            </button>
                        )}
                        {onEditHabit && (
                            <button
                                onClick={() => onEditHabit(habit)}
                                className="p-1.5 rounded-md transition-colors text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                                title="Edit Habit"
                            >
                                <Pencil size={12} />
                            </button>
                        )}
                        <button
                            onClick={() => onPin(habit.id)}
                            className={cn(
                                "p-1.5 rounded-md transition-colors",
                                habit.pinned
                                    ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                            )}
                            title={habit.pinned ? 'Unpin' : 'Pin to Focus'}
                        >
                            {habit.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                        </button>
                        {onDeleteHabit && (
                            <button
                                onClick={async () => {
                                    if (confirm(`Delete "${habit.name}"? This cannot be undone.`)) {
                                        await onDeleteHabit(habit.id);
                                    }
                                }}
                                className="p-1.5 rounded-md transition-colors text-neutral-500 hover:text-red-400 hover:bg-white/5"
                                title="Delete Habit"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
