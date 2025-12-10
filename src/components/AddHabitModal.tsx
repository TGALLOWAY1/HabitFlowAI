import React, { useState, useEffect } from 'react';
import { X, Shield, ShieldAlert } from 'lucide-react';
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

    // Frequency State: 'daily' | 'weekly' | 'total'
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'total'>('daily');

    // Assigned Days for Weekly habits (0=Sun, 6=Sat)
    const [assignedDays, setAssignedDays] = useState<number[]>([]);

    // Scheduled Time for Weekly habits
    const [scheduledTime, setScheduledTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('30');
    const [nonNegotiable, setNonNegotiable] = useState(false);
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || '');

    // Reset or Initialize form when opening
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit Mode
                setName(initialData.name);
                setTarget(initialData.goal.target ? String(initialData.goal.target) : '');
                setUnit(initialData.goal.unit || '');
                setFrequency(initialData.goal.frequency);
                setFrequency(initialData.goal.frequency);
                setAssignedDays(initialData.assignedDays || []);
                setScheduledTime(initialData.scheduledTime || '');
                setDurationMinutes(initialData.durationMinutes?.toString() || '30');
                setNonNegotiable(initialData.nonNegotiable || false);
                setDescription(initialData.description || '');
                setSelectedCategoryId(initialData.categoryId);
            } else {
                // Add Mode
                setName('');
                setTarget('');
                setUnit('');
                setFrequency('daily');
                setAssignedDays([]);
                setScheduledTime('');
                setDurationMinutes('30');
                setNonNegotiable(false);
                setDescription('');
                if (categoryId) setSelectedCategoryId(categoryId);
                else if (categories.length > 0) setSelectedCategoryId(categories[0].id);
            }
        }
    }, [isOpen, initialData, categoryId, categories]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            const goalConfig = {
                type: (target ? 'number' : 'boolean') as 'number' | 'boolean',
                target: target ? Number(target) : undefined,
                unit: unit || undefined,
                frequency: frequency,
            };

            const habitData = {
                name,
                categoryId: selectedCategoryId,
                goal: goalConfig,
                assignedDays: frequency === 'weekly' ? assignedDays : undefined,
                scheduledTime: frequency === 'weekly' && scheduledTime ? scheduledTime : undefined,
                durationMinutes: frequency === 'weekly' && durationMinutes ? Number(durationMinutes) : undefined,
                nonNegotiable,
                description: description || undefined,
            };

            if (initialData) {
                // Update existing
                await updateHabit(initialData.id, habitData);
            } else {
                // Create new
                await addHabit(habitData);
            }
            onClose();
        } catch (error) {
            console.error('Failed to save habit:', error);
            // Optionally keep the modal open or show an error message
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleAssignedDay = (dayIndex: number) => {
        setAssignedDays(prev =>
            prev.includes(dayIndex)
                ? prev.filter(d => d !== dayIndex)
                : [...prev, dayIndex].sort()
        );
    };

    const isEditMode = !!initialData;
    const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

                    {/* Non-Negotiable Toggle */}
                    <div className="bg-neutral-800/50 border border-white/5 rounded-lg p-3 flex items-center justify-between group cursor-pointer hover:bg-neutral-800 transition-colors"
                        onClick={() => setNonNegotiable(!nonNegotiable)}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg transition-colors ${nonNegotiable ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-700/50 text-neutral-500'}`}>
                                <Shield size={20} />
                            </div>
                            <div>
                                <h4 className={`font-medium transition-colors ${nonNegotiable ? 'text-yellow-400' : 'text-neutral-300'}`}>Non-Negotiable</h4>
                                <p className="text-xs text-neutral-500">Essential habit. Highlighted with a Priority Ring.</p>
                            </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${nonNegotiable ? 'bg-yellow-500' : 'bg-neutral-700'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${nonNegotiable ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
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

                    {/* Frequency Selection */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Tracking Frequency</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['daily', 'weekly', 'total'] as const).map((freq) => (
                                <button
                                    key={freq}
                                    type="button"
                                    onClick={() => setFrequency(freq)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${frequency === freq
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                                        : 'bg-neutral-800 text-neutral-400 border-white/5 hover:bg-neutral-700'
                                        }`}
                                >
                                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Goal Configuration */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">
                                {frequency === 'weekly' ? 'Times per Week' : 'Target (Optional)'}
                            </label>
                            <input
                                type="number"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                placeholder={frequency === 'weekly' ? "e.g., 3" : "e.g., 30"}
                                required={frequency === 'weekly'} // Required for weekly quota
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Unit</label>
                            <input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                placeholder={frequency === 'weekly' ? "e.g., times" : "e.g., mins"}
                            />
                        </div>
                    </div>

                    {/* Assigned Days (Weekly Only) */}
                    {frequency === 'weekly' && (
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                                Assigned Days (Optional Calendar View)
                            </label>
                            <div className="flex justify-between gap-1">
                                {daysOfWeek.map((day, index) => {
                                    const isSelected = assignedDays.includes(index);
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => toggleAssignedDay(index)}
                                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${isSelected
                                                ? 'bg-emerald-500 text-neutral-900 shadow-lg shadow-emerald-500/20'
                                                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-neutral-500 mt-2">
                                * These days will show up on your calendar, but you can complete the habit on any day.
                            </p>
                        </div>
                    )}

                    {/* Time & Duration (Weekly Only) */}
                    {frequency === 'weekly' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">Preferred Time</label>
                                <input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">Duration (mins)</label>
                                <input
                                    type="number"
                                    min="5"
                                    step="5"
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(e.target.value)}
                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Description (Optional) */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">Description (Optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 h-24 resize-none"
                            placeholder="Add notes about your habit..."
                        />
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
