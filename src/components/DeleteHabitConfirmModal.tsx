import React from 'react';
import { X, AlertTriangle, Loader2, Target } from 'lucide-react';

interface DeleteHabitConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    habitName: string;
    linkedGoalTitles: string[];
}

/**
 * Confirmation modal for deleting a habit that is linked to one or more goals.
 *
 * This modal surfaces the link to the user — deleting a habit without warning
 * was a trust issue because goals continued to reference the now-missing habit
 * silently. We explicitly tell the user:
 *   1. Which goals are affected, by title.
 *   2. That historical progress on those goals is PRESERVED — past entries
 *      continue to count toward progress even after the habit is deleted.
 *   3. That the habit will no longer appear in the goal's habit list and
 *      can't be logged going forward.
 *
 * For habits that are NOT linked to any goal, the caller keeps the lighter
 * "click trash twice to confirm" flow — this modal is only shown when there's
 * actually a linkage the user should know about.
 */
export const DeleteHabitConfirmModal: React.FC<DeleteHabitConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    habitName,
    linkedGoalTitles,
}) => {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsDeleting(true);
        setError(null);
        try {
            await onConfirm();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete habit';
            setError(errorMessage);
            console.error('Error deleting habit:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCancel = () => {
        setError(null);
        onClose();
    };

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Delete Habit</h3>
                    <button
                        onClick={handleCancel}
                        disabled={isDeleting}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white transition-colors disabled:opacity-50 -mr-2"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Warning */}
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <div className="text-amber-400 font-medium mb-1">This habit is linked to a goal</div>
                            <div className="text-white text-sm">
                                Deleting <span className="font-semibold">"{habitName}"</span> will remove it from the following goal{linkedGoalTitles.length === 1 ? '' : 's'}. Past entries continue to count toward goal progress — historical progress is preserved — but you won't be able to log new entries for this habit.
                            </div>
                        </div>
                    </div>

                    {/* Linked goals list */}
                    <div className="p-3 bg-neutral-800/50 rounded-lg">
                        <div className="text-neutral-400 text-xs mb-2">Linked goal{linkedGoalTitles.length === 1 ? '' : 's'}</div>
                        <ul className="space-y-1.5">
                            {linkedGoalTitles.map((title, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-white text-sm">
                                    <Target size={14} className="text-emerald-400 flex-shrink-0" />
                                    <span className="truncate">{title}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                            <div className="flex-1">
                                <div className="text-red-400 text-sm">{error}</div>
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Habit'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
