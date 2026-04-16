import React, { useState, useEffect, useRef } from 'react';
import { X, Target, CalendarCheck, Calendar } from 'lucide-react';
import { createGoal } from '../lib/persistenceClient';

interface GoalCreationInlineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoalCreated: (goalId: string) => void;
    defaultCategoryId?: string;
}

export const GoalCreationInlineModal: React.FC<GoalCreationInlineModalProps> = ({
    isOpen,
    onClose,
    onGoalCreated,
    defaultCategoryId,
}) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'cumulative' | 'onetime'>('cumulative');
    const [targetValue, setTargetValue] = useState('');
    const [unit, setUnit] = useState('');
    const [deadline, setDeadline] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deadlineInputRef = useRef<HTMLInputElement>(null);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setType('cumulative');
            setTargetValue('');
            setUnit('');
            setDeadline('');
            setError(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isFormValid = (() => {
        if (!title.trim()) return false;
        if (type === 'cumulative') {
            return targetValue !== '' && !isNaN(parseFloat(targetValue)) && parseFloat(targetValue) > 0;
        }
        return true;
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;

        setIsSubmitting(true);
        setError(null);

        try {
            let targetValueNum = parseFloat(targetValue);
            if (type === 'onetime') {
                targetValueNum = 1;
            }

            const goal = await createGoal({
                title: title.trim(),
                type,
                targetValue: targetValueNum,
                unit: type !== 'onetime' ? (unit.trim() || undefined) : undefined,
                linkedHabitIds: [],
                deadline: deadline || undefined,
                categoryId: defaultCategoryId || undefined,
            });

            onGoalCreated(goal.id);
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create goal';
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <div
            className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); handleCancel(); } }}
        >
            <div className="w-full max-w-md bg-surface-0 border border-line-subtle rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-content-primary">Create New Goal</h3>
                    <button onClick={handleCancel} className="text-content-secondary hover:text-content-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1">
                            Title <span className="text-danger-contrast">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-surface-1 border border-line-subtle rounded-lg px-4 py-2 text-content-primary focus:outline-none focus:border-focus"
                            placeholder="e.g., Run a Marathon"
                            autoFocus
                        />
                    </div>

                    {/* Goal Type */}
                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1">
                            Goal Type <span className="text-danger-contrast">*</span>
                        </label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setType('cumulative')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${type === 'cumulative'
                                    ? 'bg-accent-soft border-accent/50 ring-1 ring-focus/20'
                                    : 'bg-surface-1 border-line-subtle hover:border-line-subtle hover:bg-surface-2'
                                    }`}
                            >
                                <Target size={16} className={type === 'cumulative' ? 'text-accent-contrast' : 'text-content-secondary'} />
                                <span className="text-content-primary text-sm font-medium">Cumulative</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('onetime')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${type === 'onetime'
                                    ? 'bg-accent-soft border-accent/50 ring-1 ring-focus/20'
                                    : 'bg-surface-1 border-line-subtle hover:border-line-subtle hover:bg-surface-2'
                                    }`}
                            >
                                <CalendarCheck size={16} className={type === 'onetime' ? 'text-accent-contrast' : 'text-content-secondary'} />
                                <span className="text-content-primary text-sm font-medium">One-Time</span>
                            </button>
                        </div>
                    </div>

                    {/* Target Value + Unit (cumulative only) */}
                    {type === 'cumulative' && (
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-content-secondary mb-1">
                                    Target Value <span className="text-danger-contrast">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                    className="w-full bg-surface-1 border border-line-subtle rounded-lg px-4 py-2 text-content-primary focus:outline-none focus:border-focus"
                                    placeholder="e.g., 100"
                                    min="0.01"
                                    step="0.01"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-content-secondary mb-1">
                                    Unit <span className="text-content-muted">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    className="w-full bg-surface-1 border border-line-subtle rounded-lg px-4 py-2 text-content-primary focus:outline-none focus:border-focus"
                                    placeholder="e.g., miles"
                                />
                            </div>
                        </div>
                    )}

                    {/* Deadline */}
                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1">
                            {type === 'onetime' ? 'Event Date' : 'Deadline'} <span className="text-content-muted">(Optional)</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => deadlineInputRef.current?.showPicker()}
                                    className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border transition-all ${
                                        deadline
                                            ? 'bg-accent-soft border-accent/50 text-accent-contrast'
                                            : 'bg-surface-1 border-line-subtle text-content-secondary hover:border-line-strong hover:text-content-primary'
                                    }`}
                                    aria-label={deadline ? `Date: ${deadline}` : 'Set date'}
                                >
                                    <Calendar size={18} />
                                </button>
                                <input
                                    ref={deadlineInputRef}
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                    min={new Date().toISOString().split('T')[0]}
                                    aria-label="Date"
                                />
                            </div>
                            {deadline && (
                                <span className="text-sm text-accent-contrast">{deadline}</span>
                            )}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-sm text-danger-contrast bg-danger-soft border border-danger/30 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 text-content-secondary hover:text-content-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isFormValid || isSubmitting}
                            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                                isFormValid && !isSubmitting
                                    ? 'bg-accent text-content-on-accent hover:bg-accent-strong'
                                    : 'bg-surface-1 text-content-muted cursor-not-allowed'
                            }`}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Goal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
