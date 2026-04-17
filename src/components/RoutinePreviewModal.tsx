import React, { useState, useEffect } from 'react';
import { X, Play, Clock, ListChecks, Link as LinkIcon, Layers } from 'lucide-react';
import type { Routine } from '../models/persistenceTypes';
import { useHabitStore } from '../store/HabitContext';
import { resolveVariant, resolveSteps, isMultiVariant, getEstimatedDurationMinutes } from '../lib/routineVariantUtils';
import { VariantCard } from './VariantCard';

interface RoutinePreviewModalProps {
    isOpen: boolean;
    routine?: Routine;
    onClose: () => void;
    onStart: (routine: Routine, variantId?: string) => void;
    onEdit?: (routine: Routine, variantId: string) => void;
}

export const RoutinePreviewModal: React.FC<RoutinePreviewModalProps> = ({
    isOpen,
    routine,
    onClose,
    onStart,
    onEdit,
}) => {
    const { habits } = useHabitStore();
    const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);

    // Reset selection when routine changes
    useEffect(() => {
        if (routine) {
            const defaultVariant = resolveVariant(routine);
            setSelectedVariantId(defaultVariant?.id);
        }
    }, [routine?.id]);

    if (!isOpen || !routine) return null;

    const hasMultipleVariants = isMultiVariant(routine);
    const selectedVariant = resolveVariant(routine, selectedVariantId);
    const steps = selectedVariant?.steps || resolveSteps(routine);
    const totalSteps = steps.length;
    const durationMinutes = selectedVariant
        ? selectedVariant.estimatedDurationMinutes
        : getEstimatedDurationMinutes(routine);

    const linkedHabitIds = selectedVariant?.linkedHabitIds || routine.linkedHabitIds || [];
    const linkedHabits = habits.filter(h => linkedHabitIds.includes(h.id));

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-surface-0 border border-line-subtle rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] animate-fade-in-up">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-line-subtle">
                    <div>
                        <h2 className="text-2xl font-bold text-content-primary">{routine.title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-1 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Routine Image */}
                {routine.imageUrl && (
                    <div className="w-full aspect-video bg-surface-1/50 border-b border-line-subtle overflow-hidden">
                        <img src={routine.imageUrl} alt={routine.title} className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Variant Selector */}
                    {hasMultipleVariants && routine.variants && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-content-muted uppercase tracking-wider flex items-center gap-2">
                                <Layers size={14} />
                                Choose Variant
                            </h3>
                            <div className="grid gap-2" role="listbox">
                                {routine.variants
                                    .sort((a, b) => a.sortOrder - b.sortOrder)
                                    .map(variant => (
                                        <VariantCard
                                            key={variant.id}
                                            variant={variant}
                                            isSelected={selectedVariantId === variant.id}
                                            onClick={() => setSelectedVariantId(variant.id)}
                                            onEdit={onEdit ? () => onEdit(routine, variant.id) : undefined}
                                        />
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-1 rounded-lg text-content-secondary text-sm">
                            <ListChecks size={16} />
                            <span>{totalSteps} Steps</span>
                        </div>
                        {durationMinutes > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-1 rounded-lg text-content-secondary text-sm">
                                <Clock size={16} />
                                <span>~{durationMinutes} mins</span>
                            </div>
                        )}
                    </div>

                    {/* Linked Habits */}
                    {linkedHabits.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-content-muted uppercase tracking-wider flex items-center gap-2">
                                <LinkIcon size={14} />
                                Linked Habits
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {linkedHabits.map(habit => (
                                    <div
                                        key={habit.id}
                                        className="px-3 py-1 bg-accent-soft border border-accent/20 text-accent-contrast rounded-full text-sm font-medium"
                                    >
                                        {habit.name}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-content-muted italic">
                                * Starting this routine will prepare these habits for confirmation.
                            </p>
                        </div>
                    )}

                    {/* Steps Preview */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-content-muted uppercase tracking-wider">
                            Steps Sequence
                        </h3>
                        <div className="space-y-2 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-surface-1">
                            {steps.map((step, index) => (
                                <div key={step.id} className="relative flex items-start gap-4 p-2 rounded-lg hover:bg-surface-1/50 transition-colors">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-1 border border-line-strong flex items-center justify-center text-sm font-medium text-content-secondary z-10">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <h4 className="text-content-primary font-medium">{step.title}</h4>
                                        {step.timerSeconds && (
                                            <span className="text-xs text-content-muted flex items-center gap-1 mt-1">
                                                <Clock size={12} />
                                                {Math.floor(step.timerSeconds / 60)}:{(step.timerSeconds % 60).toString().padStart(2, '0')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-line-subtle bg-surface-0/50 backdrop-blur-md flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-content-secondary hover:text-content-primary transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onStart(routine, selectedVariantId);
                            onClose();
                        }}
                        className="flex items-center gap-2 px-6 py-2 bg-accent text-content-on-accent font-bold rounded-lg hover:bg-accent-strong transition-colors shadow-lg shadow-emerald-500/20"
                    >
                        <Play size={18} />
                        {hasMultipleVariants && selectedVariant
                            ? `Start ${selectedVariant.name}`
                            : 'Start Routine'
                        }
                    </button>
                </div>

            </div>
        </div>
    );
};
