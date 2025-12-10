import React, { useState, useEffect } from 'react';
import { X, Shield, CheckCircle2, Calculator } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import type { Habit } from '../models/persistenceTypes';

interface AddHabitModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryId?: string;
    initialData?: Habit | null;
}

export const AddHabitModal: React.FC<AddHabitModalProps> = ({ isOpen, onClose, categoryId, initialData }) => {
    const { addHabit, updateHabit, categories } = useHabitStore();

    // Form State
    const [name, setName] = useState('');

    // Goal Configuration
    const [goalType, setGoalType] = useState<'boolean' | 'number'>('boolean');
    const [target, setTarget] = useState(''); // Numeric target (e.g. 50 reps or 3 times)
    const [unit, setUnit] = useState('');

    // Frequency
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'total'>('daily');

    // Assigned Days (Weekly)
    const [assignedDays, setAssignedDays] = useState<number[]>([]);

    // Scheduling
    const [scheduledTime, setScheduledTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('30');
    const [nonNegotiable, setNonNegotiable] = useState(false);

    // Metadata
    const [description, setDescription] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize/Reset
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit Mode
                setName(initialData.name);
                setGoalType(initialData.goal.type || 'boolean'); // Default to boolean if missing
                setTarget(initialData.goal.target ? String(initialData.goal.target) : '');
                setUnit(initialData.goal.unit || '');
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
                setGoalType('boolean');
                setTarget('');
                setUnit('');
                setFrequency('daily');
                setAssignedDays([]);
                setScheduledTime('');
                setDurationMinutes('30');
                setNonNegotiable(false);
                setDescription('');

                // Robust Category Selection Default
                if (categoryId && categories.some(c => c.id === categoryId)) {
                    // 1. Use passed categoryId if it exists in the list
                    setSelectedCategoryId(categoryId);
                } else if (categories.length > 0) {
                    // 2. Default to first category if passed ID is invalid or missing
                    setSelectedCategoryId(categories[0].id);
                } else {
                    // 3. Fallback (shouldn't happen if categories exist)
                    setSelectedCategoryId('');
                }
            }
        }
    }, [isOpen, initialData, categoryId, categories]);

    // Auto-sync target for Boolean Weekly habits
    useEffect(() => {
        if (frequency === 'weekly' && goalType === 'boolean') {
            // For boolean weekly habits, target is simply the number of days to complete it
            // If assigned days are selected, target = number of days
            if (assignedDays.length > 0) {
                setTarget(String(assignedDays.length));
            } else {
                // If no days selected yet, keep current target or default?
                // Better to clear it or let user type if we allowed typing, but we want to automate it.
                // If they haven't selected days, maybe target is 0 or empty?
                // Let's default to empty implies "Select days"
            }
        }
    }, [assignedDays, frequency, goalType]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            // Ensure target is set correctly for boolean weekly
            let finalTarget = target ? Number(target) : undefined;
            if (frequency === 'weekly' && goalType === 'boolean' && assignedDays.length > 0) {
                finalTarget = assignedDays.length;
            }

            const goalConfig = {
                type: goalType,
                target: finalTarget,
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
                await updateHabit(initialData.id, habitData);
            } else {
                await addHabit(habitData);
            }
            onClose();
        } catch (error) {
            console.error('Failed to save habit:', error);
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
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">
                        {isEditMode ? 'Edit Habit' : 'Add New Habit'}
                    </h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* 1. Basic Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Habit Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                placeholder="e.g., Morning Jog"
                                required
                            />
                        </div>

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
                    </div>

                    {/* 2. Frequency & Type */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-neutral-400">Tracking Style</label>

                        {/* Frequency Selector */}
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

                        {/* Goal Type Toggle */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => setGoalType('boolean')}
                                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${goalType === 'boolean'
                                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                    : 'bg-neutral-800 text-neutral-400 border-white/5 hover:bg-neutral-700'
                                    }`}
                            >
                                <CheckCircle2 size={16} />
                                Simple (Done/Not Done)
                            </button>
                            <button
                                type="button"
                                onClick={() => setGoalType('number')}
                                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${goalType === 'number'
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                                    : 'bg-neutral-800 text-neutral-400 border-white/5 hover:bg-neutral-700'
                                    }`}
                            >
                                <Calculator size={16} />
                                Numeric (Amount)
                            </button>
                        </div>
                    </div>

                    {/* 3. Specific Configuration based on Weekly/Type */}
                    {frequency === 'weekly' && (
                        <div className="space-y-4 pt-2 border-t border-white/5">
                            {/* Assigned Days */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">
                                    Assigned Days {goalType === 'boolean' && <span className="text-emerald-400">(Auto-calculates goal)</span>}
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
                            </div>

                            {/* Target Logic */}
                            {goalType === 'boolean' ? (
                                <div className="bg-neutral-800/50 rounded-lg p-3 border border-white/5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-neutral-400">Weekly Goal:</span>
                                        <span className="text-white font-medium">
                                            {assignedDays.length > 0 ? `${assignedDays.length} times / week` : 'Select days above'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                // Numeric Goal
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-400 mb-1">Weekly Target</label>
                                        <input
                                            type="number"
                                            value={target}
                                            onChange={(e) => setTarget(e.target.value)}
                                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                            placeholder="e.g. 50"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-400 mb-1">Unit</label>
                                        <input
                                            type="text"
                                            value={unit}
                                            onChange={(e) => setUnit(e.target.value)}
                                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                            placeholder="e.g. reps"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Time & Duration */}
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
                        </div>
                    )}

                    {/* 4. Configuration for Daily/Total (Legacy support mostly) */}
                    {frequency !== 'weekly' && (
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">
                                    {goalType === 'number' ? 'Target Amount' : 'Times per Day?'}
                                </label>
                                {goalType === 'boolean' ? (
                                    <div className="text-sm text-neutral-500 py-3 italic">
                                        Standard daily completion
                                    </div>
                                ) : (
                                    <input
                                        type="number"
                                        value={target}
                                        onChange={(e) => setTarget(e.target.value)}
                                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                        placeholder="e.g. 10"
                                        required
                                    />
                                )}
                            </div>
                            {goalType === 'number' && (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">Unit</label>
                                    <input
                                        type="text"
                                        value={unit}
                                        onChange={(e) => setUnit(e.target.value)}
                                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                        placeholder="e.g. pages"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* 5. Extras */}
                    <div className="space-y-4 pt-2 border-t border-white/5">
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

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Description (Optional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 h-20 resize-none"
                                placeholder="Add notes about your habit..."
                            />
                        </div>
                    </div>


                    {/* Actions */}
                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (frequency === 'weekly' && goalType === 'boolean' && assignedDays.length === 0)}
                            className="px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isEditMode ? 'Save Changes' : 'Create Habit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
