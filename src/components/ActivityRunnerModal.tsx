import React from 'react';
import { X } from 'lucide-react';
import type { Activity } from '../types';

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
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="text-neutral-400 text-center py-12">
                        Runner content goes here
                    </div>
                </div>
            </div>
        </div>
    );
};
