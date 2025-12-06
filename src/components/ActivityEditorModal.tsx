import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useActivityStore } from '../store/ActivityContext';
import { useHabitStore } from '../store/HabitContext';
import type { Activity, ActivityStep, ActivityStepType } from '../types';

interface ActivityEditorModalProps {
    isOpen: boolean;
    mode: 'create' | 'edit';
    initialActivity?: Activity; // required when mode === 'edit'
    prefillSteps?: ActivityStep[]; // optional pre-filled steps for create mode
    onClose: () => void;
}

export const ActivityEditorModal: React.FC<ActivityEditorModalProps> = ({
    isOpen,
    mode,
    initialActivity,
    prefillSteps,
    onClose,
}) => {
    const { addActivity, updateActivity } = useActivityStore();
    const { habits } = useHabitStore();
    const [title, setTitle] = useState('');
    const [steps, setSteps] = useState<ActivityStep[]>([]);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [deleteConfirmStepId, setDeleteConfirmStepId] = useState<string | null>(null);

    // Initialize state from initialActivity or prefillSteps
    useEffect(() => {
        if (!isOpen) return;

        if (mode === 'edit' && initialActivity) {
            // Clone activity data for editing
            setTitle(initialActivity.title);
            setSteps(initialActivity.steps.map(step => ({ ...step })));
            setValidationError(null);
        } else if (mode === 'create') {
            // Initialize with prefillSteps if provided, otherwise empty
            setTitle('');
            setSteps(prefillSteps ? prefillSteps.map(step => ({ ...step })) : []);
            setValidationError(null);
        }
    }, [isOpen, mode, initialActivity, prefillSteps]);

    if (!isOpen) return null;

    const generateStepId = (): string => {
        return crypto.randomUUID();
    };

    const addStep = () => {
        const newStep: ActivityStep = {
            id: generateStepId(),
            type: 'task',
            title: '',
        };
        setSteps([...steps, newStep]);
    };

    const removeStep = (stepId: string) => {
        const step = steps.find(s => s.id === stepId);
        // If it's a habit step, require confirmation
        if (step?.type === 'habit' && deleteConfirmStepId !== stepId) {
            setDeleteConfirmStepId(stepId);
            setTimeout(() => setDeleteConfirmStepId(null), 5000);
            return;
        }
        setSteps(steps.filter(s => s.id !== stepId));
        setDeleteConfirmStepId(null);
    };

    const updateStep = (stepId: string, updates: Partial<ActivityStep>) => {
        setSteps(steps.map(s => (s.id === stepId ? { ...s, ...updates } : s)));
    };

    const validate = (): { isValid: boolean; error: string | null } => {
        if (!title.trim()) {
            return { isValid: false, error: 'Activity title is required' };
        }

        // Validate habit steps have habitId
        for (const step of steps) {
            if (step.type === 'habit' && !step.habitId?.trim()) {
                return { isValid: false, error: `Habit step "${step.title || 'Untitled'}" requires a habit selection` };
            }
            if (!step.title.trim()) {
                return { isValid: false, error: 'All steps must have a title' };
            }
        }

        return { isValid: true, error: null };
    };

    // Real-time validation for save button state
    const hasValidationErrors = (): boolean => {
        const result = validate();
        return !result.isValid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validation = validate();
        if (!validation.isValid) {
            setValidationError(validation.error);
            return;
        }
        setValidationError(null);

        try {
            if (mode === 'create') {
                await addActivity({
                    title: title.trim(),
                    steps: steps.map(step => ({
                        id: step.id,
                        type: step.type,
                        title: step.title.trim(),
                        instruction: step.instruction?.trim() || undefined,
                        imageUrl: step.imageUrl?.trim() || undefined,
                        durationSeconds: step.durationSeconds,
                        habitId: step.habitId || undefined,
                        timeEstimateMinutes: step.timeEstimateMinutes,
                    })),
                });
            } else if (mode === 'edit' && initialActivity) {
                await updateActivity(initialActivity.id, {
                    title: title.trim(),
                    steps: steps.map(step => ({
                        id: step.id,
                        type: step.type,
                        title: step.title.trim(),
                        instruction: step.instruction?.trim() || undefined,
                        imageUrl: step.imageUrl?.trim() || undefined,
                        durationSeconds: step.durationSeconds,
                        habitId: step.habitId || undefined,
                        timeEstimateMinutes: step.timeEstimateMinutes,
                    })),
                });
            }
            onClose();
        } catch (error) {
            console.error(`Failed to ${mode} activity:`, error);
            // Don't close modal on error, let user retry
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white">
                        {mode === 'create' ? 'Create Activity' : 'Edit Activity'}
                    </h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Title Input */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">
                                Activity Title <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                placeholder="e.g., Morning Routine"
                                required
                            />
                        </div>

                        {/* Steps Editor */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <label className="block text-sm font-medium text-neutral-400">
                                    Steps {steps.length === 0 && <span className="text-yellow-400 text-xs">(no steps yet)</span>}
                                </label>
                                <button
                                    type="button"
                                    onClick={addStep}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 border border-white/10 rounded-lg text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors"
                                >
                                    <Plus size={16} />
                                    Add Step
                                </button>
                            </div>

                            <div className="space-y-4">
                                {steps.map((step, index) => (
                                    <div
                                        key={step.id}
                                        className="bg-neutral-800/50 border border-white/5 rounded-lg p-4 space-y-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-neutral-400">Step {index + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeStep(step.id)}
                                                className={`p-1.5 rounded transition-colors ${
                                                    deleteConfirmStepId === step.id
                                                        ? 'bg-red-500/20 text-red-400'
                                                        : 'text-neutral-500 hover:text-red-400 hover:bg-red-500/10'
                                                }`}
                                                title={
                                                    deleteConfirmStepId === step.id
                                                        ? 'Click again to confirm deletion'
                                                        : step.type === 'habit'
                                                        ? 'Remove Step (requires confirmation)'
                                                        : 'Remove Step'
                                                }
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {/* Step Type Toggle */}
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-400 mb-2">Type</label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newType: ActivityStepType = 'habit';
                                                        // When converting to habit, don't auto-select - require user to choose
                                                        updateStep(step.id, {
                                                            type: newType,
                                                            habitId: step.habitId || undefined, // Keep existing if present, otherwise undefined
                                                        });
                                                    }}
                                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                        step.type === 'habit'
                                                            ? 'bg-emerald-500 text-neutral-900'
                                                            : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                                    }`}
                                                >
                                                    Habit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // When converting from habit to task: clear habitId, keep other fields
                                                        updateStep(step.id, {
                                                            type: 'task',
                                                            habitId: undefined, // Clear habitId
                                                            // Keep: title, instruction, imageUrl, timeEstimateMinutes
                                                        });
                                                    }}
                                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                        step.type === 'task'
                                                            ? 'bg-emerald-500 text-neutral-900'
                                                            : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                                    }`}
                                                >
                                                    Task
                                                </button>
                                            </div>
                                            {/* Inline hints */}
                                            <p className="text-xs text-neutral-500 mt-1.5">
                                                {step.type === 'habit' ? (
                                                    <span>Counts toward daily tracking.</span>
                                                ) : (
                                                    <span>For guidance only, not tracked.</span>
                                                )}
                                            </p>
                                        </div>

                                        {/* Step Title */}
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-400 mb-1">
                                                Step Title <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={step.title}
                                                onChange={(e) => updateStep(step.id, { title: e.target.value })}
                                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                                placeholder="e.g., Brush Teeth"
                                                required
                                            />
                                        </div>

                                        {/* Habit Selector (for Habit steps) */}
                                        {step.type === 'habit' && (
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-400 mb-1">
                                                    Habit <span className="text-red-400">*</span>
                                                </label>
                                                <select
                                                    value={step.habitId || ''}
                                                    onChange={(e) => updateStep(step.id, { habitId: e.target.value })}
                                                    className={`w-full bg-neutral-800 border rounded-lg px-4 py-2 text-white focus:outline-none ${
                                                        !step.habitId?.trim()
                                                            ? 'border-red-500/50 focus:border-red-500'
                                                            : 'border-white/10 focus:border-emerald-500'
                                                    }`}
                                                    required
                                                >
                                                    <option value="">Select a habit...</option>
                                                    {habits.map((habit) => (
                                                        <option key={habit.id} value={habit.id}>
                                                            {habit.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {!step.habitId?.trim() && (
                                                    <p className="text-xs text-red-400 mt-1">A habit selection is required for habit steps</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Time Estimate (for Habit steps) */}
                                        {step.type === 'habit' && (
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-400 mb-1">
                                                    Time Estimate (minutes)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={step.timeEstimateMinutes || ''}
                                                    onChange={(e) =>
                                                        updateStep(step.id, {
                                                            timeEstimateMinutes: e.target.value ? Number(e.target.value) : undefined,
                                                        })
                                                    }
                                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                                    placeholder="e.g., 5"
                                                    min="0"
                                                />
                                            </div>
                                        )}

                                        {/* Instruction */}
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-400 mb-1">Instruction</label>
                                            <textarea
                                                value={step.instruction || ''}
                                                onChange={(e) => updateStep(step.id, { instruction: e.target.value })}
                                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 resize-none"
                                                placeholder="Optional detailed instructions..."
                                                rows={2}
                                            />
                                        </div>

                                        {/* Image URL */}
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-400 mb-1">Image URL</label>
                                            <input
                                                type="url"
                                                value={step.imageUrl || ''}
                                                onChange={(e) => updateStep(step.id, { imageUrl: e.target.value })}
                                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                                placeholder="https://example.com/image.jpg"
                                            />
                                        </div>

                                        {/* Duration (for Task steps) */}
                                        {step.type === 'task' && (
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-400 mb-1">
                                                    Duration (seconds)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={step.durationSeconds || ''}
                                                    onChange={(e) =>
                                                        updateStep(step.id, {
                                                            durationSeconds: e.target.value ? Number(e.target.value) : undefined,
                                                        })
                                                    }
                                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                                    placeholder="e.g., 300"
                                                    min="0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {steps.length === 0 && (
                                    <div className="text-center py-8 text-neutral-500 text-sm">
                                        No steps yet. Click "Add Step" to create your first step.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Validation Error */}
                        {validationError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                                {validationError}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={hasValidationErrors()}
                            className="px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {mode === 'create' ? 'Create Activity' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
