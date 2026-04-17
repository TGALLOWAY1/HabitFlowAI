import React, { useMemo } from 'react';
import { type Habit, type DayLog, type Goal } from '../types';
import { Check, Trophy, Zap, Edit2, History, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

interface WeeklyHabitCardProps {
    habit: Habit;
    logs: Record<string, DayLog>;
    goals?: Goal[];
    onToggle: (habit: Habit) => void;
    onLogValue: (e: React.MouseEvent, habit: Habit, value: number) => void;
    onEdit: (habit: Habit) => void;
    onViewHistory: (habit: Habit) => void;
    onDelete: (habit: Habit) => void;
    potentialEvidence?: boolean;
}

export const WeeklyHabitCard: React.FC<WeeklyHabitCardProps> = ({
    habit,
    logs,
    goals = [],
    onToggle,
    onLogValue,
    onEdit,
    onViewHistory,
    onDelete,
    potentialEvidence
}) => {
    // 1. Calculate Progress
    const { currentCount, target, isCompleted, progressPercent } = useMemo(() => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });

        // Target Logic
        const isQuantity = habit.goal.type === 'number';
        const targetVal = habit.goal.target || 1;

        let count = 0;
        let completed = false;

        Object.values(logs).forEach(log => {
            if (log.habitId === habit.id) {
                const logDate = parseISO(log.date);
                if (isWithinInterval(logDate, { start, end })) {
                    if (isQuantity) {
                        count += (log.value || 0);
                    } else if (log.completed) {
                        count++;
                    }
                }
            }
        });

        if (count >= targetVal) completed = true;

        return {
            currentCount: count,
            target: targetVal,
            isCompleted: completed,
            progressPercent: Math.min(100, (count / targetVal) * 100)
        };
    }, [habit, logs]);

    // 2. Identify Intent Type
    const intentType = useMemo(() => {
        if (habit.goal.type === 'number') return 'quantity';
        if (habit.goal.target && habit.goal.target > 1) return 'frequency';
        return 'binary';
    }, [habit.goal]);

    // 3. Find Linked Goal
    const linkedGoal = useMemo(() => {
        return habit.linkedGoalId ? goals.find(g => g.id === habit.linkedGoalId) : undefined;
    }, [habit.linkedGoalId, goals]);

    // 4. Render Indicator
    const renderIndicator = () => {
        switch (intentType) {
            case 'binary':
                return (
                    <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        isCompleted
                            ? "bg-accent border-accent text-content-on-accent"
                            : "border-line-strong hover:border-accent/50"
                    )}>
                        {isCompleted && <Check size={14} strokeWidth={3} />}
                    </div>
                );
            case 'frequency':
                return (
                    <div className="flex gap-1.5 flex-wrap">
                        {Array.from({ length: target }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-3 h-8 rounded-full transition-all",
                                    i < currentCount
                                        ? "bg-accent shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                        : "bg-surface-1 border border-line-subtle"
                                )}
                            />
                        ))}
                    </div>
                );
            case 'quantity':
                return (
                    <div className="w-full space-y-2">
                        <div className="flex justify-between text-xs text-content-secondary">
                            <span>{currentCount} {habit.goal.unit}</span>
                            <span>{target} {habit.goal.unit}</span>
                        </div>
                        <div className="w-full h-2 bg-surface-1 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                );
        }
    };

    const getHelperText = () => {
        if (isCompleted) return <span className="text-accent-contrast">Done for the week!</span>;
        switch (intentType) {
            case 'binary': return "Not done yet this week";
            case 'frequency': return `${currentCount} of ${target} sessions`;
            case 'quantity': return `${currentCount} / ${target} ${habit.goal.unit || 'units'} accumulated`;
        }
    };

    return (
        <div
            onClick={(e) => {
                if (intentType === 'quantity') {
                    onLogValue(e, habit, 0);
                } else {
                    onToggle(habit);
                }
            }}
            className={cn(
                "group relative flex flex-col gap-4 p-5 rounded-2xl border transition-all cursor-pointer select-none min-h-[160px]",
                isCompleted
                    ? "bg-surface-0/80 border-accent/30 hover:border-accent/50"
                    : "bg-surface-0 border-line-subtle hover:bg-surface-1 hover:border-line-subtle"
            )}
        >
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h4 className={cn(
                        "font-medium text-lg transition-colors line-clamp-2",
                        isCompleted ? "text-accent-contrast" : "text-content-primary"
                    )}>
                        {habit.name}
                    </h4>
                    {linkedGoal && (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full w-fit border border-indigo-500/20">
                            <Trophy size={10} />
                            <span>{linkedGoal.title}</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewHistory(habit); }}
                        className="p-1.5 hover:bg-surface-2 rounded-lg text-content-secondary hover:text-content-primary"
                        title="History"
                    >
                        <History size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(habit); }}
                        className="p-1.5 hover:bg-surface-2 rounded-lg text-content-secondary hover:text-content-primary"
                        title="Edit"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(habit); }}
                        className="p-1.5 hover:bg-danger-soft rounded-lg text-content-secondary hover:text-danger-contrast"
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="mt-auto pt-4">
                {renderIndicator()}
            </div>

            <div className="mt-2 flex justify-between items-center text-xs text-content-muted font-medium">
                <div className="flex items-center gap-2">
                    {potentialEvidence && !isCompleted && (
                        <Zap size={12} className="text-purple-400 fill-purple-400 animate-pulse" />
                    )}
                    <span>{getHelperText()}</span>
                </div>
            </div>

            {isCompleted && (
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 pointer-events-none" />
            )}
        </div>
    );
};
