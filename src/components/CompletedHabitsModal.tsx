import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square } from 'lucide-react';
import type { Routine } from '../models/persistenceTypes';
import type { StepStates } from '../store/RoutineContext';

export interface CompletedHabitsModalProps {
    isOpen: boolean;
    routine: Routine | null;
    stepStates: StepStates;
    /** Resolve habit ID to display name */
    getHabitName: (habitId: string) => string;
    onClose: () => void;
    /** Called when user clicks "Log selected habits". Parent should call API, refresh, then close modal on success. */
    onLogSelected: (habitIds: string[]) => void | Promise<void>;
    /** When true, show "Saving..." and disable the Log button */
    submitting?: boolean;
}

/** Steps that are linked to a habit (have linkedHabitId). */
function getHabitSteps(routine: Routine) {
    return routine.steps.filter((s): s is typeof s & { linkedHabitId: string } => Boolean(s.linkedHabitId));
}

export const CompletedHabitsModal: React.FC<CompletedHabitsModalProps> = ({
    isOpen,
    routine,
    stepStates,
    getHabitName,
    onClose,
    onLogSelected,
    submitting = false,
}) => {
    const habitSteps = routine ? getHabitSteps(routine) : [];
    const [checkedStepIds, setCheckedStepIds] = useState<Set<string>>(new Set());

    // Initialize checked state from stepStates: checked if step is "done"
    useEffect(() => {
        if (!isOpen || !routine) return;
        const steps = getHabitSteps(routine);
        const initial = new Set<string>();
        for (const step of steps) {
            if (stepStates[step.id] === 'done') {
                initial.add(step.id);
            }
        }
        setCheckedStepIds(initial);
    }, [isOpen, routine?.id, stepStates]);

    const handleCheckAll = () => {
        setCheckedStepIds(new Set(habitSteps.map((s) => s.id)));
    };

    const handleUncheckAll = () => {
        setCheckedStepIds(new Set());
    };

    const toggleStep = (stepId: string) => {
        setCheckedStepIds((prev) => {
            const next = new Set(prev);
            if (next.has(stepId)) next.delete(stepId);
            else next.add(stepId);
            return next;
        });
    };

    const handleLogSelected = () => {
        if (submitting) return;
        const habitIds = habitSteps.filter((s) => checkedStepIds.has(s.id)).map((s) => s.linkedHabitId);
        onLogSelected(habitIds);
        // Parent closes modal and runner on success
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="completed-habits-title">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-fade-in-up">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 id="completed-habits-title" className="text-lg font-semibold text-white">Completed Habits</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors touch-manipulation -m-1"
                        aria-label="Close"
                    >
                        <X size={22} />
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 p-4 border-b border-white/5">
                    <button
                        type="button"
                        onClick={handleCheckAll}
                        className="px-3 py-1.5 rounded-lg bg-neutral-700/80 text-neutral-200 text-sm font-medium hover:bg-neutral-600 transition-colors touch-manipulation"
                    >
                        Check all
                    </button>
                    <button
                        type="button"
                        onClick={handleUncheckAll}
                        className="px-3 py-1.5 rounded-lg bg-neutral-700/80 text-neutral-200 text-sm font-medium hover:bg-neutral-600 transition-colors touch-manipulation"
                    >
                        Uncheck all
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto modal-scroll p-4">
                    {habitSteps.length === 0 ? (
                        <p className="text-neutral-500 text-sm">No habit-linked steps in this routine.</p>
                    ) : (
                        <ul className="space-y-2" role="list">
                            {habitSteps.map((step) => {
                                const checked = checkedStepIds.has(step.id);
                                const label = getHabitName(step.linkedHabitId) || step.title || 'Habit';
                                return (
                                    <li key={step.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-neutral-800/50 border border-white/5">
                                        <button
                                            type="button"
                                            role="checkbox"
                                            aria-checked={checked}
                                            aria-label={`${label} – ${checked ? 'selected' : 'not selected'}`}
                                            onClick={() => toggleStep(step.id)}
                                            className="flex items-center gap-3 w-full text-left touch-manipulation min-h-[44px]"
                                        >
                                            <span className="flex-shrink-0 text-neutral-400">
                                                {checked ? <CheckSquare size={22} className="text-emerald-400" /> : <Square size={22} />}
                                            </span>
                                            <span className="text-white font-medium">{label}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="flex flex-wrap gap-3 p-4 border-t border-white/10 bg-neutral-900/80">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 min-w-[120px] px-4 py-3 rounded-lg bg-neutral-700 text-white font-semibold hover:bg-neutral-600 transition-colors touch-manipulation"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleLogSelected}
                        disabled={submitting}
                        className="flex-1 min-w-[120px] px-4 py-3 rounded-lg bg-emerald-500 text-neutral-900 font-semibold hover:bg-emerald-400 transition-colors touch-manipulation disabled:opacity-60 disabled:pointer-events-none"
                    >
                        {submitting ? 'Saving...' : 'Log selected habits'}
                    </button>
                </div>
            </div>
        </div>
    );
};
