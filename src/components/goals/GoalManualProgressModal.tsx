import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, AlertCircle, Check } from 'lucide-react';
import { createGoalManualLog } from '../../lib/persistenceClient';
import { invalidateGoalCaches } from '../../lib/goalDataCache';
import { useHabitStore } from '../../store/HabitContext';
import type { GoalWithProgress } from '../../models/persistenceTypes';

interface GoalManualProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    goalWithProgress: GoalWithProgress;
    onSuccess?: () => void;
}

export const GoalManualProgressModal: React.FC<GoalManualProgressModalProps> = ({
    isOpen,
    onClose,
    goalWithProgress,
    onSuccess,
}) => {
    const { goal } = goalWithProgress;
    const { habits, logs, toggleHabit } = useHabitStore();

    // State
    const [value, setValue] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Today's date in YYYY-MM-DD

    // For boolean/habit goals: map of habitId -> isChecked
    const [habitSelections, setHabitSelections] = useState<Record<string, boolean>>({});

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get linked habit objects
    const linkedHabits = useMemo(() => {
        return goal.linkedHabitIds
            .map(id => habits.find(h => h.id === id))
            .filter((h): h is NonNullable<typeof h> => h !== undefined);
    }, [goal.linkedHabitIds, habits]);

    // On mount or date change, populate habit selections based on existing logs
    useEffect(() => {
        if (!isOpen) return;

        const newSelections: Record<string, boolean> = {};
        linkedHabits.forEach(habit => {
            const logKey = `${habit.id}-${date}`;
            const log = logs[logKey];
            newSelections[habit.id] = !!log?.completed;
        });
        setHabitSelections(newSelections);
    }, [isOpen, date, linkedHabits, logs]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            // Mode 1: Cumulative Goal (Numeric Input)
            if (goal.type === 'cumulative') {
                const numValue = parseFloat(value);
                if (isNaN(numValue) || numValue <= 0) {
                    throw new Error('Amount must be a positive number');
                }

                const loggedAt = new Date(date + 'T23:59:59').toISOString();
                await createGoalManualLog(goal.id, {
                    value: numValue,
                    loggedAt,
                });
            }
            // Mode 2: Frequency Goal (Habit Check-ins)
            else {
                // Determine which habits need toggling
                // We compare current selection state vs actual log state
                const promises: Promise<void>[] = [];

                linkedHabits.forEach(habit => {
                    const isSelected = habitSelections[habit.id];
                    const logKey = `${habit.id}-${date}`;
                    const hasLog = !!logs[logKey]?.completed;

                    // If selection differs from actual log, we need to toggle
                    if (isSelected !== hasLog) {
                        promises.push(toggleHabit(habit.id, date));
                    }
                });

                await Promise.all(promises);
            }

            // Invalidate goal caches since progress changed
            invalidateGoalCaches(goal.id);

            // Reset form
            setValue('');
            setDate(new Date().toISOString().split('T')[0]);
            setError(null);

            // Call success callback
            if (onSuccess) {
                onSuccess();
            }

            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to log progress';
            setError(errorMessage);
            console.error('Error logging progress:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setValue('');
        setDate(new Date().toISOString().split('T')[0]);
        setError(null);
        onClose();
    };

    const toggleSelection = (habitId: string) => {
        setHabitSelections(prev => ({
            ...prev,
            [habitId]: !prev[habitId]
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">
                        {goal.type === 'cumulative' ? 'Log Manual Progress' : 'Update Habit Progress'}
                    </h3>
                    <button
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Error Display */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                            <div className="flex-1">
                                <div className="text-red-400 text-sm">{error}</div>
                            </div>
                        </div>
                    )}

                    {/* Date Input */}
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-neutral-300 mb-2">
                            Date
                        </label>
                        <input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    {/* Dynamic Content Based on Goal Type */}
                    {goal.type === 'cumulative' ? (
                        /* Numeric Input for Cumulative Goals */
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-neutral-300 mb-2">
                                Amount {goal.unit && `(${goal.unit})`}
                            </label>
                            <input
                                id="amount"
                                type="number"
                                step="any"
                                min="0.01"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                disabled={isSubmitting}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    ) : (
                        /* Checklist for Frequency/Boolean Goals */
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">
                                Linked Habits
                            </label>
                            <div className="space-y-2 max-h-60 overflow-y-auto border border-white/5 rounded-lg p-2 bg-neutral-800/20">
                                {linkedHabits.length === 0 ? (
                                    <div className="text-neutral-500 text-sm p-2 text-center">No linked habits found.</div>
                                ) : (
                                    linkedHabits.map(habit => (
                                        <div
                                            key={habit.id}
                                            onClick={() => !isSubmitting && toggleSelection(habit.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${habitSelections[habit.id]
                                                    ? 'bg-emerald-500/10 border-emerald-500/50'
                                                    : 'bg-neutral-800/50 border-transparent hover:bg-neutral-800'
                                                } ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}
                                        >
                                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${habitSelections[habit.id]
                                                    ? 'bg-emerald-500 text-neutral-900'
                                                    : 'bg-neutral-700 text-transparent'
                                                }`}>
                                                <Check size={14} strokeWidth={3} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-white text-sm font-medium">{habit.name}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (goal.type === 'cumulative' && !value)}
                            className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Saving...
                                </>
                            ) : (
                                'Save Progress'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
