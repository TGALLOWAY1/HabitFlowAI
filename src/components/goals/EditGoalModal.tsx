import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, AlertCircle, Plus, Folder, Search, Filter } from 'lucide-react';
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
    const { habits, categories, addCategory } = useHabitStore();

    // Form State
    const [title, setTitle] = useState(goal.title);
    const [description, setDescription] = useState(goal.notes || '');
    const [targetValue, setTargetValue] = useState(goal.targetValue?.toString() || '');
    const [unit, setUnit] = useState(goal.unit || '');
    const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>(goal.linkedHabitIds);
    const [deadline, setDeadline] = useState(goal.deadline || '');

    // Category State
    const [categoryId, setCategoryId] = useState(goal.categoryId || '');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

    // Filter State
    const [habitSearch, setHabitSearch] = useState('');
    const [filterByGoalCategory, setFilterByGoalCategory] = useState(true);

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
            setCategoryId(goal.categoryId || '');
            setError(null);
            setHabitSearch('');
            setFilterByGoalCategory(true);
        }
    }, [isOpen, goal]);

    // Filtered Habits Logic (Moved above early return to satisfy Rules of Hooks)
    const displayedHabits = useMemo(() => {
        let filtered = habits;

        // 1. Text Search
        if (habitSearch.trim()) {
            const query = habitSearch.toLowerCase();
            filtered = filtered.filter(h =>
                h.name.toLowerCase().includes(query)
            );
        }

        // 2. Category Filter
        if (filterByGoalCategory && categoryId) {
            filtered = filtered.filter(h => h.categoryId === categoryId);
        }

        return filtered;
    }, [habits, habitSearch, categoryId, filterByGoalCategory]);

    if (!isOpen) return null;

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;

        setIsSubmittingCategory(true);
        try {
            const newCat = await addCategory({
                name: newCategoryName.trim(),
                color: 'bg-emerald-500' // Default color
            });

            setCategoryId(newCat.id); // Auto-select new category
            setIsCreatingCategory(false);
            setNewCategoryName('');
        } catch (err) {
            console.error('Failed to create category inline:', err);
        } finally {
            setIsSubmittingCategory(false);
        }
    };

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

        // --- FIX FOR GHOST HABIT IDs ---
        // Filter out any IDs that don't exist in the current habits list.
        // This removes deleted/stale habits that cause backend validation errors.
        // We only filter if we have loaded habits to avoid accidental clearing.
        let validSelectedIds = selectedHabitIds;
        if (habits.length > 0) {
            validSelectedIds = selectedHabitIds.filter(id => habits.some(h => h.id === id));
        }

        if (validSelectedIds.length === 0) {
            setError('At least one valid habit must be linked');
            return;
        }

        setIsSubmitting(true);

        try {
            await updateGoal(goal.id, {
                title,
                notes: description,
                targetValue: goal.type === 'onetime' ? undefined : numTarget,
                unit: goal.type === 'onetime' ? undefined : unit,
                linkedHabitIds: validSelectedIds, // Use sanitized IDs
                deadline: deadline || undefined,
                categoryId: categoryId || undefined,
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

                        {/* Category Selection */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-medium text-neutral-300">
                                    Category <span className="text-neutral-500 font-normal">(Optional, for Skill Tree)</span>
                                </label>
                                {!isCreatingCategory && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingCategory(true)}
                                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                                    >
                                        <Plus size={12} />
                                        New Category
                                    </button>
                                )}
                            </div>

                            {isCreatingCategory ? (
                                <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="New category name..."
                                        className="flex-1 bg-neutral-900 border border-emerald-500/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleCreateCategory();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCreateCategory}
                                        disabled={!newCategoryName.trim() || isSubmittingCategory}
                                        className="bg-emerald-500 hover:bg-emerald-400 text-neutral-900 px-4 rounded-xl font-medium transition-colors disabled:opacity-50"
                                    >
                                        {isSubmittingCategory ? '...' : 'Save'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCreatingCategory(false);
                                            setNewCategoryName('');
                                        }}
                                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-400 px-3 rounded-xl transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={categoryId}
                                        onChange={(e) => {
                                            if (e.target.value === 'new') {
                                                setIsCreatingCategory(true);
                                            } else {
                                                setCategoryId(e.target.value);
                                            }
                                        }}
                                        className="w-full bg-neutral-800 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                                    >
                                        <option value="">Select a Category...</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                        <option disabled>──────────</option>
                                        <option value="new">+ Create New Category</option>
                                    </select>
                                    <div className="absolute left-3 top-3.5 text-neutral-500 pointer-events-none">
                                        <Folder size={20} />
                                    </div>
                                </div>
                            )}
                        </div>

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
                            <div className="flex items-center justify-between mb-4">
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

                            {/* Filter Bar */}
                            <div className="flex gap-2 mb-3">
                                <div className="relative flex-1">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                                    <input
                                        type="text"
                                        value={habitSearch}
                                        onChange={(e) => setHabitSearch(e.target.value)}
                                        placeholder="Search habits..."
                                        className="w-full bg-neutral-800/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
                                    />
                                    {habitSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setHabitSearch('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                {categoryId && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterByGoalCategory(!filterByGoalCategory)}
                                        className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors ${filterByGoalCategory
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                                : 'bg-neutral-800/50 border-white/10 text-neutral-400 hover:bg-neutral-800'
                                            }`}
                                        title="Only show habits in this goal's category"
                                    >
                                        <Filter size={14} />
                                        Match Category
                                    </button>
                                )}
                            </div>

                            <p className="text-neutral-400 text-xs mb-3">
                                {displayedHabits.length} habit{displayedHabits.length !== 1 ? 's' : ''} available
                                {filterByGoalCategory && categoryId && ' (filtered by category)'}
                            </p>

                            <div className="space-y-2 max-h-60 overflow-y-auto border border-white/5 rounded-lg p-2 bg-neutral-800/20">
                                {displayedHabits.length === 0 ? (
                                    <div className="text-neutral-500 text-sm p-4 text-center flex flex-col items-center gap-2">
                                        <Search size={24} className="opacity-20" />
                                        <p>No habits found matching your filters.</p>
                                        {(habitSearch || filterByGoalCategory) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setHabitSearch('');
                                                    setFilterByGoalCategory(false);
                                                }}
                                                className="text-emerald-400 text-xs hover:underline"
                                            >
                                                Clear all filters
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    displayedHabits.map(habit => (
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
                                            {/* Category Tag (Visual confirmation) */}
                                            {categories.find(c => c.id === habit.categoryId) && (
                                                <div className="text-[10px] px-2 py-0.5 rounded bg-neutral-700 text-neutral-300">
                                                    {categories.find(c => c.id === habit.categoryId)?.name}
                                                </div>
                                            )}
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
