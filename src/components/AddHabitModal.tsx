import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';

interface AddHabitModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryId: string;
}

export const AddHabitModal: React.FC<AddHabitModalProps> = ({ isOpen, onClose, categoryId }) => {
    const { addHabit } = useHabitStore();
    const [name, setName] = useState('');
    const [target, setTarget] = useState('');
    const [unit, setUnit] = useState('');
    const [isCumulative, setIsCumulative] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addHabit({
                categoryId,
                name,
                goal: {
                    type: target ? 'number' : 'boolean',
                    target: target ? Number(target) : undefined,
                    unit: unit || undefined,
                    frequency: isCumulative ? 'total' : 'daily',
                },
            });
            onClose();
            setName('');
            setTarget('');
            setUnit('');
            setIsCumulative(false);
        } catch (error) {
            console.error('Failed to add habit:', error);
            // Still close modal even if API fails (fallback to localStorage)
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Add New Habit</h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                            <span>Is this a cumulative goal? (e.g. Run 100 miles total)</span>
                        </label>
                    </div>

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
                            Create Habit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
