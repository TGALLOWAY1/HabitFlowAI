import React, { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';

interface ArchivedHabitsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Lists habits the user has archived and lets them restore the habit back
 * to active tracking, or delete it permanently. Empty state appears when
 * no habits are archived.
 *
 * The list is built by filtering `habits` from HabitContext for the
 * `archived === true` predicate. The same predicate is what every active
 * view filters out via `!h.archived`, so an archived habit is invisible
 * everywhere else until it's restored.
 */
export const ArchivedHabitsModal: React.FC<ArchivedHabitsModalProps> = ({ isOpen, onClose }) => {
    const { habits, categories, unarchiveHabit, deleteHabit } = useHabitStore();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const archivedHabits = useMemo(
        () => habits.filter(h => h.archived === true && !h.deletedAt),
        [habits]
    );

    const categoryById = useMemo(() => {
        const map = new Map<string, string>();
        for (const c of categories) map.set(c.id, c.name);
        return map;
    }, [categories]);

    if (!isOpen) return null;

    const handleRestore = async (id: string) => {
        setBusyId(id);
        setError(null);
        try {
            await unarchiveHabit(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to restore habit');
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (id: string) => {
        setBusyId(id);
        setError(null);
        try {
            await deleteHabit(id);
            setPendingDeleteId(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete habit');
        } finally {
            setBusyId(null);
        }
    };

    const formatArchivedDate = (iso?: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return '';
        }
    };

    return (
        <div className="fixed inset-0 z-[110]">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="absolute inset-0 overflow-y-auto modal-scroll p-4">
                <div
                    className="relative bg-neutral-900 border border-white/10 rounded-xl shadow-xl max-w-lg w-full mx-auto my-8 sm:my-16"
                    role="dialog"
                    aria-labelledby="archived-habits-title"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Archive size={18} className="text-emerald-400" />
                            <h2 id="archived-habits-title" className="text-lg font-semibold text-white">
                                Archived Habits
                            </h2>
                            {archivedHabits.length > 0 && (
                                <span className="text-xs text-neutral-500">({archivedHabits.length})</span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="p-4">
                        {error && (
                            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/40 rounded-lg flex items-start gap-2">
                                <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={14} />
                                <div className="text-sm text-red-300">{error}</div>
                            </div>
                        )}

                        {archivedHabits.length === 0 ? (
                            <div className="text-center py-10">
                                <Archive size={28} className="mx-auto text-neutral-600 mb-3" />
                                <div className="text-sm text-neutral-300 mb-1">No archived habits</div>
                                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                                    When you archive a habit it will appear here. Archived habits keep all their entries and can be restored at any time.
                                </p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {archivedHabits.map((habit) => {
                                    const isBusy = busyId === habit.id;
                                    const isConfirmingDelete = pendingDeleteId === habit.id;
                                    const categoryName = habit.categoryId ? categoryById.get(habit.categoryId) : '';
                                    const archivedOn = formatArchivedDate(habit.archivedAt);
                                    return (
                                        <li
                                            key={habit.id}
                                            className="rounded-lg bg-neutral-800/50 border border-white/5 p-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium text-white truncate">{habit.name}</div>
                                                    <div className="mt-0.5 text-[11px] text-neutral-500 flex items-center gap-1.5 flex-wrap">
                                                        {categoryName && <span>{categoryName}</span>}
                                                        {categoryName && archivedOn && <span aria-hidden>•</span>}
                                                        {archivedOn && <span>Archived {archivedOn}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestore(habit.id)}
                                                        disabled={isBusy}
                                                        className="px-2.5 py-1.5 rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Restore to active habits"
                                                    >
                                                        {isBusy ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <ArchiveRestore size={12} />
                                                        )}
                                                        Restore
                                                    </button>
                                                    {!isConfirmingDelete ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPendingDeleteId(habit.id)}
                                                            disabled={isBusy}
                                                            className="p-1.5 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Delete permanently"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(habit.id)}
                                                            disabled={isBusy}
                                                            className="px-2.5 py-1.5 rounded-md bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/40 text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Click to confirm permanent delete"
                                                        >
                                                            {isBusy ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={12} />
                                                            )}
                                                            Confirm delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {isConfirmingDelete && (
                                                <div className="mt-2 text-[11px] text-red-300/90 flex items-center justify-between gap-2">
                                                    <span>Permanent. Past entries stay attached to any linked goal but the habit cannot be restored.</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPendingDeleteId(null)}
                                                        className="text-neutral-400 hover:text-white underline underline-offset-2"
                                                    >
                                                        cancel
                                                    </button>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
