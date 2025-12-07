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
            <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400">Loading goals...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Goals</h1>
                    <p className="text-neutral-400">Your goals</p>
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
        <div className="w-full max-w-4xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Goals</h1>
                    <p className="text-neutral-400">Your goals</p>
                </div>
                {onCreateGoal && (
                    <button
                        onClick={onCreateGoal}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                        Create Goal
                    </button>
                )}
            </div>

            {data.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                    <p className="mb-4">No goals yet. Create your first goal to get started.</p>
                    {onCreateGoal && (
                        <button
                            onClick={onCreateGoal}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors mx-auto"
                        >
                            <Plus size={18} />
                            Create Goal
                        </button>
                    )}
                </div>
            ) : (
                <GoalCardStack goals={data} />
            )}
        </div>
    );
};
