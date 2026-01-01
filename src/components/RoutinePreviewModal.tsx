import React from 'react';
import { X, Play, Clock, ListChecks, Link as LinkIcon } from 'lucide-react';
import type { Routine } from '../models/persistenceTypes';
import { useHabitStore } from '../store/HabitContext';

interface RoutinePreviewModalProps {
    isOpen: boolean;
    routine?: Routine;
    onClose: () => void;
    onStart: (routine: Routine) => void;
}

export const RoutinePreviewModal: React.FC<RoutinePreviewModalProps> = ({
    isOpen,
    routine,
    onClose,
    onStart,
}) => {
    const { habits } = useHabitStore();

    if (!isOpen || !routine) return null;

    const totalSteps = routine.steps.length;
    const totalDuration = routine.steps.reduce((acc, step) => acc + (step.timerSeconds || 60), 0);
    const durationMinutes = Math.max(1, Math.ceil(totalDuration / 60));

    const linkedHabits = habits.filter(h => routine.linkedHabitIds?.includes(h.id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{routine.title}</h2>
                        {/* If we had description, showing it here would be good */}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Routine Image (if available) */}
                {routine.imageUrl && (
                    <div className="w-full aspect-video bg-neutral-800/50 border-b border-white/5 overflow-hidden">
                        <img
                            src={routine.imageUrl}
                            alt={routine.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Stats */}
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 rounded-lg text-neutral-300 text-sm">
                            <ListChecks size={16} />
                            <span>{totalSteps} Steps</span>
                        </div>
                        {durationMinutes > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 rounded-lg text-neutral-300 text-sm">
                                <Clock size={16} />
                                <span>~{durationMinutes} mins</span>
                            </div>
                        )}
                    </div>

                    {/* Linked Habits */}
                    {linkedHabits.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                                <LinkIcon size={14} />
                                Linked Habits
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {linkedHabits.map(habit => (
                                    <div
                                        key={habit.id}
                                        className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium"
                                    >
                                        {habit.name}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-neutral-500 italic">
                                * Starting this routine will prepare these habits for confirmation.
                            </p>
                        </div>
                    )}

                    {/* Steps Preview */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">
                            Steps Sequence
                        </h3>
                        <div className="space-y-2 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-neutral-800">
                            {routine.steps.map((step, index) => (
                                <div key={step.id} className="relative flex items-start gap-4 p-2 rounded-lg hover:bg-neutral-800/50 transition-colors">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm font-medium text-neutral-400 z-10">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <h4 className="text-white font-medium">{step.title}</h4>
                                        {step.timerSeconds && (
                                            <span className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
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
                <div className="p-6 border-t border-white/10 bg-neutral-900/50 backdrop-blur-md flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onStart(routine);
                            onClose();
                        }}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-neutral-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                    >
                        <Play size={18} />
                        Start Routine
                    </button>
                </div>

            </div>
        </div>
    );
};
