import React from 'react';
import { Plus } from 'lucide-react';
import { useGoalsWithProgress } from '../../lib/useGoalsWithProgress';
import { GoalCardStack } from '../../components/goals/GoalCardStack';
import { Loader2, AlertCircle } from 'lucide-react';

interface GoalsPageProps {
    onCreateGoal?: () => void;
}

export const GoalsPage: React.FC<GoalsPageProps> = ({ onCreateGoal }) => {
    const { data, loading, error } = useGoalsWithProgress();

    if (loading) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400 text-sm sm:text-base">Loading goals...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Goals</h1>
                    <p className="text-neutral-400 text-sm sm:text-base">Track your progress and achieve your goals</p>
                </div>
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                    <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <div className="text-red-400 font-medium mb-1">Error</div>
                        <div className="text-red-300 text-sm">{error}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Goals</h1>
                    <p className="text-neutral-400 text-sm sm:text-base">Track your progress and achieve your goals</p>
                </div>
                {onCreateGoal && (
                    <button
                        onClick={onCreateGoal}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors text-sm sm:text-base"
                    >
                        <Plus size={18} />
                        Create Goal
                    </button>
                )}
            </div>

            {data.length === 0 ? (
                <div className="text-center py-16 sm:py-20">
                    <div className="max-w-md mx-auto">
                        <div className="mb-6">
                            <div className="w-16 h-16 mx-auto bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                                <Plus className="text-neutral-500" size={32} />
                            </div>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">No goals yet</h2>
                        <p className="text-neutral-400 mb-6 text-sm sm:text-base">
                            Create your first goal to start tracking progress and building momentum.
                        </p>
                        {onCreateGoal && (
                            <button
                                onClick={onCreateGoal}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors mx-auto text-sm sm:text-base"
                            >
                                <Plus size={18} />
                                Create Goal
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <GoalCardStack
                    goals={data}
                    onViewDetails={(goalId) => {
                        // TODO: Navigate to goal detail page when implemented
                        console.log('View details for goal:', goalId);
                    }}
                    onEdit={(goalId) => {
                        // TODO: Navigate to goal edit page when implemented
                        console.log('Edit goal:', goalId);
                    }}
                    onAddManualProgress={(goalId) => {
                        // TODO: Open manual progress input modal when implemented
                        console.log('Add manual progress for goal:', goalId);
                    }}
                />
            )}
        </div>
    );
};
