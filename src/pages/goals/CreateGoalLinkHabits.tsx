import React, { useState, useMemo } from 'react';
import { Search, ArrowRight, Plus } from 'lucide-react';
import { useHabitStore } from '../../store/HabitContext';
import { HabitCreationInlineModal } from '../../components/HabitCreationInlineModal';

interface GoalDraft {
    title: string;
    type: 'cumulative' | 'frequency' | 'onetime';
    targetValue: number;
    unit?: string;
    deadline?: string;
}

interface CreateGoalLinkHabitsProps {
    goalDraft: GoalDraft;
    onNext?: (selectedHabitIds: string[]) => void;
    onBack?: () => void;
    isSubmitting?: boolean;
}

export const CreateGoalLinkHabits: React.FC<CreateGoalLinkHabitsProps> = ({
    goalDraft,
    onNext,
    onBack,
    isSubmitting = false,
}) => {
    const { habits, categories } = useHabitStore();
    const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Create category lookup map
    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => map.set(cat.id, cat.name));
        return map;
    }, [categories]);

    // Filter out archived habits and apply search
    const availableHabits = useMemo(() => {
        return habits
            .filter(h => !h.archived)
            .filter(h =>
                searchQuery === '' ||
                h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                categoryMap.get(h.categoryId)?.toLowerCase().includes(searchQuery.toLowerCase())
            );
    }, [habits, searchQuery, categoryMap]);

    const toggleHabit = (habitId: string) => {
        const newSelected = new Set(selectedHabitIds);
        if (newSelected.has(habitId)) {
            newSelected.delete(habitId);
        } else {
            newSelected.add(habitId);
        }
        setSelectedHabitIds(newSelected);
    };

    const handleNext = () => {
        if (onNext) {
            onNext(Array.from(selectedHabitIds));
        }
    };

    const handleHabitCreated = (habitId: string) => {
        // Auto-select the newly created habit
        const newSelected = new Set(selectedHabitIds);
        newSelected.add(habitId);
        setSelectedHabitIds(newSelected);
    };

    const getHabitTypeLabel = (goalType: 'boolean' | 'number'): string => {
        return goalType === 'boolean' ? 'Binary' : 'Quantified';
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Link Habits</h1>
                <p className="text-neutral-400">
                    {goalDraft.type === 'onetime'
                        ? 'Select preparation habits for this event'
                        : 'Select habits that contribute to this goal'}
                </p>
            </div>

            {/* Goal Summary */}
            <div className="mb-6 p-4 bg-neutral-800/50 border border-white/10 rounded-lg">
                <div className="text-sm text-neutral-400 mb-1">Goal</div>
                <div className="text-white font-medium">{goalDraft.title}</div>
                <div className="text-xs text-neutral-500 mt-1 capitalize">
                    {goalDraft.type === 'onetime'
                        ? `One-Time Event${goalDraft.deadline ? ` • ${goalDraft.deadline}` : ''}`
                        : `${goalDraft.type} • Target: ${goalDraft.targetValue} ${goalDraft.unit || ''}`}
                </div>
            </div>

            {/* Search and Create Button */}
            <div className="mb-6 flex gap-3">
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
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    New Habit
                </button>
            </div>

            {/* Habit List */}
            <div className="mb-6">
                {availableHabits.length === 0 ? (
                    <div className="text-center py-12 text-neutral-500">
                        {searchQuery ? 'No habits found matching your search.' : 'No habits available.'}
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {availableHabits.map((habit) => {
                            const categoryName = categoryMap.get(habit.categoryId) || 'Unknown';
                            const habitType = getHabitTypeLabel(habit.goal.type);
                            const unit = habit.goal.unit || '';

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
                                            <span className="px-2 py-0.5 bg-neutral-700/50 rounded">
                                                {categoryName}
                                            </span>
                                            <span className="px-2 py-0.5 bg-neutral-700/50 rounded">
                                                {habitType}
                                            </span>
                                            {unit && (
                                                <span className="px-2 py-0.5 bg-neutral-700/50 rounded">
                                                    {unit}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="text-sm text-neutral-400">
                    {selectedHabitIds.size > 0 ? (
                        <span>{selectedHabitIds.size} {selectedHabitIds.size === 1 ? 'habit' : 'habits'} selected</span>
                    ) : (
                        <span>Select at least one habit</span>
                    )}
                </div>
                <div className="flex gap-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Back
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={selectedHabitIds.size === 0 || isSubmitting}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${selectedHabitIds.size > 0 && !isSubmitting
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-900'
                                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            }`}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Goal'}
                        {!isSubmitting && <ArrowRight size={18} />}
                    </button>
                </div>
            </div>

            {/* Inline Habit Creation Modal */}
            <HabitCreationInlineModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onHabitCreated={handleHabitCreated}
            />
        </div>
    );
};
