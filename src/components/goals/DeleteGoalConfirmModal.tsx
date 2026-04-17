import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteGoalConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    goalTitle: string;
}

export const DeleteGoalConfirmModal: React.FC<DeleteGoalConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    goalTitle,
}) => {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsDeleting(true);
        setError(null);
        try {
            await onConfirm();
            // Modal will be closed by parent after successful delete
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete goal';
            setError(errorMessage);
            console.error('Error deleting goal:', err);
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
            <div className="w-full max-w-md bg-surface-0 border border-line-subtle rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-content-primary">Delete Goal</h3>
                    <button
                        onClick={handleCancel}
                        disabled={isDeleting}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-content-secondary hover:text-content-primary transition-colors disabled:opacity-50 -mr-2"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Warning Message */}
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <div className="text-amber-400 font-medium mb-1">Confirm Deletion</div>
                            <div className="text-content-primary text-sm">
                                Delete this goal? This will not delete underlying habits or habit logs, but the goal and its progress will be removed.
                            </div>
                        </div>
                    </div>

                    {/* Goal Title */}
                    <div className="p-3 bg-surface-1/50 rounded-lg">
                        <div className="text-content-secondary text-xs mb-1">Goal</div>
                        <div className="text-content-primary text-sm font-medium">{goalTitle}</div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="p-3 bg-danger-soft border border-danger/50 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="text-danger-contrast flex-shrink-0 mt-0.5" size={16} />
                            <div className="flex-1">
                                <div className="text-danger-contrast text-sm">{error}</div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2 bg-surface-2 hover:bg-surface-2 text-content-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2 bg-danger hover:bg-danger/80 text-content-primary font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Goal'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
