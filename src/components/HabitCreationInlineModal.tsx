import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';

interface HabitCreationInlineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onHabitCreated: (habitId: string) => void;
}

export const HabitCreationInlineModal: React.FC<HabitCreationInlineModalProps> = ({
    isOpen,
    onClose,
    onHabitCreated,
}) => {
    const { addHabit, categories } = useHabitStore();
    const [name, setName] = useState('');
    const [type, setType] = useState<'binary' | 'quantified'>('binary');
    const [target, setTarget] = useState('');
    const [unit, setUnit] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            return;
        }

        if (!categoryId) {
            return;
        }

        try {
            const newHabit = await addHabit({
                categoryId,
                name: name.trim(),
                goal: {
                    type: type === 'quantified' ? 'number' : 'boolean',
                    target: type === 'quantified' && target ? Number(target) : undefined,
                    unit: type === 'quantified' && unit ? unit.trim() : undefined,
                    frequency: 'daily', // Default to daily for inline creation
                },
                // Note: imageUrl is not saved as the backend Habit model doesn't support it yet
                // The field is kept in the UI for future backend support
            });

            // Auto-select the newly created habit
            onHabitCreated(newHabit.id);

            // Reset form
            setName('');
            setType('binary');
            setTarget('');
            setUnit('');
            setCategoryId('');
            setImageUrl('');
            
            onClose();
        } catch (error) {
            console.error('Failed to create habit:', error);
            // Don't close modal on error so user can retry
        }
    };

    const handleCancel = () => {
        // Reset form
        setName('');
        setType('binary');
        setTarget('');
        setUnit('');
        setCategoryId('');
        setImageUrl('');
        onClose();
    };

    const isFormValid = name.trim().length > 0 && 
                       categoryId !== '' &&
                       (type === 'binary' || (type === 'quantified' && target !== '' && !isNaN(parseFloat(target)) && parseFloat(target) > 0));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Create New Habit</h3>
                    <button onClick={handleCancel} className="text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title/Name */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">
                            Habit Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                            placeholder="e.g., Morning Run"
                            required
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">
                            Type <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={type}
                            onChange={(e) => {
                                setType(e.target.value as 'binary' | 'quantified');
                                // Clear target and unit when switching to binary
                                if (e.target.value === 'binary') {
                                    setTarget('');
                                    setUnit('');
                                }
                            }}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                        >
                            <option value="binary">Binary</option>
                            <option value="quantified">Quantified</option>
                        </select>
                    </div>

                    {/* Target (only for quantified) */}
                    {type === 'quantified' && (
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">
                                Target Value <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                placeholder="e.g., 30"
                                min="0.01"
                                step="0.01"
                                required
                            />
                        </div>
                    )}

                    {/* Unit (only for quantified) */}
                    {type === 'quantified' && (
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">
                                Unit <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                placeholder="e.g., minutes, miles, glasses"
                                required
                            />
                        </div>
                    )}

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">
                            Category <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                            required
                        >
                            <option value="">Select a category...</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Icon/Image (Optional) */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">
                            Icon/Image URL <span className="text-neutral-500">(Optional)</span>
                        </label>
                        <input
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                            placeholder="https://example.com/image.png"
                        />
                        <p className="mt-1 text-xs text-neutral-500">
                            URL to an icon or image for this habit
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isFormValid}
                            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                                isFormValid
                                    ? 'bg-emerald-500 text-neutral-900 hover:bg-emerald-400'
                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            }`}
                        >
                            Create Habit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
