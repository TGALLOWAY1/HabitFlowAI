import React, { useState, useEffect, useMemo } from 'react';
import { X, Target, CalendarCheck, Check, Plus, Search, Loader2, AlertCircle } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import { createGoal } from '../lib/persistenceClient';
import { invalidateAllGoalCaches } from '../lib/goalDataCache';
import { HabitCreationInlineModal } from './HabitCreationInlineModal';

interface CreateGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({ isOpen, onClose }) => {
    const { habits, categories, addCategory } = useHabitStore();

    // Form state
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'cumulative' | 'onetime'>('cumulative');
    const [targetValue, setTargetValue] = useState('');
    const [unit, setUnit] = useState('');
    const [deadline, setDeadline] = useState('');
    const [categoryId, setCategoryId] = useState('');

    // Category creation state
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

    // Habit linking state
    const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateHabitOpen, setIsCreateHabitOpen] = useState(false);

    // Submission state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset all state when modal opens
    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setType('cumulative');
            setTargetValue('');
            setUnit('');
            setDeadline('');
            setCategoryId('');
            setIsCreatingCategory(false);
            setNewCategoryName('');
            setSelectedHabitIds(new Set());
            setSearchQuery('');
            setError(null);
        }
    }, [isOpen]);

    // Category lookup
    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => map.set(cat.id, cat.name));
        return map;
    }, [categories]);

    // Filtered habits
    const availableHabits = useMemo(() => {
        return habits
            .filter(h => !h.archived)
            .filter(h =>
                searchQuery === '' ||
                h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                categoryMap.get(h.categoryId)?.toLowerCase().includes(searchQuery.toLowerCase())
            );
    }, [habits, searchQuery, categoryMap]);

    // Validation
    const isFormValid = (() => {
        if (!title.trim()) return false;
        if (selectedHabitIds.size === 0) return false;
        if (type === 'cumulative') {
            return targetValue !== '' && !isNaN(parseFloat(targetValue)) && parseFloat(targetValue) > 0;
        }
        return true;
    })();

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        setIsSubmittingCategory(true);
        try {
            const newCat = await addCategory({
                name: newCategoryName.trim(),
                color: 'bg-emerald-500',
            });
            setCategoryId(newCat.id);
            setIsCreatingCategory(false);
            setNewCategoryName('');
        } catch (err) {
            console.error('Failed to create category:', err);
        } finally {
            setIsSubmittingCategory(false);
        }
    };

    const toggleHabit = (habitId: string) => {
        const next = new Set(selectedHabitIds);
        if (next.has(habitId)) {
            next.delete(habitId);
        } else {
            next.add(habitId);
        }
        setSelectedHabitIds(next);
    };

    const handleHabitCreated = (habitId: string) => {
        const next = new Set(selectedHabitIds);
        next.add(habitId);
        setSelectedHabitIds(next);
    };

    const getHabitTypeLabel = (goalType: 'boolean' | 'number'): string => {
        return goalType === 'boolean' ? 'Binary' : 'Quantified';
    };

    const handleSubmit = async () => {
        if (!isFormValid) return;

        let targetValueNum = parseFloat(targetValue);
        if (type === 'onetime') {
            targetValueNum = 1;
        } else if (isNaN(targetValueNum) || targetValueNum <= 0) {
            setError('Target value must be greater than 0.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await createGoal({
                title: title.trim(),
                type,
                targetValue: targetValueNum,
                unit: type !== 'onetime' ? (unit.trim() || undefined) : undefined,
                linkedHabitIds: Array.from(selectedHabitIds),
                deadline: deadline || undefined,
                categoryId: categoryId || undefined,
            });

            invalidateAllGoalCaches();
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create goal';
            setError(errorMessage);
            console.error('Error creating goal:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90dvh] h-[85vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-neutral-900 z-10">
                    <h2 className="text-xl font-bold text-white">Create Goal</h2>
                    <button
                        onClick={onClose}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white -mr-2"
                        aria-label="Close"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto modal-scroll p-8 space-y-8 min-h-0">

                    {/* Goal Title (FIRST) */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-400">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-lg placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            placeholder="e.g., Run a Marathon"
                            autoFocus
                        />
                    </div>

                    {/* Goal Type */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-400">Goal Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setType('cumulative')}
                                className={`p-4 rounded-xl border text-left transition-all relative ${type === 'cumulative'
                                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20'
                                    : 'bg-neutral-900/50 border-white/5 hover:border-white/10 hover:bg-neutral-800/50'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg inline-flex mb-3 ${type === 'cumulative' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
                                    <Target size={20} />
                                </div>
                                <div className="text-white font-medium mb-1">Cumulative</div>
                                <div className="text-xs text-neutral-400 leading-relaxed">
                                    Reach a specific total volume or number over time.
                                </div>
                                {type === 'cumulative' && (
                                    <div className="absolute top-3 right-3 text-emerald-500"><Check size={16} /></div>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setType('onetime')}
                                className={`p-4 rounded-xl border text-left transition-all relative ${type === 'onetime'
                                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20'
                                    : 'bg-neutral-900/50 border-white/5 hover:border-white/10 hover:bg-neutral-800/50'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg inline-flex mb-3 ${type === 'onetime' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
                                    <CalendarCheck size={20} />
                                </div>
                                <div className="text-white font-medium mb-1">One-Time Event</div>
                                <div className="text-xs text-neutral-400 leading-relaxed">
                                    Train for a specific event on a specific date.
                                </div>
                                {type === 'onetime' && (
                                    <div className="absolute top-3 right-3 text-emerald-500"><Check size={16} /></div>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Conditional Fields */}
                    {type !== 'onetime' ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-neutral-400">Target Value</label>
                                    <input
                                        type="number"
                                        value={targetValue}
                                        onChange={(e) => setTargetValue(e.target.value)}
                                        className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="e.g., 100"
                                        min="0.01"
                                        step="0.01"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-neutral-400">
                                        Unit <span className="text-neutral-500 font-normal">(Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={unit}
                                        onChange={(e) => setUnit(e.target.value)}
                                        className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="e.g., miles, sessions"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-neutral-400">
                                    Deadline <span className="text-neutral-500 font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-neutral-400">
                                Event Date <span className="text-neutral-500 font-normal">(Optional)</span>
                            </label>
                            <input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                min={new Date().toISOString().split('T')[0]}
                            />
                            <p className="text-xs text-neutral-500">Leave blank if you don't have a date in mind.</p>
                        </div>
                    )}

                    {/* Category (Optional) */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-400">
                            Category <span className="text-neutral-500 font-normal">(Optional)</span>
                        </label>

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
                            <select
                                value={categoryId}
                                onChange={(e) => {
                                    if (e.target.value === 'new') {
                                        setIsCreatingCategory(true);
                                    } else {
                                        setCategoryId(e.target.value);
                                    }
                                }}
                                className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            >
                                <option value="">-- No Category --</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                                <option disabled>──────────</option>
                                <option value="new">+ Create New Category</option>
                            </select>
                        )}
                    </div>

                    {/* Link Habits Section */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Link Habits</label>
                            <p className="text-xs text-neutral-500">
                                {type === 'onetime'
                                    ? 'Select preparation habits for this event'
                                    : 'Select habits that contribute to this goal'}
                            </p>
                        </div>

                        {/* Search + New Habit */}
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="Search habits or categories..."
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateHabitOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors"
                            >
                                <Plus size={18} />
                                New Habit
                            </button>
                        </div>

                        {/* Habit List */}
                        <div>
                            {availableHabits.length === 0 ? (
                                <div className="text-center py-12 text-neutral-500">
                                    {searchQuery ? 'No habits found matching your search.' : 'No habits available.'}
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {availableHabits.map((habit) => {
                                        const categoryName = categoryMap.get(habit.categoryId) || 'Unknown';
                                        const habitType = getHabitTypeLabel(habit.goal.type);
                                        const habitUnit = habit.goal.unit || '';

                                        return (
                                            <label
                                                key={habit.id}
                                                className="flex items-center gap-3 p-4 bg-neutral-800/50 border border-white/5 rounded-lg hover:bg-neutral-800/70 transition-colors cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedHabitIds.has(habit.id)}
                                                    onChange={() => toggleHabit(habit.id)}
                                                    className="w-5 h-5 rounded border-neutral-700 bg-neutral-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white font-medium mb-1">{habit.name}</div>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                                                        <span className="px-2 py-0.5 bg-neutral-700/50 rounded">{categoryName}</span>
                                                        <span className="px-2 py-0.5 bg-neutral-700/50 rounded">{habitType}</span>
                                                        {habitUnit && (
                                                            <span className="px-2 py-0.5 bg-neutral-700/50 rounded">{habitUnit}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-neutral-900 flex justify-between items-center">
                    <div>
                        {error ? (
                            <span className="text-red-400 text-sm flex items-center gap-2">
                                <AlertCircle size={16} />
                                {error}
                            </span>
                        ) : selectedHabitIds.size > 0 ? (
                            <span className="text-sm text-neutral-400">
                                {selectedHabitIds.size} {selectedHabitIds.size === 1 ? 'habit' : 'habits'} selected
                            </span>
                        ) : (
                            <span className="text-sm text-neutral-500">Select at least one habit</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!isFormValid || isSubmitting}
                            className={`px-6 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-emerald-500/20 ${
                                isFormValid && !isSubmitting
                                    ? 'bg-emerald-500 text-neutral-900 hover:bg-emerald-400'
                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none'
                            }`}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    Creating...
                                </span>
                            ) : (
                                'Create Goal'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Inline Habit Creation Modal */}
            <HabitCreationInlineModal
                isOpen={isCreateHabitOpen}
                onClose={() => setIsCreateHabitOpen(false)}
                onHabitCreated={handleHabitCreated}
                defaultCategoryId={categoryId || undefined}
            />
        </div>
    );
};
