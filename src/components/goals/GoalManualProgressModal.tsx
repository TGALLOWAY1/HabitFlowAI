import React, { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { createGoalManualLog } from '../../lib/persistenceClient';
import { invalidateGoalCaches } from '../../lib/goalDataCache';

interface GoalManualProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    goalId: string;
    unit?: string;
    onSuccess?: () => void;
}

export const GoalManualProgressModal: React.FC<GoalManualProgressModalProps> = ({
    isOpen,
    onClose,
    goalId,
    unit,
    onSuccess,
}) => {
    const [value, setValue] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Today's date in YYYY-MM-DD
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
            setError('Amount must be a positive number');
            return;
        }

        setIsSubmitting(true);

        try {
            // Convert date to ISO timestamp (end of day for the selected date)
            const loggedAt = new Date(date + 'T23:59:59').toISOString();

            await createGoalManualLog(goalId, {
                value: numValue,
                loggedAt,
            });

            // Invalidate goal caches since progress changed
            invalidateGoalCaches(goalId);

            // Reset form
            setValue('');
            setDate(new Date().toISOString().split('T')[0]);
            setError(null);

            // Call success callback to refetch data
            if (onSuccess) {
                onSuccess();
            }

            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to log progress';
            setError(errorMessage);
            console.error('Error creating manual log:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setValue('');
        setDate(new Date().toISOString().split('T')[0]);
        setError(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Log Progress Manually</h3>
                    <button
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Error Display */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                            <div className="flex-1">
                                <div className="text-red-400 text-sm">{error}</div>
                            </div>
                        </div>
                    )}

                    {/* Amount Input */}
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-neutral-300 mb-2">
                            Amount {unit && `(${unit})`}
                        </label>
                        <input
                            id="amount"
                            type="number"
                            step="any"
                            min="0.01"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="0.00"
                            required
                        />
                    </div>

                    {/* Date Input */}
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-neutral-300 mb-2">
                            Date
                        </label>
                        <input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !value}
                            className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Logging...
                                </>
                            ) : (
                                'Log Progress'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
