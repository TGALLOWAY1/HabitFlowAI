import React from 'react';
import { X, AlertTriangle, Loader2, Target, Archive, Trash2 } from 'lucide-react';

interface RemoveHabitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onArchive: () => Promise<void>;
    onDelete: () => Promise<void>;
    habitName: string;
    /** When non-empty, the habit is linked to one or more goals — modal explains the goal impact. */
    linkedGoalTitles: string[];
}

/**
 * Confirmation modal shown when removing a habit.
 *
 * Offers two paths:
 *  - **Archive** (default, recommended): hides the habit from active views
 *    but preserves the habit definition and all entries. Restorable from
 *    Settings → View Archived Habits. Used when a user has finished a
 *    short-term habit (e.g. "watch 10 tutorials") but may want to revive it.
 *  - **Delete permanently**: removes the habit from active views as a soft
 *    delete. Past entries continue to count toward goal progress, but the
 *    habit cannot be restored from the UI without re-creating it.
 *
 * For habits linked to one or more goals, the modal also surfaces the
 * affected goal titles so the user knows what gets disconnected.
 */
export const DeleteHabitConfirmModal: React.FC<RemoveHabitModalProps> = ({
    isOpen,
    onClose,
    onArchive,
    onDelete,
    habitName,
    linkedGoalTitles,
}) => {
    const [busy, setBusy] = React.useState<'archive' | 'delete' | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    if (!isOpen) return null;

    const handleArchive = async () => {
        setBusy('archive');
        setError(null);
        try {
            await onArchive();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to archive habit';
            setError(errorMessage);
            console.error('Error archiving habit:', err);
        } finally {
            setBusy(null);
        }
    };

    const handleDelete = async () => {
        setBusy('delete');
        setError(null);
        try {
            await onDelete();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete habit';
            setError(errorMessage);
            console.error('Error deleting habit:', err);
        } finally {
            setBusy(null);
        }
    };

    const handleCancel = () => {
        if (busy) return;
        setError(null);
        onClose();
    };

    const hasLinkedGoals = linkedGoalTitles.length > 0;

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Remove Habit</h3>
                    <button
                        onClick={handleCancel}
                        disabled={!!busy}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white transition-colors disabled:opacity-50 -mr-2"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Lead-in explaining the choice */}
                    <p className="text-sm text-neutral-300">
                        What would you like to do with <span className="font-semibold text-white">"{habitName}"</span>?
                    </p>

                    {/* Goal-linkage notice (only when linked) */}
                    {hasLinkedGoals && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={16} />
                            <div className="flex-1 text-xs text-amber-100/90">
                                This habit is linked to {linkedGoalTitles.length === 1 ? 'a goal' : `${linkedGoalTitles.length} goals`}. Past entries continue to count toward goal progress either way.
                            </div>
                        </div>
                    )}

                    {/* Linked goals list */}
                    {hasLinkedGoals && (
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
                    )}

                    {/* Archive option (recommended) */}
                    <button
                        type="button"
                        onClick={handleArchive}
                        disabled={!!busy}
                        className="w-full text-left p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-3"
                    >
                        <Archive className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-300 font-medium text-sm">Archive habit</span>
                                <span className="text-[10px] uppercase tracking-wider text-emerald-400/70">Recommended</span>
                            </div>
                            <div className="text-xs text-neutral-300 mt-1">
                                Hide from active tracking. The habit and all its entries are preserved and you can restore it any time from Settings.
                            </div>
                        </div>
                        {busy === 'archive' && <Loader2 className="animate-spin text-emerald-400 flex-shrink-0 mt-0.5" size={16} />}
                    </button>

                    {/* Delete permanently option (destructive) */}
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={!!busy}
                        className="w-full text-left p-4 rounded-lg bg-red-500/5 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-3"
                    >
                        <Trash2 className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                            <div className="text-red-300 font-medium text-sm">Delete permanently</div>
                            <div className="text-xs text-neutral-300 mt-1">
                                Remove the habit from your list. Past entries are kept so historical goal progress is preserved, but the habit cannot be restored from the UI.
                            </div>
                        </div>
                        {busy === 'delete' && <Loader2 className="animate-spin text-red-400 flex-shrink-0 mt-0.5" size={16} />}
                    </button>

                    {/* Error display */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                            <div className="flex-1">
                                <div className="text-red-400 text-sm">{error}</div>
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={!!busy}
                            className="w-full px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
