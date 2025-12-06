import React, { useState } from 'react';
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
                            <div className="text-neutral-400 text-center py-12">
                                Habit mode placeholder
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
