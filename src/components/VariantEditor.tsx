/**
 * VariantEditor — Per-variant configuration sub-component.
 *
 * Manages a single variant's name, description, estimated duration, and step list.
 * Uses StepEditorPanel for editing individual steps in a dedicated full-view.
 */
import React, { useState } from 'react';
import { Plus, Trash2, Link2, Clock, ChevronUp, ChevronDown, Timer } from 'lucide-react';
import type { RoutineVariant, RoutineStep } from '../models/persistenceTypes';
import type { Habit } from '../types';
import { StepEditorPanel } from './StepEditorPanel';

interface VariantEditorProps {
    variant: RoutineVariant;
    onChange: (updated: RoutineVariant) => void;
    onDelete?: () => void;
    habits: Habit[];
    categoryId?: string;
    onEditingStepChange?: (isEditing: boolean) => void;
}

export const VariantEditor: React.FC<VariantEditorProps> = ({
    variant,
    onChange,
    onDelete,
    habits,
    categoryId,
    onEditingStepChange,
}) => {
    const [editingStepId, setEditingStepId] = useState<string | null>(null);

    // Notify parent when editing state changes
    React.useEffect(() => {
        onEditingStepChange?.(editingStepId !== null);
    }, [editingStepId, onEditingStepChange]);

    const steps = variant.steps || [];

    const updateVariantField = (updates: Partial<RoutineVariant>) => {
        onChange({ ...variant, ...updates, updatedAt: new Date().toISOString() });
    };

    const recomputeLinkedHabits = (updatedSteps: RoutineStep[]) => {
        return Array.from(
            new Set(updatedSteps.map(s => s.linkedHabitId).filter(Boolean) as string[])
        );
    };

    const addStep = () => {
        const newId = crypto.randomUUID();
        const newStep: RoutineStep = { id: newId, title: '' };
        const updatedSteps = [...steps, newStep];
        updateVariantField({ steps: updatedSteps, linkedHabitIds: recomputeLinkedHabits(updatedSteps) });
        setEditingStepId(newId);
    };

    const updateStep = (id: string, updates: Partial<RoutineStep>) => {
        const updatedSteps = steps.map(s => s.id === id ? { ...s, ...updates } : s);
        updateVariantField({ steps: updatedSteps, linkedHabitIds: recomputeLinkedHabits(updatedSteps) });
    };

    const removeStep = (id: string) => {
        const updatedSteps = steps.filter(s => s.id !== id);
        updateVariantField({ steps: updatedSteps, linkedHabitIds: recomputeLinkedHabits(updatedSteps) });
        if (editingStepId === id) setEditingStepId(null);
    };

    const moveStep = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= steps.length) return;
        const reordered = [...steps];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        updateVariantField({ steps: reordered });
    };

    const editingStep = editingStepId ? steps.find(s => s.id === editingStepId) : null;

    // ── Step Editor full-view ──
    if (editingStep) {
        return (
            <StepEditorPanel
                step={editingStep}
                stepIndex={steps.findIndex(s => s.id === editingStepId)}
                totalSteps={steps.length}
                onChange={(updates) => updateStep(editingStep.id, updates)}
                onBack={() => setEditingStepId(null)}
                habits={habits}
                categoryId={categoryId}
            />
        );
    }

    // ── Step List view ──
    return (
        <div className="space-y-6">
            {/* Variant Metadata */}
            <div className="space-y-3">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Variant Name</label>
                        <input
                            type="text"
                            value={variant.name}
                            onChange={e => updateVariantField({ name: e.target.value })}
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                            placeholder="e.g., Quick, Standard, Deep"
                        />
                    </div>
                    <div className="w-28">
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Duration (min)</label>
                        <input
                            type="number"
                            min="1"
                            value={variant.estimatedDurationMinutes ?? ''}
                            onChange={e => {
                                const raw = e.target.value;
                                if (raw === '') {
                                    updateVariantField({ estimatedDurationMinutes: undefined as unknown as number });
                                } else {
                                    const val = parseInt(raw);
                                    if (!isNaN(val)) updateVariantField({ estimatedDurationMinutes: Math.max(1, val) });
                                }
                            }}
                            onBlur={() => {
                                if (!variant.estimatedDurationMinutes || variant.estimatedDurationMinutes < 1) {
                                    updateVariantField({ estimatedDurationMinutes: 1 });
                                }
                            }}
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                            placeholder="15"
                        />
                    </div>
                </div>
                <input
                    type="text"
                    value={variant.description || ''}
                    onChange={e => updateVariantField({ description: e.target.value || undefined })}
                    className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-400 focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                    placeholder="Description (optional)"
                />
            </div>

            {/* Steps Header */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-400">
                    Steps {steps.length > 0 && <span className="text-neutral-600">({steps.length})</span>}
                </label>
            </div>

            {/* Step Cards */}
            <div className="space-y-2">
                {steps.map((step, index) => {
                    const linkedHabit = step.linkedHabitId
                        ? habits.find(h => h.id === step.linkedHabitId)
                        : null;
                    const hasTimer = step.timerMode === 'countdown' || step.timerMode === 'stopwatch' || step.timerSeconds;

                    return (
                        <div
                            key={step.id}
                            className="group bg-neutral-800/50 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all"
                        >
                            <div className="flex items-center gap-3 p-3">
                                {/* Step number */}
                                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-xs text-neutral-500 flex-shrink-0">
                                    {index + 1}
                                </div>

                                {/* Step info — tappable to edit */}
                                <button
                                    type="button"
                                    onClick={() => setEditingStepId(step.id)}
                                    className="flex-1 text-left min-w-0"
                                >
                                    <div className="font-medium text-white truncate text-sm">
                                        {step.title || <span className="text-neutral-500 italic">Untitled Step</span>}
                                    </div>
                                    {/* Badges row */}
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {linkedHabit && (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
                                                <Link2 size={10} /> {linkedHabit.name}
                                            </span>
                                        )}
                                        {hasTimer && (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 bg-white/5 rounded-full px-2 py-0.5">
                                                {step.timerMode === 'stopwatch' ? <Timer size={10} /> : <Clock size={10} />}
                                                {step.timerMode === 'stopwatch'
                                                    ? 'Stopwatch'
                                                    : step.timerSeconds
                                                        ? `${(step.timerSeconds / 60).toFixed(1)}m`
                                                        : 'Timer'}
                                            </span>
                                        )}
                                        {step.trackingFields && step.trackingFields.length > 0 && (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 bg-white/5 rounded-full px-2 py-0.5">
                                                {step.trackingFields.length} field{step.trackingFields.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {/* Actions */}
                                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => moveStep(index, -1)}
                                        className="p-1.5 text-neutral-500 hover:text-white transition-colors disabled:opacity-20"
                                        title="Move Up"
                                        disabled={index === 0}
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveStep(index, 1)}
                                        className="p-1.5 text-neutral-500 hover:text-white transition-colors disabled:opacity-20"
                                        title="Move Down"
                                        disabled={index === steps.length - 1}
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeStep(step.id)}
                                        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                                        title="Delete Step"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Add Step card */}
                <button
                    type="button"
                    onClick={addStep}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-neutral-700 hover:border-emerald-500/50 rounded-xl text-neutral-400 hover:text-emerald-400 transition-all"
                >
                    <Plus size={18} />
                    <span className="text-sm font-medium">Add Step</span>
                </button>
            </div>

            {/* Delete Variant */}
            {onDelete && (
                <div className="pt-2 border-t border-white/5">
                    <button
                        type="button"
                        onClick={onDelete}
                        className="flex items-center gap-2 text-red-400/70 hover:text-red-400 text-sm transition-colors"
                    >
                        <Trash2 size={14} /> Delete this variant
                    </button>
                </div>
            )}
        </div>
    );
};
