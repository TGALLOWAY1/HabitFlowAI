import React from 'react';
import { useGoalDetail } from '../../lib/useGoalDetail';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

interface GoalDetailPageProps {
    goalId: string;
    onBack?: () => void;
}

export const GoalDetailPage: React.FC<GoalDetailPageProps> = ({ goalId, onBack }) => {
    const { data, loading, error } = useGoalDetail(goalId);

    if (loading) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="flex flex-col items-center gap-4 py-12">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400 text-sm sm:text-base">Loading goal details...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="mb-6 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Back to Goals
                    </button>
                )}
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                    <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <div className="text-red-400 font-medium mb-1">Error</div>
                        <div className="text-red-300 text-sm">{error.message}</div>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="mb-6 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Back to Goals
                    </button>
                )}
                <div className="text-center py-12 text-neutral-500">
                    <p>Goal not found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {onBack && (
                <button
                    onClick={onBack}
                    className="mb-6 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={18} />
                    Back to Goals
                </button>
            )}

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                        {data.goal.title}
                    </h1>
                    <div className="text-neutral-400 text-sm sm:text-base">
                        Progress: {data.progress.percent}%
                    </div>
                </div>

                {/* Temporary JSON debug */}
                <div className="bg-neutral-800/50 border border-white/10 rounded-lg p-4">
                    <div className="text-neutral-400 text-sm font-medium mb-2">Debug Data (Temporary)</div>
                    <pre className="text-xs text-neutral-300 overflow-auto">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
};
