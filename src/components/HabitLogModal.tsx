import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Hash } from 'lucide-react';
import type { Habit } from '../types';
import { cn } from '../utils/cn';

interface HabitLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    habit: Habit;
    date: string;
    existingEntry?: {
        bundleOptionId?: string;
        value?: number;
    };
    onSave: (payload: {
        habitId: string;
        date: string;
        bundleOptionId: string;
        bundleOptionLabel: string;
        value?: number | null; // null for explicit 'no metric'
        unitSnapshot?: string;
    }) => Promise<void>;
}

export const HabitLogModal: React.FC<HabitLogModalProps> = ({ isOpen, onClose, habit, date, existingEntry, onSave }) => {
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [metricValue, setMetricValue] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            if (existingEntry?.bundleOptionId) {
                setSelectedOptionId(existingEntry.bundleOptionId);
                // If it had a value, pre-fill it
                if (existingEntry.value !== undefined && existingEntry.value !== null) {
                    setMetricValue(String(existingEntry.value));
                } else {
                    setMetricValue('');
                }
            } else {
                setSelectedOptionId(null);
                setMetricValue('');
            }
        }
    }, [isOpen, existingEntry, habit]);

    if (!isOpen) return null;

    const options = habit.bundleOptions || [];
    const selectedOption = options.find(o => o.id === selectedOptionId);
    const isMetricRequired = selectedOption?.metricConfig?.mode === 'required';

    const handleSave = async () => {
        if (!selectedOptionId || !selectedOption) return;

        setIsSubmitting(true);
        try {
            await onSave({
                habitId: habit.id,
                date: date,
                bundleOptionId: selectedOption.id,
                bundleOptionLabel: selectedOption.label,
                value: isMetricRequired && metricValue ? Number(metricValue) : null,
                unitSnapshot: isMetricRequired ? selectedOption.metricConfig?.unit : undefined
            });
            onClose();
        } catch (error) {
            console.error("Failed to log entry", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-surface-0 border border-line-subtle rounded-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 max-h-[90dvh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-content-primary">{habit.name}</h3>
                        <p className="text-xs text-content-secondary">{date}</p>
                    </div>
                    <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-content-secondary hover:text-content-primary transition-colors -mr-2" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                {/* Option List */}
                <div className="space-y-3 mb-6 flex-1 min-h-0 max-h-[50vh] overflow-y-auto modal-scroll custom-scrollbar">
                    {options.map(option => {
                        const isSelected = selectedOptionId === option.id;
                        const hasMetric = option.metricConfig?.mode === 'required';

                        return (
                            <button
                                key={option.id}
                                onClick={() => setSelectedOptionId(option.id)}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                                    isSelected
                                        ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                                        : "bg-surface-1/50 border-line-subtle hover:bg-surface-1 hover:border-line-subtle"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                                        isSelected ? "border-amber-500 bg-amber-500" : "border-line-strong"
                                    )}>
                                        {isSelected && <CheckCircle2 size={12} className="text-black" strokeWidth={3} />}
                                    </div>
                                    <span className={cn(
                                        "text-sm font-medium",
                                        isSelected ? "text-amber-400" : "text-content-secondary"
                                    )}>
                                        {option.label}
                                    </span>
                                </div>

                                {hasMetric && (
                                    <span className="text-xs text-content-muted flex items-center gap-1">
                                        <Hash size={12} />
                                        {option.metricConfig?.unit || 'value'}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Metric Input (Conditional) */}
                {selectedOption && isMetricRequired && (
                    <div className="mb-6 animate-in slide-in-from-top-2 fade-in">
                        <label className="block text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
                            Enter Amount ({selectedOption.metricConfig?.unit || 'value'})
                        </label>
                        <input
                            type="number"
                            value={metricValue}
                            onChange={(e) => setMetricValue(e.target.value)}
                            // Auto-focus when appearing
                            autoFocus
                            className="w-full bg-surface-1 border border-line-subtle rounded-xl px-4 py-3 text-content-primary text-lg font-bold focus:outline-none focus:border-amber-500 transition-colors"
                            placeholder="0"
                        />
                    </div>
                )}

                {/* Footer Handlers */}
                <button
                    onClick={handleSave}
                    disabled={!selectedOptionId || (isMetricRequired && !metricValue) || isSubmitting}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-amber-500 text-neutral-900 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)]"
                >
                    {isSubmitting ? 'Saving...' : 'Log Entry'}
                </button>

            </div>
        </div>
    );
};
