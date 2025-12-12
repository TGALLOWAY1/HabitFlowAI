import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Plus } from 'lucide-react';
import { updateGoal } from '../../lib/persistenceClient';
import { useHabitStore } from '../../store/HabitContext';
import type { GoalWithProgress } from '../../models/persistenceTypes';
import { invalidateGoalCaches } from '../../lib/goalDataCache';
import { AddHabitModal } from '../AddHabitModal';

interface EditGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    goalWithProgress: GoalWithProgress;
    onSuccess?: () => void;
}

export const EditGoalModal: React.FC<EditGoalModalProps> = ({
    isOpen,
    onClose,
    goalWithProgress,
    onSuccess,
}) => {
    const { goal } = goalWithProgress;
    const { habits } = useHabitStore();

    // Form State
    const [title, setTitle] = useState(goal.title);
    const [description, setDescription] = useState(goal.notes || '');
    const [targetValue, setTargetValue] = useState(goal.targetValue?.toString() || '');
    const [unit, setUnit] = useState(goal.unit || '');
    const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>(goal.linkedHabitIds);
    const [deadline, setDeadline] = useState(goal.deadline || '');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAddHabitOpen, setIsAddHabitOpen] = useState(false);

    // Reset form when goal changes
    useEffect(() => {
        if (isOpen) {
            setTitle(goal.title);
            setDescription(goal.notes || '');
            setTargetValue(goal.targetValue?.toString() || '');
            setUnit(goal.unit || '');
            setSelectedHabitIds(goal.linkedHabitIds);
            setDeadline(goal.deadline || '');
            setError(null);
        }
    }, [isOpen, goal]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!title.trim()) {
            setError('Title is required');
            return;
        }

        const numTarget = parseFloat(targetValue);
        // Only validate target value for cumulative/frequency goals
        if (goal.type !== 'onetime' && (isNaN(numTarget) || numTarget <= 0)) {
            setError('Target value must be a positive number');
            return;
        }

        if (goal.type === 'onetime' && !deadline) {
            setError('Event Date is required for One-Time goals');
            return;
        }

        if (selectedHabitIds.length === 0) {
            setError('At least one habit must be linked');
            return;
        }

        setIsSubmitting(true);

        try {
            await updateGoal(goal.id, {
                title,
                notes: description,
                targetValue: goal.type === 'onetime' ? undefined : numTarget,
                unit: goal.type === 'onetime' ? undefined : unit,
                linkedHabitIds: selectedHabitIds,
                deadline: deadline || undefined,
            });

            // Invalidate cache
            invalidateGoalCaches(goal.id);

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update goal';
            setError(errorMessage);
            console.error('Error updating goal:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleHabitSelection = (habitId: string) => {
        if (selectedHabitIds.includes(habitId)) {
            setSelectedHabitIds(prev => prev.filter(id => id !== habitId));
        } else {
            setSelectedHabitIds(prev => [...prev, habitId]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-2xl flex flex-col max-h-[90vh] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white">Edit Goal</h3>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                    <form id="edit-goal-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Display */}
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                                <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                                <div className="flex-1">
                                    <div className="text-red-400 text-sm">{error}</div>
                                </div>
                            </div>
                        )}

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">
                                Goal Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                placeholder="e.g., Read 50 Books"
                            />
                        </div>

                        {/* Description (Notes) */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 min-h-[80px]"
                                placeholder="Why is this goal important?"
                            />
                        </div>

                        {/* Target & Deadline Params */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Target - Only for cumulative or frequency number goals */}
                            {goal.type !== 'onetime' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                                            Target Value
                                        </label>
                                        <input
                                            type="number"
                                            value={targetValue}
                                            onChange={(e) => setTargetValue(e.target.value)}
                                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                            min="1"
                                            step="any"
                                        />
                                    </div>

                                    {/* Unit */}
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                                            Unit Label
                                        </label>
                                        <input
                                            type="text"
                                            value={unit}
                                            onChange={(e) => setUnit(e.target.value)}
                                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                            placeholder="e.g., books, miles"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Deadline */}
                            <div className={goal.type === 'onetime' ? "sm:col-span-2" : "sm:col-span-2"}>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">
                                    {goal.type === 'onetime' ? 'Event Date' : 'Deadline (Optional)'}
                                </label>
                                <input
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    required={goal.type === 'onetime'}
                                />
                            </div>
                        </div>


                        {/* Habit Selector */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-neutral-300">
                                    Linked Habits
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsAddHabitOpen(true)}
                                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                                >
                                    <Plus size={12} />
                                    Create new habit
                                </button>
                            </div>
                            <p className="text-neutral-400 text-xs mb-3">
                                Select or unselect habits that contribute to this goal.
                            </p>

                            <div className="space-y-2 max-h-60 overflow-y-auto border border-white/5 rounded-lg p-2 bg-neutral-800/20">
                                {habits.length === 0 ? (
                                    <div className="text-neutral-500 text-sm p-2 text-center">No habits available.</div>
                                ) : (
                                    habits.map(habit => (
                                        <div
                                            key={habit.id}
                                            onClick={() => toggleHabitSelection(habit.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${selectedHabitIds.includes(habit.id)
                                                ? 'bg-emerald-500/10 border-emerald-500/50'
                                                : 'bg-neutral-800/50 border-transparent hover:bg-neutral-800'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${selectedHabitIds.includes(habit.id)
                                                ? 'bg-emerald-500 border-emerald-500'
                                                : 'border-neutral-500'
                                                }`}>
                                                {selectedHabitIds.includes(habit.id) && <Plus size={14} className="text-neutral-900" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-white text-sm font-medium">{habit.name}</div>
                                                <div className="text-neutral-400 text-xs">{habit.goal.frequency} • {habit.goal.target} {habit.goal.unit}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-neutral-900/50 rounded-b-2xl">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="edit-goal-form"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Nested Add Habit Modal */}
            <AddHabitModal
                isOpen={isAddHabitOpen}
                onClose={() => setIsAddHabitOpen(false)}
            />
        </div>
    );
};
