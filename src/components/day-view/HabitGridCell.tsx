import { useState } from 'react';
import { Check, Target, Clock, Pin, PinOff, ListTodo, Disc } from 'lucide-react';
import type { Habit, DayLog } from '../../types';
import { cn } from '../../utils/cn';

interface HabitGridCellProps {
    habit: Habit;
    log?: DayLog;
    isCompleted: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onExpand: () => void;
    onPin: (id: string) => void;
    onUpdateEstimate: (id: string, minutes: number) => void;

    // Bundle Props
    subHabits?: Habit[];

    // For Choice Bundles
    onChoiceSelect?: (optionKey: string) => void;
    selectedChoice?: string;
}

export const HabitGridCell = ({
    habit,
    isCompleted,
    isExpanded,
    onToggle,
    onExpand,
    onPin,
    onUpdateEstimate,
    subHabits,
    onChoiceSelect,
    selectedChoice
}: HabitGridCellProps) => {
    const [timeInput, setTimeInput] = useState(habit.timeEstimate?.toString() || '');
    const [isEditingTime, setIsEditingTime] = useState(false);

    const isChecklistBundle = habit.type === 'bundle' && habit.bundleType === 'checklist';
    const isChoiceBundle = habit.type === 'bundle' && habit.bundleType === 'choice';

    // Handle Time Estimate Submit
    const handleTimeSubmit = () => {
        const val = parseInt(timeInput);
        if (!isNaN(val) && val >= 0) {
            onUpdateEstimate(habit.id, val);
        }
        setIsEditingTime(false);
    };

    // Determine Status Icon (Metadata)
    const renderStatusIcon = () => {
        if (habit.goal) return <Target size={12} className="text-neutral-500" />;
        if (habit.timeEstimate) return <span className="text-[10px] text-neutral-500 font-medium">{habit.timeEstimate}m</span>;
        if (isChecklistBundle) return <ListTodo size={12} className="text-neutral-500" />;
        if (isChoiceBundle) return <Disc size={12} className="text-neutral-500" />;
        return null;
    };

    return (
        <div
            className={cn(
                "relative flex flex-col rounded-lg border transition-all duration-300 overflow-hidden",
                isExpanded
                    ? "bg-neutral-800 border-white/10 shadow-lg scale-[1.02] z-10 row-span-2" // Expanded styling
                    : "bg-neutral-900/40 border-white/5 hover:bg-neutral-800/60 hover:border-white/10" // Default styling
            )}
        >
            {/* COLLAPSED ROW (Always Visible) */}
            <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => {
                    // Prevent expansion if clicking specific controls?
                    // The whole row triggers expand, checkbox triggers toggle.
                    onExpand();
                }}
            >
                {/* Checkbox - Left */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Allow uncheck if completed (even for choice bundles now)
                        if (!isChoiceBundle || isCompleted) {
                            onToggle();
                        }
                    }}
                    className={cn(
                        "flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300",
                        isCompleted
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                            : "border-white/20 text-transparent hover:border-emerald-500/50"
                    )}
                >
                    {isCompleted && <Check size={12} strokeWidth={3} />}
                </button>

                {/* Name - Center */}
                <span className={cn(
                    "flex-1 text-sm font-medium truncate select-none transition-colors",
                    isCompleted ? "text-neutral-500 line-through decoration-white/20" : "text-neutral-300"
                )}>
                    {habit.name}
                </span>

                {/* Icon - Right */}
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6">
                    {renderStatusIcon()}
                </div>
            </div>

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

                    {/* 2. Bundle Content */}
                    {isChecklistBundle && subHabits && (
                        <div className="flex flex-col gap-1.5 mt-1">
                            {subHabits.map(child => (
                                <div key={child.id} className="flex items-center gap-2 pl-1">
                                    <div className="w-1 h-1 rounded-full bg-neutral-600" />
                                    <span className="text-xs text-neutral-400">{child.name}</span>
                                </div>
                            ))}
                            {subHabits.length === 0 && <span className="text-xs text-neutral-600 italic">No items</span>}
                        </div>
                    )}

                    {isChoiceBundle && (
                        <div className="flex flex-wrap gap-2 mt-1">
                            {habit.bundleOptions?.map(option => (
                                <button
                                    key={option.key}
                                    onClick={() => onChoiceSelect && onChoiceSelect(option.key || '')}
                                    className={cn(
                                        "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                                        selectedChoice === option.key
                                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                                            : "bg-neutral-800 text-neutral-400 border-white/5 hover:border-white/20 hover:text-white"
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 3. Goal Context */}
                    {habit.goal && (
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <Target size={12} />
                            <span>Linked to {habit.goal.type === 'number' ? `target: ${habit.goal.target} ${habit.goal.unit}` : 'daily goal'}</span>
                        </div>
                    )}

                    {/* 4. Actions (Pin) */}
                    <div className="flex items-center justify-end mt-1 pt-2 border-t border-white/5">
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
