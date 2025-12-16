import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ChevronRight, Hash } from 'lucide-react';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white">{habit.name}</h3>
                        <p className="text-xs text-neutral-400">{date}</p>
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Option List */}
                <div className="space-y-3 mb-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
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
                                        : "bg-neutral-800/50 border-white/5 hover:bg-neutral-800 hover:border-white/10"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                                        isSelected ? "border-amber-500 bg-amber-500" : "border-neutral-600"
                                    )}>
                                        {isSelected && <CheckCircle2 size={12} className="text-black" strokeWidth={3} />}
                                    </div>
                                    <span className={cn(
                                        "text-sm font-medium",
                                        isSelected ? "text-amber-400" : "text-neutral-300"
                                    )}>
                                        {option.label}
                                    </span>
                                </div>

                                {hasMetric && (
                                    <span className="text-xs text-neutral-500 flex items-center gap-1">
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
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                            Enter Amount ({selectedOption.metricConfig?.unit || 'value'})
                        </label>
                        <input
                            type="number"
                            value={metricValue}
                            onChange={(e) => setMetricValue(e.target.value)}
                            // Auto-focus when appearing
                            autoFocus
                            className="w-full bg-neutral-800 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-amber-500 transition-colors"
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
