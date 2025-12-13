import React, { useState } from 'react';
import { useRoutineStore } from '../store/RoutineContext';
import type { Routine } from '../models/persistenceTypes';
import { Plus, Edit, Trash2, ClipboardList, Sparkles, Play } from 'lucide-react';
import { cn } from '../utils/cn';

interface RoutineListProps {
    onCreate: () => void;
    onEdit: (routine: Routine) => void;
    onStart: (routine: Routine) => void;
}

export const RoutineList: React.FC<RoutineListProps> = ({ onCreate, onEdit, onStart }) => {
    const { routines, routineLogs, loading, error, deleteRoutine } = useRoutineStore();
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleDelete = async (routine: Routine) => {
        if (deleteConfirmId === routine.id) {
            try {
                await deleteRoutine(routine.id);
                setDeleteConfirmId(null);
            } catch (error) {
                console.error('Failed to delete routine:', error);
            }
        } else {
            setDeleteConfirmId(routine.id);
            setTimeout(() => setDeleteConfirmId(null), 5000);
        }
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-neutral-900/50 rounded-2xl border border-white/5 backdrop-blur-sm shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-end p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors"
                    >
                        <Plus size={18} />
                        Create Routine
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-neutral-400">Loading routines...</div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-red-400">Error: {error}</div>
                    </div>
                ) : routines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ClipboardList size={48} className="text-neutral-600 mb-4" />
                        <h3 className="text-lg font-medium text-neutral-300 mb-2">No routines yet</h3>
                        <p className="text-neutral-500 mb-6">Create your first routine to get started</p>
                        <button
                            onClick={onCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors"
                        >
                            <Plus size={18} />
                            Create Routine
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {routines.map((routine) => {
                            const totalSteps = routine.steps?.length ?? 0;
                            const linkedHabitsCount = routine.linkedHabitIds?.length ?? 0;

                            // Check if routine is completed today
                            // Note: we use local date string matching the format stored in DB (YYYY-MM-DD)
                            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
                            const completedLog = routineLogs[`${routine.id}-${today}`];
                            const isCompleted = !!completedLog;

                            return (
                                <div
                                    key={routine.id}
                                    className={cn(
                                        "group relative bg-neutral-800/50 border border-white/5 rounded-lg p-4 hover:bg-neutral-800/70 transition-colors",
                                        isCompleted && "ring-1 ring-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10"
                                    )}
                                >
                                    {isCompleted && (
                                        <div className="absolute top-2 right-2 text-emerald-500">
                                            <Sparkles size={16} className="fill-emerald-500/20" />
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-medium text-white mb-2">{routine.title}</h3>
                                            <div className="flex items-center gap-4 text-sm text-neutral-400">
                                                <span>{totalSteps} {totalSteps === 1 ? 'step' : 'steps'}</span>
                                                {linkedHabitsCount > 0 && (
                                                    <span className="text-emerald-400">
                                                        {linkedHabitsCount} {linkedHabitsCount === 1 ? 'linked habit' : 'linked habits'}
                                                    </span>
                                                )}
                                                {isCompleted && (
                                                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                                                        Completed Today
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onStart(routine)}
                                                className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
                                                title="Start Routine"
                                            >
                                                <Play size={18} />
                                            </button>
                                            <button
                                                onClick={() => onEdit(routine)}
                                                className="p-2 rounded-lg text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                                                title="Edit Routine"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(routine)}
                                                className={cn(
                                                    "p-2 rounded-lg transition-all",
                                                    deleteConfirmId === routine.id
                                                        ? "bg-red-500/20 text-red-400"
                                                        : "text-neutral-400 hover:bg-neutral-700 hover:text-red-400"
                                                )}
                                                title={deleteConfirmId === routine.id ? "Click again to delete" : "Delete Routine"}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
