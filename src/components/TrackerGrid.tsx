import React, { useMemo, useState } from 'react';
import { format, eachDayOfInterval, subDays, isToday } from 'date-fns';
import type { Habit, DayLog } from '../types';
import { cn } from '../utils/cn';
import { Check, Plus, Trash2 } from 'lucide-react';
import { NumericInputPopover } from './NumericInputPopover';
import { useHabitStore } from '../store/HabitContext';

interface TrackerGridProps {
    habits: Habit[];
    logs: Record<string, DayLog>;
    onToggle: (habitId: string, date: string) => void;
    onUpdateValue: (habitId: string, date: string, value: number) => void;
    onAddHabit: () => void;
}

export const TrackerGrid: React.FC<TrackerGridProps> = ({ habits, logs, onToggle, onUpdateValue, onAddHabit }) => {
    const { deleteHabit } = useHabitStore();
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

    // Generate dates: Today + Last 13 days (Reverse Chronological)
    const dates = useMemo(() => {
        const today = new Date();
        const interval = eachDayOfInterval({
            start: subDays(today, 13),
            end: today,
        });
        return interval.reverse(); // Show Today first, then Yesterday, etc.
    }, []);

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
            onToggle(habit.id, dateStr);
        }
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-neutral-900/50 rounded-2xl border border-white/5 backdrop-blur-sm shadow-2xl relative">
            {/* Header Row */}
            <div className="flex border-b border-white/5 bg-neutral-900/80 z-10">
                <div className="w-64 flex-shrink-0 p-4 font-medium text-neutral-400 border-r border-white/5 flex items-center">
                    Habit
                </div>
                <div className="flex overflow-x-auto scrollbar-hide">
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

            {/* Habit Rows */}
            <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {habits.map((habit) => (
                    <div key={habit.id} className="flex border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                        <div className="w-64 flex-shrink-0 p-4 border-r border-white/5 flex items-center justify-between group-hover:bg-white/[0.02] transition-colors relative">
                            <div className="flex flex-col">
                                <span className="font-medium text-neutral-200">{habit.name}</span>
                                {habit.goal.target && (
                                    <span className="text-xs text-neutral-500 mt-1">
                                        Goal: {habit.goal.target} {habit.goal.unit}
                                    </span>
                                )}
                            </div>

                            {/* Delete Button (Visible on Hover) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (deleteConfirmId === habit.id) {
                                        deleteHabit(habit.id);
                                        setDeleteConfirmId(null);
                                    } else {
                                        setDeleteConfirmId(habit.id);
                                        setTimeout(() => setDeleteConfirmId(null), 5000);
                                    }
                                }}
                                className={cn(
                                    "p-2 rounded-lg transition-all absolute right-2 opacity-0 group-hover:opacity-100 z-20",
                                    deleteConfirmId === habit.id
                                        ? "bg-red-500/20 text-red-400 opacity-100"
                                        : "hover:bg-neutral-800 text-neutral-500 hover:text-red-400"
                                )}
                                title={deleteConfirmId === habit.id ? "Click again to delete" : "Delete Habit"}
                            >
                                <Trash2 size={16} />
                            </button>
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
                                                    ? "bg-emerald-500 text-neutral-900 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-90"
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
                ))}

                {/* Add Habit Row */}
                <div className="flex border-b border-white/5">
                    <div className="w-64 flex-shrink-0 p-4 border-r border-white/5">
                        <button
                            onClick={onAddHabit}
                            className="flex items-center gap-2 text-neutral-500 hover:text-emerald-400 transition-colors text-sm font-medium"
                        >
                            <Plus size={16} />
                            Add New Habit
                        </button>
                    </div>
                    <div className="flex-1 bg-neutral-900/30" />
                </div>
            </div>

            <NumericInputPopover
                isOpen={popoverState.isOpen}
                onClose={() => setPopoverState(prev => ({ ...prev, isOpen: false }))}
                onSubmit={(val) => {
                    onUpdateValue(popoverState.habitId, popoverState.date, val);
                    setPopoverState(prev => ({ ...prev, isOpen: false }));
                }}
                initialValue={popoverState.initialValue}
                unit={popoverState.unit}
                position={popoverState.position}
            />
        </div>
    );
};
