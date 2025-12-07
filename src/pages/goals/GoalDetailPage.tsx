import React, { useMemo } from 'react';
import { useGoalDetail } from '../../lib/useGoalDetail';
import { Loader2, AlertCircle, ArrowLeft, Check } from 'lucide-react';

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
                {/* Header Section */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                                {data.goal.title}
                            </h1>
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Goal Type Label */}
                                <span className="px-2.5 py-1 bg-neutral-700/50 text-neutral-300 rounded text-xs font-medium capitalize">
                                    {data.goal.type}
                                </span>
                                {/* Status Chip */}
                                <span className={`px-2.5 py-1 rounded text-xs font-medium ${
                                    data.goal.completedAt
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                }`}>
                                    {data.goal.completedAt ? 'Completed' : 'Active'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Main Progress Bar */}
                    <div className="space-y-3">
                        <div className="w-full h-4 bg-neutral-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${Math.min(100, data.progress.percent)}%` }}
                            />
                        </div>

                        {/* Numeric Progress */}
                        <div className="flex items-center justify-between">
                            <div className="text-white font-medium text-sm sm:text-base">
                                {data.goal.type === 'cumulative'
                                    ? `${data.progress.currentValue} / ${data.goal.targetValue} ${data.goal.unit || ''}`
                                    : `${data.progress.currentValue} of ${data.goal.targetValue} days`}
                            </div>
                            <div className="text-emerald-400 font-semibold text-sm sm:text-base">
                                {data.progress.percent}%
                            </div>
                        </div>
                    </div>

                    {/* Milestones Row */}
                    <div className="pt-4">
                        <div className="text-neutral-400 text-sm font-medium mb-3">Milestones</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {useMemo(() => {
                                const milestones = [
                                    { percent: 25, label: 'Quarter', value: data.goal.targetValue * 0.25 },
                                    { percent: 50, label: 'Halfway', value: data.goal.targetValue * 0.5 },
                                    { percent: 75, label: 'Almost there', value: data.goal.targetValue * 0.75 },
                                    { percent: 100, label: 'Goal!', value: data.goal.targetValue },
                                ];
                                return milestones.map(milestone => ({
                                    ...milestone,
                                    reached: data.progress.percent >= milestone.percent,
                                }));
                            }, [data.goal.targetValue, data.progress.percent]).map((milestone) => {
                                const milestoneValue = data.goal.type === 'cumulative'
                                    ? `${milestone.value.toFixed(1)} ${data.goal.unit || ''} of ${data.goal.targetValue} ${data.goal.unit || ''}`
                                    : `${milestone.value.toFixed(0)} days of ${data.goal.targetValue} days`;
                                
                                return (
                                    <div
                                        key={milestone.percent}
                                        className={`p-3 rounded-lg border transition-colors ${
                                            milestone.reached
                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                : 'bg-neutral-800/50 border-white/5'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {milestone.reached ? (
                                                <Check className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-neutral-600 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-sm font-medium mb-1">
                                                    {milestone.percent}% • {milestone.label}
                                                </div>
                                                <div className="text-neutral-400 text-xs leading-tight">
                                                    {milestoneValue}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
