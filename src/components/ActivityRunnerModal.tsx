import React, { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Activity } from '../types';

type ActivityRunnerMode = 'habit' | 'image' | 'text';

interface ActivityRunnerModalProps {
    isOpen: boolean;
    activity?: Activity;
    onClose: () => void;
}

export const ActivityRunnerModal: React.FC<ActivityRunnerModalProps> = ({
    isOpen,
    activity,
    onClose,
}) => {
    const [mode, setMode] = useState<ActivityRunnerMode>('habit');
    const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(new Set());

    const habitSteps = useMemo(
        () => activity?.steps.filter(step => step.type === 'habit') ?? [],
        [activity]
    );

    const toggleStep = (stepId: string) => {
        setCompletedStepIds(prev => {
            const next = new Set(prev);
            if (next.has(stepId)) {
                next.delete(stepId);
            } else {
                next.add(stepId);
            }
            return next;
        });
    };

    // Reset completed steps when modal closes
    useEffect(() => {
        if (!isOpen) {
            setCompletedStepIds(new Set());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white">
                        {activity?.title || 'Activity Runner'}
                    </h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Mode Selector */}
                    <div className="p-6 border-b border-white/10">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setMode('habit')}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    mode === 'habit'
                                        ? 'bg-emerald-500 text-neutral-900'
                                        : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                }`}
                            >
                                Checklist
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('image')}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    mode === 'image'
                                        ? 'bg-emerald-500 text-neutral-900'
                                        : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                }`}
                            >
                                Images
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('text')}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    mode === 'text'
                                        ? 'bg-emerald-500 text-neutral-900'
                                        : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                }`}
                            >
                                Text
                            </button>
                        </div>
                    </div>

                    {/* Mode Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {mode === 'habit' && (
                            <div className="space-y-4">
                                {habitSteps.length === 0 ? (
                                    <div className="text-neutral-400 text-center py-12">
                                        This activity has no habit steps; nothing to track in checklist mode.
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            {habitSteps.map((step) => (
                                                <label
                                                    key={step.id}
                                                    className="flex items-center gap-3 p-3 bg-neutral-800/50 border border-white/5 rounded-lg hover:bg-neutral-800/70 transition-colors cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={completedStepIds.has(step.id)}
                                                        onChange={() => toggleStep(step.id)}
                                                        className="w-5 h-5 rounded border-neutral-700 bg-neutral-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-white font-medium">{step.title}</div>
                                                        {step.timeEstimateMinutes && (
                                                            <div className="text-sm text-neutral-400 mt-1">
                                                                ~{step.timeEstimateMinutes} min
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="text-sm text-neutral-400 pt-2">
                                            Completed {completedStepIds.size} of {habitSteps.length} habit steps
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {mode === 'image' && (
                            <div className="text-neutral-400 text-center py-12">
                                Image mode placeholder
                            </div>
                        )}
                        {mode === 'text' && (
                            <div className="text-neutral-400 text-center py-12">
                                Text mode placeholder
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        disabled
                        className="px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit Activity
                    </button>
                </div>
            </div>
        </div>
    );
};
