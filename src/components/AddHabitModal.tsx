import React, { useState, useEffect } from 'react';
import { X, Shield, CheckCircle2, Calculator, Layers, CheckSquare, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import type { Habit } from '../models/persistenceTypes';

interface AddHabitModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryId?: string;
    initialData?: Habit | null;
}

export const AddHabitModal: React.FC<AddHabitModalProps> = ({ isOpen, onClose, categoryId, initialData }) => {
    const { addHabit, updateHabit, categories, habits } = useHabitStore();

    // Form State
    const [name, setName] = useState('');
    const [habitType, setHabitType] = useState<'regular' | 'bundle'>('regular');
    // Bundle State
    const [subHabitIds, setSubHabitIds] = useState<string[]>([]);
    const [showSubHabitSelect, setShowSubHabitSelect] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Pending Sub-Habits (New ones to be created)
    const [pendingSubHabits, setPendingSubHabits] = useState<Array<{
        tempId: string;
        name: string;
        goalType: 'boolean' | 'number';
        target: string;
        unit: string;
    }>>([]);
    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitGoalType, setNewHabitGoalType] = useState<'boolean' | 'number'>('boolean');
    const [newHabitTarget, setNewHabitTarget] = useState('');
    const [newHabitUnit, setNewHabitUnit] = useState('');

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
                setHabitType(initialData.type === 'bundle' ? 'bundle' : 'regular');
                setSubHabitIds(initialData.subHabitIds || []);
                setPendingSubHabits([]); // Clear pending on open

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
                setHabitType('regular');
                setSubHabitIds([]);
                setPendingSubHabits([]); // Clear pending on open
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

    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

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

            // For bundles, minimal goal config
            const goalConfig = habitType === 'bundle' ? {
                type: 'boolean' as const,
                frequency: frequency,
                target: frequency === 'weekly' ? assignedDays.length : 1
            } : {
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
                type: habitType === 'bundle' ? 'bundle' as const : undefined,
                subHabitIds: habitType === 'bundle' ? subHabitIds : undefined,
            };

            let savedHabit: Habit;
            if (initialData) {
                savedHabit = await updateHabit(initialData.id, habitData);
            } else {
                savedHabit = await addHabit(habitData);
            }

            // Create Pending Sub-Habits
            const newSubHabitIds: string[] = [];
            for (const pending of pendingSubHabits) {
                const newHabitData = {
                    name: pending.name,
                    categoryId: selectedCategoryId, // Inherit category
                    goal: {
                        type: pending.goalType,
                        target: pending.target ? Number(pending.target) : undefined,
                        unit: pending.unit || undefined,
                        frequency: frequency, // Inherit frequency (daily/weekly)
                    },
                    assignedDays: frequency === 'weekly' ? assignedDays : undefined, // Inherit schedule
                    bundleParentId: savedHabit.id, // Link to parent immediately
                };
                const created = await addHabit(newHabitData);
                newSubHabitIds.push(created.id);
            }

            // If Bundle, update children to point to this parent
            // Merge existing selected IDs with newly created IDs
            if (habitType === 'bundle') {
                const allSubHabitIds = [...subHabitIds, ...newSubHabitIds];
                const previousSubIds = initialData?.subHabitIds || [];

                // If we added new pending habits, we need to update the parent's list
                if (newSubHabitIds.length > 0) {
                    await updateHabit(savedHabit.id, { subHabitIds: allSubHabitIds });
                }

                // Determine removed children (if editing existing selection)
                const removedIds = previousSubIds.filter(id => !subHabitIds.includes(id));
                // Determine new existing children (not pending ones, those are handled above)
                const newlyLinkedExistingIds = subHabitIds.filter(id => !previousSubIds.includes(id));

                // Unlink removed children
                for (const childId of removedIds) {
                    await updateHabit(childId, { bundleParentId: undefined });
                }

                // Link new existing children
                for (const childId of newlyLinkedExistingIds) {
                    await updateHabit(childId, { bundleParentId: savedHabit.id });
                }
            }

            onClose();
        } catch (error) {
            console.error('Failed to save habit:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleSubHabit = (id: string) => {
        setSubHabitIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleAddPendingSubHabit = () => {
        if (!newHabitName.trim()) return;

        setPendingSubHabits(prev => [...prev, {
            tempId: `temp - ${Date.now()} `,
            name: newHabitName,
            goalType: newHabitGoalType,
            target: newHabitTarget,
            unit: newHabitUnit
        }]);

        // Reset form
        setNewHabitName('');
        setNewHabitTarget('');
        setNewHabitUnit('');
        setNewHabitGoalType('boolean');
    };

    const removePendingSubHabit = (tempId: string) => {
        setPendingSubHabits(prev => prev.filter(p => p.tempId !== tempId));
    };

    // Filter available habits for bundling
    const availableHabits = habits.filter(h =>
        // Must not be the habit we are editing
        h.id !== initialData?.id &&
        // Must not be a bundle itself (no nested bundles)
        h.type !== 'bundle' &&
        // Must not already belong to ANOTHER bundle (unless it's THIS bundle we are editing)
        (!h.bundleParentId || (initialData && h.bundleParentId === initialData.id)) &&
        // If specific category context, only show habits from that category
        (!categoryId || h.categoryId === categoryId) &&
        // Filter by search term
        (searchTerm === '' || h.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
                    {/* 0. Type Selection */}
                    <div className="bg-neutral-800/50 p-1 rounded-lg flex space-x-1">
                        <button
                            type="button"
                            onClick={() => setHabitType('regular')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${habitType === 'regular'
                                ? 'bg-emerald-500 text-neutral-900 shadow-lg'
                                : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <CheckSquare size={16} />
                            Regular Habit
                        </button>
                        <button
                            type="button"
                            onClick={() => setHabitType('bundle')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${habitType === 'bundle'
                                ? 'bg-indigo-500 text-white shadow-lg'
                                : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Layers size={16} />
                            Habit Bundle
                        </button>
                    </div>

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

                        {/* Only show category selector if not pre-selected via context */}
                        {!categoryId && (
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
                        )}
                    </div>

                    {/* 2. Frequency & Type (Only for Regular) */}
                    {habitType === 'regular' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-neutral-400">Tracking Style</label>

                            {/* Frequency Selector */}
                            <div className="grid grid-cols-3 gap-2">
                                {(['daily', 'weekly', 'total'] as const).map((freq) => (
                                    <button
                                        key={freq}
                                        type="button"
                                        onClick={() => {
                                            setFrequency(freq);
                                            // Total frequency implies a numeric target, so auto-switch
                                            if (freq === 'total') {
                                                setGoalType('number');
                                            }
                                        }}
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
                                    disabled={frequency === 'total'}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${goalType === 'boolean'
                                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                        : frequency === 'total'
                                            ? 'bg-neutral-800/50 text-neutral-600 border-white/5 cursor-not-allowed'
                                            : 'bg-neutral-800 text-neutral-400 border-white/5 hover:bg-neutral-700'
                                        }`}
                                >
                                    <CheckCircle2 size={16} />
                                    Done (Y/N)
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
                    )}

                    {/* Bundle Configuration */}
                    {habitType === 'bundle' && (
                        <div className="space-y-3 border-t border-white/5 pt-4">
                            {/* Collapsible Sub-Habit Selection */}
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSubHabitSelect(!showSubHabitSelect)}
                                    className="flex items-center justify-between w-full text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        {showSubHabitSelect ? <ChevronDown size={18} className="text-neutral-400" /> : <ChevronRight size={18} className="text-neutral-400" />}
                                        <span className="text-sm font-medium text-neutral-300">
                                            Link Existing Habits
                                            {subHabitIds.length > 0 && <span className="ml-2 text-emerald-400">({subHabitIds.length} current)</span>}
                                        </span>
                                    </div>
                                    {!showSubHabitSelect && subHabitIds.length > 0 && (
                                        <span className="text-xs text-neutral-500">{subHabitIds.length} selected</span>
                                    )}
                                </button>

                                {showSubHabitSelect && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {/* Search Bar */}
                                        <div className="relative">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search habits to link..."
                                                className="w-full bg-neutral-800 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                            />
                                        </div>

                                        {/* Filtered List */}
                                        <div className="max-h-48 overflow-y-auto space-y-2 bg-neutral-800/30 p-2 rounded-lg border border-white/5 custom-scrollbar">
                                            {availableHabits.length > 0 ? availableHabits.map(h => {
                                                const isSelected = subHabitIds.includes(h.id);
                                                return (
                                                    <div
                                                        key={h.id}
                                                        onClick={() => toggleSubHabit(h.id)}
                                                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${isSelected
                                                            ? 'bg-indigo-500/20 border border-indigo-500/50'
                                                            : 'bg-neutral-800/50 hover:bg-neutral-800 border border-transparent'
                                                            }`}
                                                    >
                                                        <span className={`text-sm ${isSelected ? 'text-white font-medium' : 'text-neutral-300'}`}>{h.name}</span>
                                                        {isSelected ? (
                                                            <CheckCircle2 size={16} className="text-indigo-400" />
                                                        ) : (
                                                            <div className="w-4 h-4 rounded-full border border-white/10" />
                                                        )}
                                                    </div>
                                                );
                                            }) : (
                                                <div className="text-center py-6 text-neutral-500">
                                                    <p className="text-sm">No matching habits found.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-neutral-500 px-1">
                                Bundles allow you to group existing habits. Sub-habits will be nested under this bundle in the tracker.
                            </p>

                            {/* Bundle Frequency (Keep simple: daily/weekly) */}
                            <label className="block text-sm font-medium text-neutral-400 pt-2">Bundle Schedule</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFrequency('daily')}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${frequency === 'daily'
                                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                                        : 'bg-neutral-800 text-neutral-400 border-white/5 hover:bg-neutral-700'
                                        }`}
                                >
                                    Daily
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFrequency('weekly')}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${frequency === 'weekly'
                                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                                        : 'bg-neutral-800 text-neutral-400 border-white/5 hover:bg-neutral-700'
                                        }`}
                                >
                                    Weekly
                                </button>
                            </div>

                            {/* Create New Sub-Habit Inline */}
                            <div className="pt-4 border-t border-white/5 space-y-3">
                                <label className="block text-sm font-medium text-neutral-400">Create New Sub-Habit</label>
                                <div className="bg-neutral-800/30 p-3 rounded-lg border border-white/5 space-y-3">
                                    <input
                                        type="text"
                                        value={newHabitName}
                                        onChange={(e) => setNewHabitName(e.target.value)}
                                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="New habit name..."
                                    />
                                    <div className="flex gap-2">
                                        <div className="flex-1 flex bg-neutral-800 rounded-lg p-1 border border-white/5">
                                            <button
                                                type="button"
                                                onClick={() => setNewHabitGoalType('boolean')}
                                                className={`flex-1 flex items-center justify-center py-1 rounded text-xs transition-colors ${newHabitGoalType === 'boolean' ? 'bg-indigo-500 text-white' : 'text-neutral-400 hover:text-white'
                                                    }`}
                                            >
                                                <CheckCircle2 size={12} className="mr-1" /> Simple
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewHabitGoalType('number')}
                                                className={`flex-1 flex items-center justify-center py-1 rounded text-xs transition-colors ${newHabitGoalType === 'number' ? 'bg-indigo-500 text-white' : 'text-neutral-400 hover:text-white'
                                                    }`}
                                            >
                                                <Calculator size={12} className="mr-1" /> Numeric
                                            </button>
                                        </div>
                                    </div>
                                    {newHabitGoalType === 'number' && (
                                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                            <input
                                                type="number"
                                                value={newHabitTarget}
                                                onChange={(e) => setNewHabitTarget(e.target.value)}
                                                className="flex-1 bg-neutral-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Target (e.g. 10)"
                                            />
                                            <input
                                                type="text"
                                                value={newHabitUnit}
                                                onChange={(e) => setNewHabitUnit(e.target.value)}
                                                className="flex-1 bg-neutral-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Unit (e.g. mins)"
                                            />
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleAddPendingSubHabit}
                                        disabled={!newHabitName.trim()}
                                        className="w-full py-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 rounded-lg text-sm font-medium hover:bg-indigo-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Add to List
                                    </button>
                                </div>

                                {/* List of Pending Habits */}
                                {pendingSubHabits.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-neutral-500 uppercase">To Be Created</label>
                                        {pendingSubHabits.map(pending => (
                                            <div key={pending.tempId} className="flex items-center justify-between bg-neutral-800 p-2 rounded-lg border border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1 rounded ${pending.goalType === 'boolean' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {pending.goalType === 'boolean' ? <CheckCircle2 size={12} /> : <Calculator size={12} />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-white">{pending.name}</span>
                                                        {pending.goalType === 'number' && (
                                                            <span className="text-xs text-neutral-500">{pending.target} {pending.unit}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removePendingSubHabit(pending.tempId)}
                                                    className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. Specific Configuration based on Weekly/Type (Only if Regular or Weekly Bundle) */}
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
                    {habitType === 'regular' && frequency !== 'weekly' && goalType === 'number' && (
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">
                                    Target Amount
                                </label>
                                <input
                                    type="number"
                                    value={target}
                                    onChange={(e) => setTarget(e.target.value)}
                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="e.g. 10"
                                    required
                                />
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
                                <div className={`p - 2 rounded - lg transition - colors ${nonNegotiable ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-700/50 text-neutral-500'} `}>
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h4 className={`font - medium transition - colors ${nonNegotiable ? 'text-yellow-400' : 'text-neutral-300'} `}>Non-Negotiable</h4>
                                    <p className="text-xs text-neutral-500">Essential habit. Highlighted with a Priority Ring.</p>
                                </div>
                            </div>
                            <div className={`w - 12 h - 6 rounded - full p - 1 transition - colors ${nonNegotiable ? 'bg-yellow-500' : 'bg-neutral-700'} `}>
                                <div className={`w - 4 h - 4 rounded - full bg - white shadow - sm transition - transform ${nonNegotiable ? 'translate-x-6' : 'translate-x-0'} `} />
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
