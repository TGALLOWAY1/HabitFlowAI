import React, { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import type { ActivityStep } from '../types';

interface CreateActivityFromHabitsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (prefillSteps: ActivityStep[]) => void;
}

export const CreateActivityFromHabitsModal: React.FC<CreateActivityFromHabitsModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
}) => {
    const { habits } = useHabitStore();
    const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Filter out archived habits and apply search
    const availableHabits = useMemo(() => {
        return habits
            .filter(h => !h.archived)
            .filter(h => 
                searchQuery === '' || 
                h.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
    }, [habits, searchQuery]);

    if (!isOpen) return null;

    const toggleHabit = (habitId: string) => {
        const newSelected = new Set(selectedHabitIds);
        if (newSelected.has(habitId)) {
            newSelected.delete(habitId);
        } else {
            newSelected.add(habitId);
        }
        setSelectedHabitIds(newSelected);
    };

    const handleConfirm = () => {
        const selectedHabits = habits.filter(h => selectedHabitIds.has(h.id));
        const prefillSteps: ActivityStep[] = selectedHabits.map(habit => ({
            id: crypto.randomUUID(),
            type: 'habit',
            title: habit.name,
            habitId: habit.id,
            instruction: '',
            imageUrl: undefined,
            timeEstimateMinutes: undefined,
        }));
        onConfirm(prefillSteps);
        onClose();
        // Reset state
        setSelectedHabitIds(new Set());
        setSearchQuery('');
    };

    const handleCancel = () => {
        onClose();
        // Reset state
        setSelectedHabitIds(new Set());
        setSearchQuery('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[80vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white">Create Activity from Habits</h3>
                    <button onClick={handleCancel} className="text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-6 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                            placeholder="Search habits..."
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {availableHabits.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500">
                            {searchQuery ? 'No habits found matching your search.' : 'No habits available.'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {availableHabits.map((habit) => (
                                <label
                                    key={habit.id}
                                    className="flex items-center gap-3 p-3 bg-neutral-800/50 border border-white/5 rounded-lg hover:bg-neutral-800/70 transition-colors cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedHabitIds.has(habit.id)}
                                        onChange={() => toggleHabit(habit.id)}
                                        className="w-5 h-5 rounded border-neutral-700 bg-neutral-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <div className="flex-1">
                                        <div className="text-white font-medium">{habit.name}</div>
                                        {habit.description && (
                                            <div className="text-sm text-neutral-400 mt-1">{habit.description}</div>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex items-center justify-between">
                    <div className="text-sm text-neutral-400">
                        {selectedHabitIds.size > 0 ? (
                            <span>{selectedHabitIds.size} {selectedHabitIds.size === 1 ? 'habit' : 'habits'} selected</span>
                        ) : (
                            <span>Select habits to add as steps</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={selectedHabitIds.size === 0}
                            className="px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
