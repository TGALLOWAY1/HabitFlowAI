import { useState } from 'react';
import { Check, Target, Clock, Pin, PinOff, ListTodo, Layers, FolderInput } from 'lucide-react';
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
    onToggle: () => void;
    onExpand: () => void;
    onPin: (id: string) => void;
    onUpdateEstimate: (id: string, minutes: number) => void;
    onMoveToCategory?: (habit: Habit) => void;

    // Bundle Props
    subHabits?: Habit[];
    subHabitStatuses?: Map<string, boolean>;
    onSubHabitToggle?: (subHabitId: string) => void;

    // For Choice Bundles
    onChoiceSelect?: (optionKey: string) => void;
    selectedChoice?: string;

    // Status & Quantity
    habitStatus?: DayViewHabitStatus;
    onNumericClick?: (e: React.MouseEvent) => void;
}

export const HabitGridCell = ({
    habit,
    isCompleted,
    isExpanded,
    onToggle,
    onExpand,
    onPin,
    onUpdateEstimate,
    onMoveToCategory,
    subHabits,
    subHabitStatuses,
    onSubHabitToggle,
    onChoiceSelect,
    selectedChoice,
    habitStatus,
    onNumericClick
}: HabitGridCellProps) => {
    const [timeInput, setTimeInput] = useState(habit.timeEstimate?.toString() || '');
    const [isEditingTime, setIsEditingTime] = useState(false);

    const isChecklistBundle = habit.type === 'bundle' && habit.bundleType === 'checklist';
    const isChoiceBundle = habit.type === 'bundle' && habit.bundleType === 'choice';
    const isBundle = isChecklistBundle || isChoiceBundle;
    const isQuantity = habit.goal?.type === 'number';
    const hasSubHabits = subHabits && subHabits.length > 0;

    // Compute local checklist progress from sub-habit statuses
    const checklistDone = isChecklistBundle && subHabitStatuses
        ? Array.from(subHabitStatuses.values()).filter(Boolean).length
        : (habitStatus?.completedChildrenCount ?? 0);
    const checklistTotal = isChecklistBundle && subHabits
        ? subHabits.length
        : (habitStatus?.totalChildrenCount ?? 0);

    // Handle Time Estimate Submit
    const handleTimeSubmit = () => {
        const val = parseInt(timeInput);
        if (!isNaN(val) && val >= 0) {
            onUpdateEstimate(habit.id, val);
        }
        setIsEditingTime(false);
    };

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
            const selectedSub = selectedChoice && subHabits?.find(s => s.id === selectedChoice);
            return (
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400">
                    <Layers size={12} />
                    <span>{selectedSub ? selectedSub.name : 'Pick one'}</span>
                </span>
            );
        }
        if (isQuantity && habitStatus) {
            return (
                <span className="flex items-center gap-1 text-[10px] font-medium text-neutral-400">
                    <Target size={12} />
                    <span>{habitStatus.currentValue}/{habitStatus.targetValue} {habit.goal?.unit ?? ''}</span>
                </span>
            );
        }
        if (habit.goal) return <Target size={12} className="text-neutral-500" />;
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
                                    "text-xs truncate transition-colors",
                                    childDone ? "text-neutral-600 line-through" : "text-neutral-400"
                                )}>
                                    {child.name}
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
                                onChoiceSelect?.(option.id);
                            }}
                            className={cn(
                                "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                                selectedChoice === option.id
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                                    : "bg-neutral-800 text-neutral-400 border-white/5 hover:border-white/20 hover:text-white"
                            )}
                        >
                            {option.name}
                        </button>
                    ))}
                </div>
            )}

            {/* EXPANDED CONTENT AREA */}
            {isExpanded && (
                <div className="px-3 pb-3 pt-0 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200 cursor-default" onClick={e => e.stopPropagation()}>
                    <div className="h-px w-full bg-white/5 mb-1" />

                    {/* 1. Time Estimate Input */}
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <Clock size={12} />
                        <span className="mr-auto">Time Estimate:</span>
                        {isEditingTime ? (
                            <input
                                autoFocus
                                type="number"
                                className="w-12 bg-neutral-950 text-white rounded px-1 py-0.5 text-xs border border-white/10 focus:outline-none focus:border-emerald-500"
                                value={timeInput}
                                onChange={(e) => setTimeInput(e.target.value)}
                                onBlur={handleTimeSubmit}
                                onKeyDown={(e) => e.key === 'Enter' && handleTimeSubmit()}
                            />
                        ) : (
                            <span
                                className="hover:text-white cursor-pointer border-b border-transparent hover:border-white/20"
                                onClick={() => setIsEditingTime(true)}
                            >
                                {habit.timeEstimate ? `${habit.timeEstimate} min` : 'Set time'}
                            </span>
                        )}
                    </div>

                    {/* 2. Goal Context */}
                    {habit.goal && !isBundle && (
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <Target size={12} />
                            <span>Linked to {habit.goal.type === 'number' ? `target: ${habit.goal.target} ${habit.goal.unit}` : 'daily goal'}</span>
                        </div>
                    )}

                    {/* 3. Actions (Pin, Move) */}
                    <div className="flex items-center justify-end gap-1 mt-1 pt-2 border-t border-white/5">
                        {onMoveToCategory && (
                            <button
                                onClick={() => onMoveToCategory(habit)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                            >
                                <FolderInput size={12} />
                                <span>Move</span>
                            </button>
                        )}
                        <button
                            onClick={() => onPin(habit.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs",
                                habit.pinned
                                    ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                            )}
                        >
                            {habit.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                            <span>{habit.pinned ? 'Unpin' : 'Pin to Focus'}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
