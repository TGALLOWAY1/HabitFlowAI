import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Link2, Clock, Image as ImageIcon, Loader2, ChevronDown } from 'lucide-react';
import { uploadRoutineImage } from '../lib/persistenceClient';
import { useRoutineStore } from '../store/RoutineContext';
import { useHabitStore } from '../store/HabitContext';
import type { Routine, RoutineStep } from '../models/persistenceTypes';

interface RoutineEditorModalProps {
    isOpen: boolean;
    mode: 'create' | 'edit';
    initialRoutine?: Routine;
    onClose: () => void;
}

export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
    isOpen,
    mode,
    initialRoutine,
    onClose,
}) => {
    const { addRoutine, updateRoutine } = useRoutineStore();
    const { categories, habits, updateHabit } = useHabitStore();

    // Form State
    const [title, setTitle] = useState('');
    const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
    const [steps, setSteps] = useState<RoutineStep[]>([]);
    // linkedHabitIds are now derived from steps, so we don't need a separate state for editing them directly


    // UI State
    const [validationError, setValidationError] = useState<string | null>(null);
    const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);
    const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

    const handleImageUpload = async (file: File, stepId: string) => {
        setUploadingStepId(stepId);
        try {
            const url = await uploadRoutineImage(file);
            updateStep(stepId, { imageUrl: url });
        } catch (error) {
            console.error('Failed to upload image:', error);
            setValidationError('Failed to upload image. Please try again.');
        } finally {
            setUploadingStepId(null);
        }
    };

    // Initialize state
    useEffect(() => {
        if (!isOpen) return;

        if (mode === 'edit' && initialRoutine) {
            setTitle(initialRoutine.title);
            setCategoryId(initialRoutine.categoryId);
            setSteps(initialRoutine.steps ? initialRoutine.steps.map(s => ({ ...s })) : []);
            setExpandedStepId(null); // Collapse all initially
        } else {
            setTitle('');
            setCategoryId(undefined);
            setSteps([]);
            setExpandedStepId(null);
        }
    }, [isOpen, mode, initialRoutine]);

    const generateStepId = () => crypto.randomUUID();

    const addStep = () => {
        const newId = generateStepId();
        const newStep: RoutineStep = {
            id: newId,
            title: '',
        };
        setSteps([...steps, newStep]);
        setExpandedStepId(newId); // Auto-expand new step
    };

    const updateStep = (id: string, updates: Partial<RoutineStep>) => {
        setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const removeStep = (id: string) => {
        setSteps(steps.filter(s => s.id !== id));
        if (expandedStepId === id) setExpandedStepId(null);
    };



    const validate = () => {
        if (!title.trim()) return "Routine title is required";
        if (steps.length === 0) return "Add at least one step";
        for (const step of steps) {
            if (!step.title.trim()) return "All steps must have a title";
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const error = validate();
        if (error) {
            setValidationError(error);
            return;
        }

        try {
            const routineData = {
                title: title.trim(),
                categoryId,
                steps,
                linkedHabitIds: Array.from(new Set(steps.map(s => s.linkedHabitId).filter(Boolean))) as string[]
            };

            let savedRoutine: Routine;
            if (mode === 'create') {
                savedRoutine = await addRoutine(routineData);
            } else if (initialRoutine) {
                savedRoutine = await updateRoutine(initialRoutine.id, routineData);
            } else {
                throw new Error("No initial routine for edit mode");
            }

            // Bi-directional Sync: Update Linked Habits
            // 1. Add Routine ID to newly linked Habits
            const newLinkedHabitIds = routineData.linkedHabitIds;
            const previousLinkedHabitIds = initialRoutine?.linkedHabitIds || [];

            // Find valid habits (filter out any IDs that might not exist)
            const validHabits = habits.filter(h => newLinkedHabitIds.includes(h.id));

            // Add to new links
            for (const habit of validHabits) {
                if (!habit.linkedRoutineIds?.includes(savedRoutine.id)) {
                    await updateHabit(habit.id, {
                        linkedRoutineIds: [...(habit.linkedRoutineIds || []), savedRoutine.id]
                    });
                }
            }

            // 2. Remove Routine ID from unlinked Habits
            const removedHabitIds = previousLinkedHabitIds.filter(id => !newLinkedHabitIds.includes(id));
            for (const hId of removedHabitIds) {
                const habit = habits.find(h => h.id === hId);
                if (habit && habit.linkedRoutineIds?.includes(savedRoutine.id)) {
                    await updateHabit(habit.id, {
                        linkedRoutineIds: habit.linkedRoutineIds.filter(rid => rid !== savedRoutine.id)
                    });
                }
            }
            onClose();
        } catch (err) {
            console.error(err);
            setValidationError("Failed to save routine");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-4xl h-[85vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-neutral-900 z-10">
                    <h2 className="text-xl font-bold text-white">
                        {mode === 'create' ? 'Create Routine' : 'Edit Routine'}
                    </h2>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Main Content (Split View) */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left: Routine Details & Steps */}
                    <div className="flex-1 overflow-y-auto p-8 border-r border-white/5 space-y-8">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => { setTitle(e.target.value); }}
                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-3 text-lg text-white focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                                    placeholder="e.g., Morning Startup"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Category (Optional)</label>
                                <select
                                    value={categoryId || ''}
                                    onChange={e => setCategoryId(e.target.value || undefined)}
                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="">-- No Category --</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-neutral-500 mt-1">
                                    Selecting a category limits linked habits to that category.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-neutral-400">Steps</label>
                                <button
                                    type="button"
                                    onClick={addStep}
                                    className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
                                >
                                    <Plus size={16} /> Add Step
                                </button>
                            </div>

                            <div className="space-y-4">
                                {steps.length === 0 && (
                                    <div className="text-center py-12 border-2 border-dashed border-neutral-800 rounded-xl">
                                        <p className="text-neutral-500">No steps yet. Add one to get started.</p>
                                    </div>
                                )}
                                {steps.map((step, index) => {
                                    const isExpanded = expandedStepId === step.id;
                                    return (
                                        <div key={step.id} className="bg-neutral-800/50 border border-white/5 rounded-xl overflow-hidden transition-all duration-200">
                                            {/* Header - Click to toggle */}
                                            <div
                                                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                                onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                                            >
                                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-xs text-neutral-500 flex-shrink-0">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 font-medium text-white truncate">
                                                    {step.title || <span className="text-neutral-500 italic">Untitled Step</span>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent toggle
                                                            removeStep(step.id);
                                                        }}
                                                        className="p-2 text-neutral-600 hover:text-red-400 transition-colors"
                                                        title="Delete Step"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <ChevronDown
                                                        size={16}
                                                        className={`text-neutral-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                    />
                                                </div>
                                            </div>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="p-4 pt-0 space-y-3 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="pt-3">
                                                        <label className="block text-xs font-medium text-neutral-500 mb-1">Step Title</label>
                                                        <input
                                                            type="text"
                                                            value={step.title}
                                                            onChange={e => updateStep(step.id, { title: e.target.value })}
                                                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                                                            placeholder="e.g., Drink Water"
                                                            autoFocus // Focus title on expand
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="block text-xs font-medium text-neutral-500 mb-1">Instructions (Optional)</label>
                                                        <textarea
                                                            value={step.instruction || ''}
                                                            onChange={e => updateStep(step.id, { instruction: e.target.value })}
                                                            className="w-full bg-neutral-900 border border-white/10 rounded-lg p-3 text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                                                            placeholder="Detailed instructions..."
                                                            rows={3}
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-4 pt-2">
                                                        {/* Timer Input */}
                                                        <div className="flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2">
                                                            <Clock size={16} className="text-neutral-500" />
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.1"
                                                                value={step.timerSeconds ? step.timerSeconds / 60 : ''}
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value);
                                                                    updateStep(step.id, { timerSeconds: isNaN(val) ? undefined : Math.max(0, Math.round(val * 60)) });
                                                                }}
                                                                placeholder="Min"
                                                                className="bg-transparent w-20 text-sm focus:outline-none text-white placeholder-neutral-600"
                                                            />
                                                        </div>

                                                        {/* Image Input (URL + Upload) */}
                                                        <div className="flex-1 flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2">
                                                            <button
                                                                onClick={() => document.getElementById(`step-image-upload-${step.id}`)?.click()}
                                                                className="text-neutral-500 hover:text-white transition-colors"
                                                                title="Upload Image"
                                                                disabled={uploadingStepId === step.id}
                                                            >
                                                                {uploadingStepId === step.id ? (
                                                                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                                                                ) : (
                                                                    <ImageIcon size={16} />
                                                                )}
                                                            </button>
                                                            <input
                                                                id={`step-image-upload-${step.id}`}
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    if (e.target.files?.[0]) {
                                                                        handleImageUpload(e.target.files[0], step.id);
                                                                    }
                                                                    e.target.value = '';
                                                                }}
                                                            />
                                                            <input
                                                                type="text"
                                                                value={step.imageUrl || ''}
                                                                onChange={e => updateStep(step.id, { imageUrl: e.target.value })}
                                                                placeholder="Image URL or upload"
                                                                className="bg-transparent w-full text-sm text-white focus:outline-none placeholder-neutral-600"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Image Preview */}
                                                    {step.imageUrl && (
                                                        <div className="mt-2 relative group w-full aspect-video bg-neutral-900 rounded-lg overflow-hidden border border-white/5">
                                                            <img
                                                                src={step.imageUrl}
                                                                alt="Step preview"
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <button
                                                                onClick={() => updateStep(step.id, { imageUrl: undefined })}
                                                                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                                                title="Remove Image"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Linked Habit Selector */}
                                                    <div className="pt-2">
                                                        <label className="block text-xs font-medium text-neutral-500 mb-1 flex items-center gap-1">
                                                            <Link2 size={12} /> Linked Habit (Optional)
                                                        </label>
                                                        <select
                                                            value={step.linkedHabitId || ''}
                                                            onChange={e => updateStep(step.id, { linkedHabitId: e.target.value || undefined })}
                                                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                                        >
                                                            <option value="">-- No Linked Habit --</option>
                                                            {habits
                                                                .filter(h => (!categoryId || h.categoryId === categoryId) && !h.archived)
                                                                .map(habit => (
                                                                    <option key={habit.id} value={habit.id}>
                                                                        {habit.name}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                        <p className="text-[10px] text-neutral-600 mt-1">
                                                            Reaching this step will generate potential evidence for the selected habit.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                </div>


                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-neutral-900 flex justify-between items-center">
                    <div>
                        {validationError && (
                            <span className="text-red-400 text-sm">{validationError}</span>
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
                            className="px-6 py-2 bg-emerald-500 text-neutral-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                            {mode === 'create' ? 'Create Routine' : 'Save Changes'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
