import React from 'react';
import { Check, Target, Hash, Clock, Pin, PinOff, ChevronDown, ChevronRight, Trophy } from 'lucide-react';
import type { Habit, DayLog } from '../../types';
import { cn } from '../../utils/cn';

interface DayHabitRowProps {
    habit: Habit;
    log?: DayLog;
    isCompleted: boolean;
    onToggle: () => void | Promise<void>;
    onPin: (id: string) => void;
    onUpdateEstimate: (id: string, minutes: number) => void;

    // Bundle Props
    subHabits?: Habit[]; // Flattened children if passed explicitly, or access via context? 
    // Ideally parent just knows IDs, but for rendering we need objects.
    // We'll require parent component to pass resolved sub-habits.

    // For Choice Bundles
    onChoiceSelect?: (optionKey: string) => void | Promise<void>;
    selectedChoice?: string;
}

export const DayHabitRow = ({
    habit,
    isCompleted,
    onToggle,
    onPin,
    onUpdateEstimate,
    subHabits,
    onChoiceSelect,
    selectedChoice
}: DayHabitRowProps) => { // Removed unused log prop
    const [isHovered, setIsHovered] = React.useState(false);
    const [isExpanded, setIsExpanded] = React.useState(false); // For checklist bundles
    const [isEditingTime, setIsEditingTime] = React.useState(false);
    const [timeInput, setTimeInput] = React.useState(habit.timeEstimate?.toString() || '');

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

    return (
        <div
            className="group relative flex flex-col bg-surface-0/40 border border-line-subtle rounded-xl transition-all hover:bg-surface-1/40 hover:border-line-subtle mb-2 overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Main Row Content */}
            <div className="flex items-center p-3 gap-3">

                {/* Checkbox (or Status Indicator) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // For bundling logic, clicking parent might do nothing or expand
                        if (isChecklistBundle) {
                            setIsExpanded(!isExpanded);
                        } else if (!isChoiceBundle || isCompleted) {
                            onToggle();
                        }
                    }}
                    className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                        isCompleted
                            ? "bg-accent border-accent text-content-on-accent scale-100"
                            : "border-line-strong text-transparent hover:border-accent/50 scale-95 hover:scale-100"
                    )}
                >
                    <Check size={14} strokeWidth={3} />
                </button>

                {/* Name & Metadata */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                    <span className={cn(
                        "text-base font-medium truncate transition-colors",
                        isCompleted ? "text-content-muted line-through decoration-white/20" : "text-content-primary"
                    )}>
                        {habit.name}
                    </span>

                    {/* Metadata Row */}
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-content-muted">
                        {/* Linked Goal Trophy */}
                        {habit.linkedGoalId && (
                            <Trophy size={12} className="flex-shrink-0 text-amber-500" />
                        )}
                        {/* Goal Indicator */}
                        {habit.goal && (
                            <div className="flex items-center gap-1 hover:text-content-secondary transition-colors cursor-help" title={`Goal: ${habit.goal.target ?? 1} ${habit.goal.unit ?? 'times'} (${habit.goal.frequency})`}>
                                {habit.goal.type === 'number'
                                    ? <Hash size={12} className="text-sky-400" />
                                    : <Target size={12} className="text-emerald-500" />}
                            </div>
                        )}

                        {/* Time Estimate */}
                        <div
                            className="flex items-center gap-1 hover:text-content-secondary transition-colors cursor-pointer"
                            onClick={() => setIsEditingTime(true)}
                        >
                            <Clock size={12} />
                            {isEditingTime ? (
                                <input
                                    autoFocus
                                    type="number"
                                    className="w-12 bg-surface-1 text-content-primary rounded px-1 py-0.5 text-xs border border-line-subtle focus:outline-none focus:border-emerald-500"
                                    value={timeInput}
                                    onChange={(e) => setTimeInput(e.target.value)}
                                    onBlur={handleTimeSubmit}
                                    onKeyDown={(e) => e.key === 'Enter' && handleTimeSubmit()}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span>{habit.timeEstimate ? `${habit.timeEstimate}m` : 'Set time'}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions (visible on hover) */}
                <div className={cn(
                    "flex items-center gap-1 transition-opacity duration-200",
                    isHovered ? "opacity-100" : "opacity-0"
                )}>
                    <button
                        onClick={() => onPin(habit.id)}
                        className={cn(
                            "p-2 rounded-lg transition-colors hover:bg-surface-2",
                            habit.pinned ? "text-blue-400" : "text-content-muted hover:text-content-primary"
                        )}
                        title={habit.pinned ? "Unpin from Today's Focus" : "Pin to Today's Focus"}
                    >
                        {habit.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                    </button>
                    {isChecklistBundle && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-2 rounded-lg text-content-muted hover:text-content-primary hover:bg-surface-2 transition-colors"
                        >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Checklist Bundle Children */}
            {isChecklistBundle && isExpanded && subHabits && (
                <div className="flex flex-col border-t border-line-subtle bg-surface-0/30">
                    {subHabits.map(child => (
                        // Reusing simplified logic for children, or recursively render row? 
                        // For MVP simple rendering is safer.
                        <div key={child.id} className="flex items-center gap-3 p-3 pl-12 border-b border-line-subtle last:border-0 hover:bg-white/[0.02] transition-colors">
                            {/* Child actions would need to be passed down or handled via context in parent */}
                            <span className="text-sm text-content-secondary">{child.name}</span>
                        </div>
                    ))}
                    {(!subHabits || subHabits.length === 0) && (
                        <div className="p-3 pl-12 text-xs text-content-muted italic">No items in bundle</div>
                    )}
                </div>
            )}

            {/* Choice Bundle Options */}
            {isChoiceBundle && (
                <div className="flex flex-wrap gap-2 px-3 pb-3 pt-1 pl-12">
                    {habit.bundleOptions?.map(option => (
                        <button
                            key={option.key}
                            onClick={() => onChoiceSelect && onChoiceSelect(option.key || '')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                                selectedChoice === option.key
                                    ? "bg-accent-soft text-accent-contrast border-emerald-500/50"
                                    : "bg-surface-1 text-content-secondary border-line-subtle hover:border-line-strong hover:text-content-primary"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
