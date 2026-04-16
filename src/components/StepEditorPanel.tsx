/**
 * StepEditorPanel — Dedicated full-view editor for a single routine step.
 *
 * Replaces the inline accordion approach. Takes over the modal content area
 * when the user taps a step or "Add Step", giving step editing a page-like feel.
 *
 * Key UX improvements:
 * - Habit linking is a prominent, first-class section with tappable chips
 * - All fields are laid out spaciously instead of crammed into an accordion
 * - Back button returns to the step list
 */
import React, { useState, useRef } from 'react';
import {
    ArrowLeft,
    Clock,
    Timer,
    Image as ImageIcon,
    Loader2,
    X,
    Plus,
    Link2,
    BarChart3,
    Check,
} from 'lucide-react';
import type { RoutineStep, TrackingFieldDef } from '../models/persistenceTypes';
import type { Habit } from '../types';

interface StepEditorPanelProps {
    step: RoutineStep;
    stepIndex: number;
    totalSteps: number;
    onChange: (updates: Partial<RoutineStep>) => void;
    onBack: () => void;
    habits: Habit[];
    categoryId?: string;
}

export const StepEditorPanel: React.FC<StepEditorPanelProps> = ({
    step,
    stepIndex,
    totalSteps,
    onChange,
    onBack,
    habits,
    categoryId,
}) => {
    const [uploadingImage, setUploadingImage] = useState(false);
    const [habitSearch, setHabitSearch] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredHabits = habits.filter(
        h => (!categoryId || h.categoryId === categoryId) && !h.archived
    );

    const searchedHabits = habitSearch.trim()
        ? filteredHabits.filter(h =>
              h.name.toLowerCase().includes(habitSearch.toLowerCase())
          )
        : filteredHabits;

    const linkedHabit = step.linkedHabitId
        ? habits.find(h => h.id === step.linkedHabitId)
        : null;

    const handleImageUpload = async (file: File) => {
        setUploadingImage(true);
        try {
            const url = URL.createObjectURL(file);
            onChange({ imageUrl: url });
        } catch (error) {
            console.error('Failed to upload step image:', error);
        } finally {
            setUploadingImage(false);
        }
    };

    return (
        <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-200">
            {/* Header with back button */}
            <div className="flex items-center gap-3 pb-4 border-b border-line-subtle mb-6">
                <button
                    type="button"
                    onClick={onBack}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-content-secondary hover:text-content-primary transition-colors rounded-lg hover:bg-surface-2 -ml-2"
                    aria-label="Back to steps"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-content-primary">
                        {step.title || 'New Step'}
                    </h3>
                    <p className="text-xs text-content-muted">
                        Step {stepIndex + 1} of {totalSteps}
                    </p>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto space-y-6 pb-4 modal-scroll">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2">
                        Step Title
                    </label>
                    <input
                        type="text"
                        value={step.title}
                        onChange={e => onChange({ title: e.target.value })}
                        className="w-full bg-surface-1 border border-line-subtle rounded-lg px-4 py-3 text-content-primary focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                        placeholder="e.g., Drink Water"
                        autoFocus
                    />
                </div>

                {/* Instructions */}
                <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2">
                        Instructions (Optional)
                    </label>
                    <textarea
                        value={step.instruction || ''}
                        onChange={e => onChange({ instruction: e.target.value || undefined })}
                        className="w-full bg-surface-1 border border-line-subtle rounded-lg p-4 text-sm text-content-secondary placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                        placeholder="Detailed instructions for this step..."
                        rows={3}
                    />
                </div>

                {/* Timer */}
                <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2">
                        Timer
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 bg-surface-1 border border-line-subtle rounded-lg p-1">
                            <button
                                type="button"
                                onClick={() => onChange({ timerMode: undefined, timerSeconds: undefined })}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    !step.timerMode && !step.timerSeconds
                                        ? 'bg-white/10 text-content-primary'
                                        : 'text-content-muted hover:text-content-secondary'
                                }`}
                            >
                                Off
                            </button>
                            <button
                                type="button"
                                onClick={() => onChange({ timerMode: 'countdown', timerSeconds: step.timerSeconds || 60 })}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                                    step.timerMode === 'countdown' || (!step.timerMode && step.timerSeconds)
                                        ? 'bg-accent-soft text-accent-contrast'
                                        : 'text-content-muted hover:text-content-secondary'
                                }`}
                            >
                                <Clock size={14} /> Countdown
                            </button>
                            <button
                                type="button"
                                onClick={() => onChange({ timerMode: 'stopwatch', timerSeconds: undefined })}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                                    step.timerMode === 'stopwatch'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'text-content-muted hover:text-content-secondary'
                                }`}
                            >
                                <Timer size={14} /> Stopwatch
                            </button>
                        </div>

                        {(step.timerMode === 'countdown' || (!step.timerMode && step.timerSeconds)) && (
                            <div className="flex items-center gap-2 bg-surface-1 border border-line-subtle rounded-lg px-3 py-2">
                                <Clock size={16} className="text-content-muted" />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={step.timerSeconds ? step.timerSeconds / 60 : ''}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value);
                                        onChange({ timerSeconds: isNaN(val) ? undefined : Math.max(0, Math.round(val * 60)) });
                                    }}
                                    placeholder="Min"
                                    className="bg-transparent w-20 text-sm focus:outline-none text-content-primary placeholder-neutral-600"
                                />
                                <span className="text-xs text-content-muted">min</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Linked Habit — prominent section ── */}
                <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2 flex items-center gap-1.5">
                        <Link2 size={14} /> Link a Habit
                    </label>
                    <p className="text-xs text-content-muted mb-3">
                        Completing this step can log progress for a habit automatically.
                    </p>

                    {/* Currently linked habit */}
                    {linkedHabit && (
                        <div className="flex items-center gap-3 bg-accent-soft border border-accent/30 rounded-xl px-4 py-3 mb-3">
                            <Check size={16} className="text-accent-contrast flex-shrink-0" />
                            <span className="flex-1 text-sm font-medium text-content-primary">
                                {linkedHabit.name}
                            </span>
                            <button
                                type="button"
                                onClick={() => onChange({ linkedHabitId: undefined })}
                                className="p-1.5 text-content-secondary hover:text-red-400 transition-colors rounded-lg"
                                title="Unlink habit"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Habit search & selection */}
                    {filteredHabits.length > 0 && (
                        <div className="space-y-2">
                            {filteredHabits.length > 5 && (
                                <input
                                    type="text"
                                    value={habitSearch}
                                    onChange={e => setHabitSearch(e.target.value)}
                                    className="w-full bg-surface-1 border border-line-subtle rounded-lg px-3 py-2 text-sm text-content-primary focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                                    placeholder="Search habits..."
                                />
                            )}
                            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                {searchedHabits.map(habit => {
                                    const isLinked = step.linkedHabitId === habit.id;
                                    return (
                                        <button
                                            key={habit.id}
                                            type="button"
                                            onClick={() =>
                                                onChange({
                                                    linkedHabitId: isLinked ? undefined : habit.id,
                                                })
                                            }
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                isLinked
                                                    ? 'bg-accent-soft text-accent-contrast border border-emerald-500/40'
                                                    : 'bg-surface-1 text-content-secondary border border-line-subtle hover:border-accent/30 hover:text-content-primary'
                                            }`}
                                        >
                                            {isLinked && <Check size={12} className="inline mr-1.5" />}
                                            {habit.name}
                                        </button>
                                    );
                                })}
                            </div>
                            {habitSearch && searchedHabits.length === 0 && (
                                <p className="text-xs text-content-muted py-2">
                                    No habits match &quot;{habitSearch}&quot;
                                </p>
                            )}
                        </div>
                    )}
                    {filteredHabits.length === 0 && (
                        <p className="text-xs text-content-muted bg-surface-1/50 rounded-lg px-3 py-3">
                            No habits available{categoryId ? ' in this category' : ''}. Create habits first to link them to steps.
                        </p>
                    )}
                </div>

                {/* Image */}
                <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2 flex items-center gap-1.5">
                        <ImageIcon size={14} /> Step Image (Optional)
                    </label>
                    {step.imageUrl && (
                        <div className="relative group w-full aspect-video bg-surface-1 rounded-lg overflow-hidden border border-line-subtle mb-2">
                            <img
                                src={step.imageUrl}
                                alt="Step preview"
                                className="w-full h-full object-cover"
                            />
                            <button
                                onClick={() => onChange({ imageUrl: undefined })}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 text-content-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                title="Remove Image"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="flex items-center gap-2 px-4 py-2 bg-surface-1 border border-line-subtle rounded-lg text-sm text-content-secondary hover:bg-surface-2 transition-colors"
                        >
                            {uploadingImage ? (
                                <Loader2 size={16} className="animate-spin text-emerald-500" />
                            ) : (
                                <ImageIcon size={16} />
                            )}
                            {step.imageUrl ? 'Replace' : 'Upload Image'}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                                if (e.target.files?.[0]) handleImageUpload(e.target.files[0]);
                                e.target.value = '';
                            }}
                        />
                        <span className="text-xs text-content-muted">or</span>
                        <input
                            type="text"
                            value={step.imageUrl || ''}
                            onChange={e => onChange({ imageUrl: e.target.value || undefined })}
                            placeholder="Paste image URL"
                            className="flex-1 bg-surface-1 border border-line-subtle rounded-lg px-3 py-2 text-sm text-content-primary focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                        />
                    </div>
                </div>

                {/* Tracking Fields */}
                <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2 flex items-center gap-1.5">
                        <BarChart3 size={14} /> Tracking Fields (Optional)
                    </label>
                    <p className="text-xs text-content-muted mb-3">
                        Define fields to capture during execution (e.g., weight, reps, BPM).
                    </p>
                    <div className="space-y-2">
                        {(step.trackingFields || []).map((field: TrackingFieldDef) => (
                            <div
                                key={field.id}
                                className="flex items-center gap-2 bg-surface-1 border border-line-subtle rounded-lg p-3"
                            >
                                <input
                                    type="text"
                                    value={field.label}
                                    onChange={e => {
                                        const updated = (step.trackingFields || []).map(f =>
                                            f.id === field.id ? { ...f, label: e.target.value } : f
                                        );
                                        onChange({ trackingFields: updated });
                                    }}
                                    placeholder="Label (e.g., Weight)"
                                    className="flex-1 bg-transparent text-sm text-content-primary focus:outline-none placeholder-neutral-600"
                                />
                                <select
                                    value={field.type}
                                    onChange={e => {
                                        const updated = (step.trackingFields || []).map(f =>
                                            f.id === field.id
                                                ? { ...f, type: e.target.value as 'number' | 'text' }
                                                : f
                                        );
                                        onChange({ trackingFields: updated });
                                    }}
                                    className="bg-surface-0 border border-line-subtle rounded px-2 py-1 text-xs text-content-secondary focus:outline-none"
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
                                        onChange({ trackingFields: updated });
                                    }}
                                    placeholder="Unit"
                                    className="w-16 bg-transparent text-sm text-content-secondary focus:outline-none placeholder-neutral-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const updated = (step.trackingFields || []).filter(
                                            f => f.id !== field.id
                                        );
                                        onChange({ trackingFields: updated.length > 0 ? updated : undefined });
                                    }}
                                    className="p-1 text-content-muted hover:text-red-400 transition-colors"
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
                                onChange({
                                    trackingFields: [...(step.trackingFields || []), newField],
                                });
                            }}
                            className="flex items-center gap-1.5 text-sm text-content-muted hover:text-content-secondary transition-colors py-2"
                        >
                            <Plus size={14} /> Add tracking field
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
