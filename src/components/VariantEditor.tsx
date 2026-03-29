/**
 * VariantEditor — Per-variant configuration sub-component.
 *
 * Manages a single variant's name, description, estimated duration, and step list.
 * Used within RoutineEditorModal for each variant tab.
 */
import React, { useState } from 'react';
import { Plus, Trash2, Link2, Clock, Image as ImageIcon, Loader2, ChevronDown, ChevronUp, X, Timer, BarChart3 } from 'lucide-react';
import type { RoutineVariant, RoutineStep, TrackingFieldDef } from '../models/persistenceTypes';
import type { Habit } from '../types';

interface VariantEditorProps {
    variant: RoutineVariant;
    onChange: (updated: RoutineVariant) => void;
    onDelete?: () => void;
    habits: Habit[];
    categoryId?: string;
}

export const VariantEditor: React.FC<VariantEditorProps> = ({
    variant,
    onChange,
    onDelete,
    habits,
    categoryId,
}) => {
    const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
    const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);

    const steps = variant.steps || [];

    const updateVariantField = (updates: Partial<RoutineVariant>) => {
        onChange({ ...variant, ...updates, updatedAt: new Date().toISOString() });
    };

    const addStep = () => {
        const newId = crypto.randomUUID();
        const newStep: RoutineStep = { id: newId, title: '' };
        updateVariantField({ steps: [...steps, newStep] });
        setExpandedStepId(newId);
    };

    const updateStep = (id: string, updates: Partial<RoutineStep>) => {
        const updatedSteps = steps.map(s => s.id === id ? { ...s, ...updates } : s);
        // Recompute linkedHabitIds from steps
        const linkedHabitIds = Array.from(
            new Set(updatedSteps.map(s => s.linkedHabitId).filter(Boolean) as string[])
        );
        updateVariantField({ steps: updatedSteps, linkedHabitIds });
    };

    const removeStep = (id: string) => {
        const updatedSteps = steps.filter(s => s.id !== id);
        const linkedHabitIds = Array.from(
            new Set(updatedSteps.map(s => s.linkedHabitId).filter(Boolean) as string[])
        );
        updateVariantField({ steps: updatedSteps, linkedHabitIds });
        if (expandedStepId === id) setExpandedStepId(null);
    };

    const moveStep = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= steps.length) return;
        const reordered = [...steps];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        updateVariantField({ steps: reordered });
    };

    const handleStepImageUpload = async (file: File, stepId: string) => {
        setUploadingStepId(stepId);
        try {
            const url = URL.createObjectURL(file);
            updateStep(stepId, { imageUrl: url });
        } catch (error) {
            console.error('Failed to upload step image:', error);
        } finally {
            setUploadingStepId(null);
        }
    };

    const filteredHabits = habits.filter(h => (!categoryId || h.categoryId === categoryId) && !h.archived);

    return (
        <div className="space-y-6">
            {/* Variant Metadata */}
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Variant Name</label>
                    <input
                        type="text"
                        value={variant.name}
                        onChange={e => updateVariantField({ name: e.target.value })}
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                        placeholder="e.g., Quick, Standard, Deep"
                    />
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Description (Optional)</label>
                        <input
                            type="text"
                            value={variant.description || ''}
                            onChange={e => updateVariantField({ description: e.target.value || undefined })}
                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                            placeholder="Brief description of this variant"
                        />
                    </div>
                    <div className="w-32">
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
            </div>

            {/* Steps */}
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
                        <div className="text-center py-8 border-2 border-dashed border-neutral-800 rounded-xl">
                            <p className="text-neutral-500 text-sm">No steps yet. Add one to get started.</p>
                        </div>
                    )}
                    {steps.map((step, index) => {
                        const isExpanded = expandedStepId === step.id;
                        return (
                            <div key={step.id} className="bg-neutral-800/50 border border-white/5 rounded-xl overflow-hidden transition-all duration-200">
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
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); moveStep(index, -1); }}
                                            className="p-1.5 text-neutral-600 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-neutral-600"
                                            title="Move Up"
                                            disabled={index === 0}
                                        >
                                            <ChevronUp size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); moveStep(index, 1); }}
                                            className="p-1.5 text-neutral-600 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-neutral-600"
                                            title="Move Down"
                                            disabled={index === steps.length - 1}
                                        >
                                            <ChevronDown size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeStep(step.id);
                                            }}
                                            className="p-1.5 text-neutral-600 hover:text-red-400 transition-colors"
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
                                                autoFocus
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
                                            {/* Timer Mode Selector */}
                                            <div className="flex items-center gap-1 bg-neutral-900 border border-white/10 rounded-lg p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => updateStep(step.id, { timerMode: undefined, timerSeconds: undefined })}
                                                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                                        !step.timerMode && !step.timerSeconds ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                                    title="No timer"
                                                >
                                                    Off
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateStep(step.id, { timerMode: 'countdown', timerSeconds: step.timerSeconds || 60 })}
                                                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                                                        (step.timerMode === 'countdown' || (!step.timerMode && step.timerSeconds)) ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                                    title="Countdown timer"
                                                >
                                                    <Clock size={12} /> Countdown
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateStep(step.id, { timerMode: 'stopwatch', timerSeconds: undefined })}
                                                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                                                        step.timerMode === 'stopwatch' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                                    title="Stopwatch (counts up)"
                                                >
                                                    <Timer size={12} /> Stopwatch
                                                </button>
                                            </div>

                                            {/* Duration input (only for countdown) */}
                                            {(step.timerMode === 'countdown' || (!step.timerMode && step.timerSeconds)) && (
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
                                            )}

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
                                                            handleStepImageUpload(e.target.files[0], step.id);
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
                                                {filteredHabits.map(habit => (
                                                    <option key={habit.id} value={habit.id}>
                                                        {habit.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-neutral-600 mt-1">
                                                Reaching this step will generate potential evidence for the selected habit.
                                            </p>
                                        </div>

                                        {/* Tracking Fields */}
                                        <div className="pt-2">
                                            <label className="block text-xs font-medium text-neutral-500 mb-2 flex items-center gap-1">
                                                <BarChart3 size={12} /> Tracking Fields (Optional)
                                            </label>
                                            <div className="space-y-2">
                                                {(step.trackingFields || []).map((field: TrackingFieldDef) => (
                                                    <div key={field.id} className="flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-lg p-2">
                                                        <input
                                                            type="text"
                                                            value={field.label}
                                                            onChange={e => {
                                                                const updated = (step.trackingFields || []).map(f =>
                                                                    f.id === field.id ? { ...f, label: e.target.value } : f
                                                                );
                                                                updateStep(step.id, { trackingFields: updated });
                                                            }}
                                                            placeholder="Label (e.g., Weight)"
                                                            className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder-neutral-600"
                                                        />
                                                        <select
                                                            value={field.type}
                                                            onChange={e => {
                                                                const updated = (step.trackingFields || []).map(f =>
                                                                    f.id === field.id ? { ...f, type: e.target.value as 'number' | 'text' } : f
                                                                );
                                                                updateStep(step.id, { trackingFields: updated });
                                                            }}
                                                            className="bg-neutral-800 border border-white/10 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
                                                        >
                                                            <option value="number">Number</option>
                                                            <option value="text">Text</option>
                                                        </select>
                                                        <input
                                                            type="text"
                                                            value={field.unit || ''}
                                                            onChange={e => {
                                                                const updated = (step.trackingFields || []).map(f =>
                                                                    f.id === field.id ? { ...f, unit: e.target.value || undefined } : f
                                                                );
                                                                updateStep(step.id, { trackingFields: updated });
                                                            }}
                                                            placeholder="Unit"
                                                            className="w-16 bg-transparent text-sm text-neutral-400 focus:outline-none placeholder-neutral-600"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const updated = (step.trackingFields || []).filter(f => f.id !== field.id);
                                                                updateStep(step.id, { trackingFields: updated.length > 0 ? updated : undefined });
                                                            }}
                                                            className="p-1 text-neutral-600 hover:text-red-400 transition-colors"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newField: TrackingFieldDef = {
                                                            id: crypto.randomUUID(),
                                                            label: '',
                                                            type: 'number',
                                                        };
                                                        updateStep(step.id, {
                                                            trackingFields: [...(step.trackingFields || []), newField],
                                                        });
                                                    }}
                                                    className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                                                >
                                                    <Plus size={12} /> Add tracking field
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-neutral-600 mt-1">
                                                Define fields to track during execution (e.g., weight, reps, BPM).
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
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
