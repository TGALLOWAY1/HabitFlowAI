import React, { useState, useEffect, useRef } from 'react';
import { X, Shield, CheckCircle2, Calculator, Layers, CheckSquare, ChevronDown, ChevronRight, Search, Trophy, Calendar } from 'lucide-react';
import { DayChipSelector } from './DayChipSelector';
import { NumberChipSelector } from './NumberChipSelector';
import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { useGoalsWithProgress } from '../lib/useGoalsWithProgress';
import type { Habit } from '../models/persistenceTypes';
import { format } from 'date-fns';
import { getBundleMemberships, createBundleMembership, endBundleMembership } from '../lib/persistenceClient';
import { BundlePickerModal } from './BundlePickerModal';
import { ConvertBundleConfirmModal } from './ConvertBundleConfirmModal';
import { GoalCreationInlineModal } from './GoalCreationInlineModal';
import { nextCategoryColor } from '../utils/categoryColors';

interface AddHabitModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryId?: string;
    initialData?: Habit | null;
    onNavigate?: (route: string) => void;
    initialBundleConvert?: boolean;
}

export const AddHabitModal: React.FC<AddHabitModalProps> = ({ isOpen, onClose, categoryId, initialData, initialBundleConvert }) => {
    const { addHabit, updateHabit, categories, habits, addCategory } = useHabitStore();
    const { routines, updateRoutine } = useRoutineStore();

    // Form State
    const [name, setName] = useState('');
    const [habitType, setHabitType] = useState<'regular' | 'bundle'>('regular');

    // Bundle State
    const [bundleMode, setBundleMode] = useState<'checklist' | 'choice' | null>(null);
    const [subHabitIds, setSubHabitIds] = useState<string[]>([]);
    const [showSubHabitSelect, setShowSubHabitSelect] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Pending Sub-Habits (Checklist Mode)
    const [pendingSubHabits, setPendingSubHabits] = useState<Array<{
        tempId: string;
        name: string;
        goalType: 'boolean' | 'number';
        target: string;
        unit: string;
    }>>([]);
    const [editingPendingId, setEditingPendingId] = useState<string | null>(null);
    const [editingLinkedHabitId, setEditingLinkedHabitId] = useState<string | null>(null);
    const [modifiedLinkedHabits, setModifiedLinkedHabits] = useState<Record<string, {
        name: string;
        goalType: 'boolean' | 'number';
        target: string;
        unit: string;
    }>>({});

    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitGoalType, setNewHabitGoalType] = useState<'boolean' | 'number'>('boolean');
    const [newHabitTarget, setNewHabitTarget] = useState('');
    const [newHabitUnit, setNewHabitUnit] = useState('');

    // Goal Configuration
    const [goalType, setGoalType] = useState<'boolean' | 'number'>('boolean');
    const [target, setTarget] = useState(''); // Numeric target
    const [unit, setUnit] = useState('');

    // Scheduling
    const [scheduledTime, setScheduledTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('30');
    const [scheduledDays, setScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
    const [requiredDaysPerWeek, setRequiredDaysPerWeek] = useState<number>(7);

    // Metadata
    const [description, setDescription] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || '');

    // Goal Linking
    const [linkedGoalId, setLinkedGoalId] = useState<string | null>(null);
    const { data: goalsData } = useGoalsWithProgress();
    const availableGoals = (goalsData?.map(g => g.goal) || []).filter(
        g => !selectedCategoryId || g.categoryId === selectedCategoryId
    );

    // Routine Linking
    const [linkedRoutineIds, setLinkedRoutineIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Inline Goal Creation
    const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false);

    // Inline Category Creation
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

    // Bundle UX: Add to Bundle picker + Convert confirmation
    const [showBundlePicker, setShowBundlePicker] = useState(false);
    const [showConvertConfirm, setShowConvertConfirm] = useState(false);
    const pendingSubmitRef = useRef<(() => Promise<void>) | null>(null);

    // Initialize/Reset
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit Mode
                setName(initialData.name);
                setHabitType(initialData.type === 'bundle' ? 'bundle' : 'regular');
                setBundleMode(initialData.bundleType || (initialData.type === 'bundle' ? 'checklist' : null)); // Default to checklist for legacy

                setSubHabitIds(initialData.subHabitIds || []);
                setPendingSubHabits([]); // Clear pending on open
                setShowSubHabitSelect(false); // Collapsed by default when editing a bundle

                setGoalType(initialData.goal.type || 'boolean');
                setTarget(initialData.goal.target ? String(initialData.goal.target) : '');
                setUnit(initialData.goal.unit || '');
                setScheduledTime(initialData.scheduledTime || '');
                setLinkedGoalId(initialData.linkedGoalId || null);
                setLinkedRoutineIds(initialData.linkedRoutineIds || []);
                setDurationMinutes(initialData.durationMinutes?.toString() || '30');
                const days = initialData.assignedDays ?? [0, 1, 2, 3, 4, 5, 6];
                setScheduledDays(days);
                setRequiredDaysPerWeek(
                    initialData.requiredDaysPerWeek ?? days.length
                );
                setDescription(initialData.description || '');
                setSelectedCategoryId(initialData.categoryId);

                // If opened via "Convert to Bundle" action, auto-switch to bundle mode
                if (initialBundleConvert && initialData.type !== 'bundle') {
                    setHabitType('bundle');
                }

            } else {
                // Add Mode
                setName('');
                setHabitType('regular');
                setBundleMode(null);
                setIsCreatingCategory(categories.length === 0);
                setNewCategoryName('');

                setSubHabitIds([]);
                setPendingSubHabits([]);
                setShowSubHabitSelect(false);
                setGoalType('boolean');
                setTarget('');
                setUnit('');
                setScheduledTime('');
                setLinkedGoalId(null);
                setIsCreateGoalOpen(false);
                setLinkedRoutineIds([]);
                setDurationMinutes('30');
                setScheduledDays([0, 1, 2, 3, 4, 5, 6]);
                setRequiredDaysPerWeek(7);
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

    // Auto-clamp requiredDaysPerWeek when scheduledDays shrinks
    useEffect(() => {
        if (requiredDaysPerWeek > scheduledDays.length) {
            setRequiredDaysPerWeek(scheduledDays.length);
        }
    }, [scheduledDays.length, requiredDaysPerWeek]);

    // Auto-sync target for Boolean Weekly habits
    // Auto-sync target for Boolean Weekly habits - DEPRECATED
    // Weekly habits now explicitly set target via Intent Buttons.
    // Daily habits don't use this logic (they use assignedDays for scheduling, not target count usually).

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        // Show confirmation when converting an existing regular habit to a bundle
        const isConversion = initialData && initialData.type !== 'bundle' && habitType === 'bundle';
        if (isConversion && !showConvertConfirm) {
            pendingSubmitRef.current = () => doSubmit();
            setShowConvertConfirm(true);
            return;
        }

        await doSubmit();
    };

    const doSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Ensure target is set correctly based on type
            let finalTarget: number | undefined = undefined;

            if (goalType === 'number') {
                finalTarget = target ? Number(target) : undefined;
            }

            // For bundles, minimal goal config
            // For bundles, minimal goal config
            const goalConfig = habitType === 'bundle' ? {
                type: 'boolean' as const,
                frequency: 'daily' as const, // Bundles are strictly daily
                target: 1 // Bundles are always target 1 (complete all or choose one)
            } : {
                type: goalType,
                target: finalTarget,
                unit: unit || undefined,
                frequency: 'daily' as const,
            };

            const habitData = {
                name,
                categoryId: selectedCategoryId,
                goal: goalConfig,
                assignedDays: scheduledDays,
                scheduledTime: scheduledTime || undefined,
                durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
                linkedGoalId: linkedGoalId || undefined,
                linkedRoutineIds: linkedRoutineIds.length > 0 ? linkedRoutineIds : undefined,
                nonNegotiable: scheduledDays.length === 7 && requiredDaysPerWeek === 7,
                requiredDaysPerWeek,
                description: description || undefined,
                type: habitType === 'bundle' ? 'bundle' as const : undefined,
                subHabitIds: habitType === 'bundle' ? subHabitIds : undefined,
                bundleType: habitType === 'bundle' ? bundleMode || undefined : undefined,
                bundleOptions: undefined, // Deprecated: Always clear bundleOptions for new/updated bundles
            };

            let savedHabit: Habit;
            if (initialData) {
                savedHabit = await updateHabit(initialData.id, habitData);
            } else {
                savedHabit = await addHabit(habitData);
            }

            // Create Pending Sub-Habits
            const todayDayKey = format(new Date(), 'yyyy-MM-dd');
            const newSubHabitIds: string[] = [];
            for (const pending of pendingSubHabits) {
                const newHabitData = {
                    name: pending.name,
                    categoryId: selectedCategoryId, // Inherit category
                    goal: {
                        type: pending.goalType,
                        target: pending.goalType === 'number' && pending.target ? Number(pending.target) : undefined,
                        unit: pending.goalType === 'number' ? pending.unit : undefined,
                        frequency: 'daily' as const,
                    },
                    assignedDays: undefined, // Inherit schedule
                    bundleParentId: savedHabit.id, // Link to parent immediately
                };
                const created = await addHabit(newHabitData);
                newSubHabitIds.push(created.id);
                // Create membership for the newly created child
                try {
                    await createBundleMembership({
                        parentHabitId: savedHabit.id,
                        childHabitId: created.id,
                        activeFromDayKey: todayDayKey,
                    });
                } catch (_e) { /* best-effort */ }
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

                // Unlink removed children — update bundleParentId and end membership
                // Use null (not undefined) so JSON.stringify includes the field
                // and the server clears bundleParentId in the database.
                for (const childId of removedIds) {
                    await updateHabit(childId, { bundleParentId: null });
                    // End active membership for this child
                    try {
                        const memberships = await getBundleMemberships(savedHabit.id);
                        const active = memberships.find(m => m.childHabitId === childId && !m.activeToDayKey);
                        if (active) {
                            await endBundleMembership(active.id, todayDayKey);
                        }
                    } catch (_e) { /* membership may not exist for pre-migration bundles */ }
                }

                // Link new existing children — update bundleParentId and create membership
                for (const childId of newlyLinkedExistingIds) {
                    await updateHabit(childId, { bundleParentId: savedHabit.id });
                    try {
                        await createBundleMembership({
                            parentHabitId: savedHabit.id,
                            childHabitId: childId,
                            activeFromDayKey: todayDayKey,
                        });
                    } catch (_e) { /* best-effort — membership creation may fail for edge cases */ }
                }

                // Apply modifications to linked habits
                const modifiedIds = Object.keys(modifiedLinkedHabits).filter(id => subHabitIds.includes(id));
                for (const id of modifiedIds) {
                    const mod = modifiedLinkedHabits[id];
                    await updateHabit(id, {
                        name: mod.name,
                        goal: {
                            type: mod.goalType,
                            target: mod.goalType === 'number' && mod.target ? Number(mod.target) : undefined,
                            unit: mod.goalType === 'number' ? mod.unit : undefined,
                            frequency: 'daily' as const
                        }
                    });
                }
            }



            // Sync with Routines (Bi-directional)
            // 1. Add this habit to newly linked routines
            for (const rId of linkedRoutineIds) {
                const routine = routines.find(r => r.id === rId);
                if (routine && !routine.linkedHabitIds?.includes(savedHabit.id)) {
                    await updateRoutine(rId, {
                        linkedHabitIds: [...(routine.linkedHabitIds || []), savedHabit.id]
                    });
                }
            }

            // 2. Remove this habit from unlinked routines (if editing)
            if (initialData?.linkedRoutineIds) {
                const removedRoutineIds = initialData.linkedRoutineIds.filter(id => !linkedRoutineIds.includes(id));
                for (const rId of removedRoutineIds) {
                    const routine = routines.find(r => r.id === rId);
                    if (routine && routine.linkedHabitIds?.includes(savedHabit.id)) {
                        await updateRoutine(rId, {
                            linkedHabitIds: routine.linkedHabitIds.filter(hId => hId !== savedHabit.id)
                        });
                    }
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

        if (editingLinkedHabitId) {
            // Update Existing Linked Habit (Locally)
            setModifiedLinkedHabits(prev => ({
                ...prev,
                [editingLinkedHabitId]: {
                    name: newHabitName,
                    goalType: newHabitGoalType,
                    target: newHabitTarget,
                    unit: newHabitUnit
                }
            }));
            setEditingLinkedHabitId(null);
        } else if (editingPendingId) {
            // Update Existing Pending Habit
            setPendingSubHabits(prev => prev.map(p => {
                if (p.tempId === editingPendingId) {
                    return {
                        ...p,
                        name: newHabitName,
                        goalType: newHabitGoalType,
                        target: newHabitTarget,
                        unit: newHabitUnit
                    };
                }
                return p;
            }));
            setEditingPendingId(null);
        } else {
            // Create New
            setPendingSubHabits(prev => [...prev, {
                tempId: `temp - ${Date.now()} `,
                name: newHabitName,
                goalType: newHabitGoalType,
                target: newHabitTarget,
                unit: newHabitUnit
            }]);
        }

        // Reset form
        setNewHabitName('');
        setNewHabitTarget('');
        setNewHabitUnit('');
        setNewHabitGoalType('boolean');
    };

    const handleEditPendingSubHabit = (tempId: string) => {
        const item = pendingSubHabits.find(p => p.tempId === tempId);
        if (!item) return;

        setNewHabitName(item.name);
        setNewHabitGoalType(item.goalType);
        setNewHabitTarget(item.target || '');
        setNewHabitUnit(item.unit || '');
        setEditingPendingId(tempId);
        setEditingLinkedHabitId(null); // Clear other edit mode
    };

    const handleEditLinkedHabit = (id: string) => {
        const h = habits.find(h => h.id === id);
        if (!h) return;

        // Check if we have local modifications first
        const modified = modifiedLinkedHabits[id];

        if (modified) {
            setNewHabitName(modified.name);
            setNewHabitGoalType(modified.goalType);
            setNewHabitTarget(modified.target);
            setNewHabitUnit(modified.unit);
        } else {
            setNewHabitName(h.name);
            setNewHabitGoalType(h.goal.type);
            // Handle target safely
            let t = '';
            if (h.goal.target) t = String(h.goal.target);
            setNewHabitTarget(t);
            setNewHabitUnit(h.goal.unit || '');
        }

        setEditingLinkedHabitId(id);
        setEditingPendingId(null); // Clear other edit mode
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

    const isEditMode = !!initialData;

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto modal-scroll">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">
                        {isEditMode
                            ? (initialData?.type !== 'bundle' && habitType === 'bundle')
                                ? 'Convert to Bundle'
                                : 'Edit Habit'
                            : 'Add New Habit'}
                    </h3>
                    <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white -mr-2" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* 1. Type Selection (Step 1) */}
                    <div className="bg-neutral-800/50 p-1 rounded-lg flex space-x-1">
                        <button
                            type="button"
                            onClick={() => {
                                setHabitType('regular');
                                setBundleMode(null);
                            }}
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
                            onClick={() => {
                                setHabitType('bundle');
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${habitType === 'bundle'
                                ? 'bg-indigo-500 text-white shadow-lg'
                                : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Layers size={16} />
                            Habit Bundle
                        </button>
                    </div>

                    {/* Step 2: Bundle Mode Selection (If Bundle) */}
                    {habitType === 'bundle' && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1">
                            <button
                                type="button"
                                onClick={() => setBundleMode('checklist')}
                                className={`relative p-3 rounded-xl border text-left transition-all ${bundleMode === 'checklist'
                                    ? 'bg-indigo-500/20 border-indigo-500 ring-1 ring-indigo-500/50'
                                    : 'bg-neutral-800 border-white/5 hover:bg-neutral-700/50'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`p-1.5 rounded-lg ${bundleMode === 'checklist' ? 'bg-indigo-500 text-white' : 'bg-neutral-700 text-neutral-400'}`}>
                                        <CheckSquare size={16} />
                                    </div>
                                    <span className={`text-sm font-semibold ${bundleMode === 'checklist' ? 'text-white' : 'text-neutral-300'}`}>Checklist</span>
                                </div>
                                <p className="text-xs text-neutral-500 leading-relaxed">
                                    "I want to do multiple items."
                                    <br />
                                    <span className="opacity-75 italic block mt-1">Example: Morning Routine (Bed, Teeth, Water)</span>
                                </p>
                                {bundleMode === 'checklist' && (
                                    <div className="absolute top-2 right-2 text-indigo-400">
                                        <CheckCircle2 size={16} />
                                    </div>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setBundleMode('choice')}
                                className={`relative p-3 rounded-xl border text-left transition-all ${bundleMode === 'choice'
                                    ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500/50'
                                    : 'bg-neutral-800 border-white/5 hover:bg-neutral-700/50'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`p-1.5 rounded-lg ${bundleMode === 'choice' ? 'bg-amber-500 text-neutral-900' : 'bg-neutral-700 text-neutral-400'}`}>
                                        <ChevronRight size={16} />
                                    </div>
                                    <span className={`text-sm font-semibold ${bundleMode === 'choice' ? 'text-white' : 'text-neutral-300'}`}>Choice</span>
                                </div>
                                <p className="text-xs text-neutral-500 leading-relaxed">
                                    "Any one option satisfies the habit."
                                    <br />
                                    <span className="opacity-75 italic block mt-1">Example: Read OR Podcast OR YouTube</span>
                                </p>
                                {bundleMode === 'choice' && (
                                    <div className="absolute top-2 right-2 text-amber-500">
                                        <CheckCircle2 size={16} />
                                    </div>
                                )}
                            </button>
                        </div>
                    )}

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
                                {categories.length > 0 && !isCreatingCategory && (
                                    <select
                                        value={selectedCategoryId}
                                        onChange={(e) => {
                                            if (e.target.value === '__new__') {
                                                setIsCreatingCategory(true);
                                            } else {
                                                setSelectedCategoryId(e.target.value);
                                            }
                                        }}
                                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 appearance-none"
                                    >
                                        <option value="__new__">+ New Category</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                )}
                                {isCreatingCategory ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (newCategoryName.trim()) {
                                                        (async () => {
                                                            setIsSubmittingCategory(true);
                                                            try {
                                                                const newCat = await addCategory({ name: newCategoryName.trim(), color: nextCategoryColor(categories) });
                                                                setSelectedCategoryId(newCat.id);
                                                                setIsCreatingCategory(false);
                                                                setNewCategoryName('');
                                                            } catch (err) {
                                                                console.error('Failed to create category:', err);
                                                            } finally {
                                                                setIsSubmittingCategory(false);
                                                            }
                                                        })();
                                                    }
                                                }
                                            }}
                                            className="flex-1 bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                            placeholder="Category name"
                                            autoFocus
                                            disabled={isSubmittingCategory}
                                        />
                                        <button
                                            type="button"
                                            disabled={!newCategoryName.trim() || isSubmittingCategory}
                                            onClick={async () => {
                                                if (!newCategoryName.trim()) return;
                                                setIsSubmittingCategory(true);
                                                try {
                                                    const newCat = await addCategory({ name: newCategoryName.trim(), color: nextCategoryColor(categories) });
                                                    setSelectedCategoryId(newCat.id);
                                                    setIsCreatingCategory(false);
                                                    setNewCategoryName('');
                                                } catch (err) {
                                                    console.error('Failed to create category:', err);
                                                } finally {
                                                    setIsSubmittingCategory(false);
                                                }
                                            }}
                                            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            {isSubmittingCategory ? '...' : 'Save'}
                                        </button>
                                        {categories.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => { setIsCreatingCategory(false); setNewCategoryName(''); }}
                                                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                ) : categories.length === 0 ? (
                                    <p className="text-sm text-neutral-500 mb-2">No categories yet. Create one to get started.</p>
                                ) : null}
                                {!isCreatingCategory && categories.length === 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingCategory(true)}
                                        className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors mt-1"
                                    >
                                        + New Category
                                    </button>
                                )}
                            </div>
                    </div>

                    {/* 2. Tracking Style (Only for Regular) */}
                    {habitType === 'regular' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-neutral-400">Tracking Style</label>

                            {/* Goal Type Toggle */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setGoalType('boolean')}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${goalType === 'boolean'
                                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
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
                                    Numeric
                                </button>
                            </div>

                        </div>
                    )}

                    {/* Goal Linker */}
                    <div>
                        <div className="relative">
                            <Trophy size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
                            <select
                                value={linkedGoalId || ''}
                                onChange={(e) => {
                                    if (e.target.value === '__new__') {
                                        setIsCreateGoalOpen(true);
                                    } else {
                                        setLinkedGoalId(e.target.value || null);
                                    }
                                }}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-emerald-500 appearance-none"
                            >
                                <option value="">Connect to a Goal (Optional)</option>
                                <option value="__new__">+ Create New Goal</option>
                                {availableGoals.length > 0 && <option disabled>──────────</option>}
                                {availableGoals.map(g => (
                                    <option key={g.id} value={g.id}>{g.title}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                        </div>
                    </div>


                    {/* Bundle Configuration - UNIFIED (Checklist + Choice) */}
                    {habitType === 'bundle' && (bundleMode === 'checklist' || bundleMode === 'choice') && (
                        <div className="space-y-4 border-t border-white/5 pt-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-white">
                                    {bundleMode === 'checklist' ? 'Checklist Items' : 'Choices'}
                                </label>
                                <span className="text-xs text-neutral-500">
                                    {bundleMode === 'checklist' ? 'Checking parent completes all children.' : 'Select one valid option.'}
                                </span>
                            </div>

                            {/* Existing Sub-Habits Linker */}
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSubHabitSelect(!showSubHabitSelect)}
                                    className="flex items-center justify-between w-full text-left bg-neutral-800/50 p-3 rounded-lg border border-white/5 hover:bg-neutral-800 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {showSubHabitSelect ? <ChevronDown size={18} className="text-neutral-400" /> : <Search size={18} className="text-neutral-400" />}
                                        <span className="text-sm font-medium text-neutral-300">
                                            Add Existing Habits
                                        </span>
                                    </div>
                                    {subHabitIds.length > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">{subHabitIds.length} linked</span>
                                    )}
                                </button>

                                {showSubHabitSelect && (
                                    <div className="space-y-3 p-3 bg-neutral-900 rounded-lg border border-white/10 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search habits..."
                                                className="w-full bg-neutral-800 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                                            {availableHabits.length > 0 ? availableHabits.map(h => (
                                                <div
                                                    key={h.id}
                                                    onClick={() => toggleSubHabit(h.id)}
                                                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${subHabitIds.includes(h.id) ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-neutral-800 text-neutral-400'}`}
                                                >
                                                    <span className="text-xs">{h.name}</span>
                                                    {subHabitIds.includes(h.id) && <CheckCircle2 size={12} />}
                                                </div>
                                            )) : (
                                                <p className="text-center text-xs text-neutral-500 py-2">No matching habits.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Create New Item */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">New Child Habit</label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newHabitName}
                                            onChange={(e) => setNewHabitName(e.target.value)}
                                            className="flex-1 bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            placeholder="Item name (e.g. Floss)..."
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddPendingSubHabit}
                                            disabled={!newHabitName.trim()}
                                            className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${editingPendingId || editingLinkedHabitId
                                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
                                                : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50 hover:bg-indigo-500/30'
                                                }`}
                                        >
                                            {editingPendingId || editingLinkedHabitId ? 'Update' : 'Add'}
                                        </button>
                                    </div>

                                    {/* Choice Mode: Optional Metric Config for New Items */}
                                    {bundleMode === 'choice' && newHabitName.trim() && (
                                        <div className="flex items-center gap-2 pl-1 animate-in fade-in pt-1">
                                            <div className="flex bg-neutral-800 rounded-lg p-1 border border-white/5">
                                                <button
                                                    type="button"
                                                    onClick={() => setNewHabitGoalType('boolean')}
                                                    className={`text-xs px-3 py-1.5 rounded-md transition-all ${newHabitGoalType === 'boolean'
                                                        ? 'bg-neutral-700 text-white shadow-sm'
                                                        : 'text-neutral-500 hover:text-neutral-300'
                                                        }`}
                                                >
                                                    Simple (Done/Not)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewHabitGoalType('number')}
                                                    className={`text-xs px-3 py-1.5 rounded-md transition-all ${newHabitGoalType === 'number'
                                                        ? 'bg-neutral-700 text-white shadow-sm'
                                                        : 'text-neutral-500 hover:text-neutral-300'
                                                        }`}
                                                >
                                                    Tracked Amount
                                                </button>
                                            </div>

                                            {newHabitGoalType === 'number' && (
                                                <input
                                                    type="text"
                                                    value={newHabitUnit}
                                                    onChange={(e) => setNewHabitUnit(e.target.value)}
                                                    placeholder="Unit (e.g. miles)"
                                                    className="bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white w-24 animate-in fade-in slide-in-from-left-2"
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* List of Items (Linked + Pending) */}
                            {(subHabitIds.length > 0 || pendingSubHabits.length > 0) && (
                                <div className="bg-neutral-800/20 rounded-lg border border-white/5 overflow-hidden">
                                    {/* We can't easily show linked habits names without finding them, so just show pending + count logic? 
                                        Actually, let's just list them simply.
                                     */}
                                    <div className="p-2 space-y-1">
                                        {/* Pending List */}
                                        {pendingSubHabits.map(p => (
                                            <div key={p.tempId} className={`flex justify-between items-center p-2 rounded border transition-colors ${editingPendingId === p.tempId
                                                ? 'bg-amber-500/10 border-amber-500/30'
                                                : 'bg-neutral-800 border-white/5'
                                                }`}>
                                                <div
                                                    className="flex items-center gap-2 flex-1 cursor-pointer"
                                                    onClick={() => handleEditPendingSubHabit(p.tempId)}
                                                >
                                                    <span className={`text-sm ${editingPendingId === p.tempId ? 'text-amber-200' : 'text-white'}`}>{p.name}</span>
                                                    {p.goalType === 'number' && (
                                                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1 rounded">
                                                            {p.unit || 'units'}
                                                        </span>
                                                    )}
                                                    {editingPendingId === p.tempId && (
                                                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                                            Editing
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removePendingSubHabit(p.tempId);
                                                    }}
                                                    className="text-neutral-500 hover:text-red-400 p-1"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        {/* Linked List (Summary) */}
                                        {subHabitIds.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {/* We render simple list of linked IDs (names fetched if possible, else summary) */}
                                                {subHabitIds.map(id => {
                                                    const h = habits.find(h => h.id === id);
                                                    // Check for local modifications to display
                                                    const mod = modifiedLinkedHabits[id] || {};
                                                    const displayName = mod.name || h?.name || 'Unknown Habit';
                                                    const displayGoalType = mod.goalType || h?.goal?.type;
                                                    const displayTarget = mod.target !== undefined ? mod.target : h?.goal?.target;
                                                    const displayUnit = mod.unit !== undefined ? mod.unit : h?.goal?.unit;
                                                    const isEditingThis = editingLinkedHabitId === id;

                                                    return (
                                                        <div key={id} className={`flex justify-between items-center p-2 rounded border transition-colors ${isEditingThis
                                                            ? 'bg-amber-500/10 border-amber-500/30'
                                                            : 'bg-indigo-500/10 border-indigo-500/20'
                                                            }`}>
                                                            <div
                                                                className="flex items-center gap-2 flex-1 cursor-pointer"
                                                                onClick={() => handleEditLinkedHabit(id)}
                                                            >
                                                                <span className={`text-sm ${isEditingThis ? 'text-amber-200' : 'text-indigo-200'}`}>{displayName}</span>
                                                                {displayGoalType === 'number' && (
                                                                    <span className="text-xs text-indigo-300 bg-indigo-400/20 px-1 rounded border border-indigo-400/30">
                                                                        {displayTarget} {displayUnit}
                                                                    </span>
                                                                )}
                                                                {/* Show modified indicator */}
                                                                {(modifiedLinkedHabits[id] || isEditingThis) && (
                                                                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                                                        {isEditingThis ? 'Editing' : 'Modified'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleSubHabit(id);
                                                                }}
                                                                className="text-indigo-400 hover:text-indigo-200"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* DEPRECATED: Old Choice Bundle Options Section Removed/Hidden in favor of Unified UI above */}

                    {/* Legacy Choice Bundle Options Section Removed */}

                    {/* Bundle Schedule Lock - HIDDEN per user request */}
                    {/* 
                        habitType === 'bundle' && (
                            <div className="pt-2"> ... </div>
                        )
                    */}

                    {/* 4. Numeric Target Configuration */}
                    {
                        habitType === 'regular' && goalType === 'number' && (
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                                        Target Amount <span className="text-xs opacity-50 font-normal">(Optional)</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={target}
                                        onChange={(e) => setTarget(e.target.value)}
                                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                        placeholder="e.g. 10"
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
                        )
                    }

                    {/* 5. Schedule & Streak */}
                    <div className="space-y-4 pt-2 border-t border-white/5">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-400 uppercase flex items-center gap-1">
                                <Calendar size={12} /> Scheduled Days
                            </label>
                            <DayChipSelector
                                selectedDays={scheduledDays}
                                onChange={setScheduledDays}
                                minSelected={1}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-400 uppercase flex items-center gap-1">
                                <Shield size={12} /> Days Per Week Required
                            </label>
                            <NumberChipSelector
                                value={requiredDaysPerWeek}
                                onChange={setRequiredDaysPerWeek}
                                min={1}
                                max={scheduledDays.length}
                            />
                            {scheduledDays.length === 7 && requiredDaysPerWeek === 7 && (
                                <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                                    <Shield size={10} /> Non-Negotiable — all days required
                                </p>
                            )}
                            {requiredDaysPerWeek < scheduledDays.length && (
                                <p className="text-xs text-emerald-400 mt-1">
                                    {scheduledDays.length - requiredDaysPerWeek} grace day{scheduledDays.length - requiredDaysPerWeek !== 1 ? 's' : ''} per week
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Add to Bundle action — for regular habits not already in a bundle */}
                    {isEditMode && initialData && habitType === 'regular' && !initialData.bundleParentId && initialData.type !== 'bundle' && (
                        <div className="border-t border-white/5 pt-3">
                            <button
                                type="button"
                                onClick={() => setShowBundlePicker(true)}
                                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-white/5 active:bg-white/10 text-neutral-400 hover:text-neutral-200"
                            >
                                <Layers size={16} className="text-indigo-400" />
                                <span className="text-sm font-medium">Add to Bundle...</span>
                            </button>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="sticky bottom-0 pt-2 pb-1 bg-neutral-900 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={
                                !name.trim() ||
                                isSubmitting ||
                                (habitType === 'bundle' && bundleMode === 'checklist' && subHabitIds.length === 0 && pendingSubHabits.length === 0) ||
                                (habitType === 'bundle' && bundleMode === 'choice' && (subHabitIds.length + pendingSubHabits.length) < 1)
                            }
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isEditMode ? 'Save Changes' : 'Create Habit'}
                        </button>
                    </div>
                </form >
            </div >

            {/* Bundle Picker Modal */}
            {initialData && (
                <BundlePickerModal
                    isOpen={showBundlePicker}
                    onClose={() => {
                        setShowBundlePicker(false);
                        onClose();
                    }}
                    habitId={initialData.id}
                    habitName={initialData.name}
                />
            )}

            {/* Convert Confirmation Modal */}
            <ConvertBundleConfirmModal
                isOpen={showConvertConfirm}
                onClose={() => {
                    setShowConvertConfirm(false);
                    pendingSubmitRef.current = null;
                }}
                onConfirm={async () => {
                    setShowConvertConfirm(false);
                    if (pendingSubmitRef.current) {
                        await pendingSubmitRef.current();
                        pendingSubmitRef.current = null;
                    }
                }}
                habitName={name}
                bundleType={bundleMode || 'checklist'}
                childCount={subHabitIds.length + pendingSubHabits.length}
            />

            <GoalCreationInlineModal
                isOpen={isCreateGoalOpen}
                onClose={() => setIsCreateGoalOpen(false)}
                onGoalCreated={(goalId) => setLinkedGoalId(goalId)}
                defaultCategoryId={selectedCategoryId || undefined}
            />
        </div >
    );
};
