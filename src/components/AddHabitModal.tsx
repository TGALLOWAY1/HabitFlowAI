import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import type { Habit } from '../models/persistenceTypes';

interface AddHabitModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryId?: string; // Optional now, as we might default to first category or use initialData
    initialData?: Habit | null; // If provided, we are in Edit mode
}

export const AddHabitModal: React.FC<AddHabitModalProps> = ({ isOpen, onClose, categoryId, initialData }) => {
    const { addHabit, updateHabit, categories } = useHabitStore();

    // Form State
    const [name, setName] = useState('');
    const [target, setTarget] = useState('');
    const [unit, setUnit] = useState('');
    const [isCumulative, setIsCumulative] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || '');

    // Reset or Initialize form when opening
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit Mode
                setName(initialData.name);
                setTarget(initialData.goal.target ? String(initialData.goal.target) : '');
                setUnit(initialData.goal.unit || '');
                setIsCumulative(initialData.goal.frequency === 'total');
                setSelectedCategoryId(initialData.categoryId);
            } else {
                // Add Mode
                setName('');
                setTarget('');
                setUnit('');
                setIsCumulative(false);
                if (categoryId) setSelectedCategoryId(categoryId);
                else if (categories.length > 0) setSelectedCategoryId(categories[0].id);
            }
        }
    }, [isOpen, initialData, categoryId, categories]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const goalConfig = {
                type: (target ? 'number' : 'boolean') as 'number' | 'boolean',
                target: target ? Number(target) : undefined,
                unit: unit || undefined,
                frequency: (isCumulative ? 'total' : 'daily') as 'total' | 'daily',
            };

            if (initialData) {
                // Update existing
                await updateHabit(initialData.id, {
                    name,
                    categoryId: selectedCategoryId,
                    goal: goalConfig,
                });
            } else {
                // Create new
                await addHabit({
                    categoryId: selectedCategoryId,
                    name,
                    goal: goalConfig,
                });
            }
            onClose();
        } catch (error) {
            console.error('Failed to save habit:', error);
            onClose();
        }
    };

    const isEditMode = !!initialData;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">
                        {isEditMode ? 'Edit Habit' : 'Add New Habit'}
                    </h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">Habit Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                            placeholder="e.g., Read Books"
                            required
                        />
                    </div>

                    {/* Category Selection */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">Category</label>
                        <select
                            value={selectedCategoryId}
                            onChange={(e) => setSelectedCategoryId(e.target.value)}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 appearance-none"
                        >
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Goal Configuration */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Target (Optional)</label>
                            <input
                                type="number"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                placeholder="e.g., 30"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Unit</label>
                            <input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                placeholder="e.g., mins"
                            />
                        </div>
                    </div>

                    {/* Cumulative Toggle */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-neutral-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isCumulative}
                                className="rounded border-neutral-700 bg-neutral-800 text-emerald-500 focus:ring-emerald-500"
                                onChange={(e) => {
                                    setIsCumulative(e.target.checked);
                                }}
                            />
                            <span>Is this a cumulative goal? <span className="text-neutral-500 text-xs">(e.g. Run 100 miles total)</span></span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors"
                        >
                            {isEditMode ? 'Save Changes' : 'Create Habit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
