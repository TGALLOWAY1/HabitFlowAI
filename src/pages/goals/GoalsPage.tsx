import React, { useState, useMemo } from 'react';
import { Plus, Trophy, Target, TrendingUp, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { useGoalsWithProgress } from '../../lib/useGoalsWithProgress';
import { GoalGridCard } from '../../components/goals/GoalGridCard';
import { Loader2, AlertCircle } from 'lucide-react';
import { GoalManualProgressModal } from '../../components/goals/GoalManualProgressModal';
import { EditGoalModal } from '../../components/goals/EditGoalModal';
import { SkillTreeTab } from '../../components/SkillTree/SkillTreeTab';
import { useHabitStore } from '../../store/HabitContext';
import { buildGoalStacks } from '../../utils/goalUtils';

interface GoalsPageProps {
    onCreateGoal?: () => void;
    onViewGoal?: (goalId: string) => void;
    onNavigateToCompleted?: (goalId: string) => void;
    onViewWinArchive?: () => void;
}

interface StackProps {
    stack: { category: { id: string; name: string; color: string }; goals: unknown[] };
    isExpanded: boolean;
    goalCount: number;
    onToggle: () => void;
    getGoalWithProgress: (goalId: string) => { goal: { id: string }; progress: unknown } | undefined;
    onViewGoal?: (goalId: string) => void;
    onEdit: (goalId: string) => void;
    onAddManualProgress: (goalId: string, event: React.MouseEvent) => void;
    onNavigateToCompleted?: (goalId: string) => void;
}

const Stack: React.FC<StackProps> = ({
    stack,
    isExpanded,
    goalCount,
    onToggle,
    getGoalWithProgress,
    onViewGoal,
    onEdit,
    onAddManualProgress,
    onNavigateToCompleted,
}) => {
    return (
        <div className="border border-white/5 rounded-xl bg-neutral-900/30 overflow-hidden w-full">
            {/* Stack Header */}
            <button
                onClick={onToggle}
                className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-neutral-800/50 active:bg-neutral-800/70 transition-colors text-left touch-manipulation"
            >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${stack.category.color || 'bg-neutral-600'}`}
                    />
                    <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-white truncate">
                        {stack.category.name}
                    </h2>
                    <span className="text-xs sm:text-sm text-neutral-400 font-medium flex-shrink-0">
                        ({goalCount} {goalCount === 1 ? 'goal' : 'goals'})
                    </span>
                </div>
                <div className="flex-shrink-0 text-neutral-400 ml-2">
                    {isExpanded ? (
                        <ChevronDown size={20} />
                    ) : (
                        <ChevronRight size={20} />
                    )}
                </div>
            </button>

            {/* Stack Body - Goal Cards */}
            {isExpanded && (
                <div className="px-3 sm:px-4 lg:px-6 py-4 border-t border-white/5 overflow-x-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {stack.goals.map((goal: { id: string }) => {
                            const goalWithProgress = getGoalWithProgress(goal.id);
                            if (!goalWithProgress) return null;

                            return (
                                <GoalGridCard
                                    key={goal.id}
                                    goalWithProgress={goalWithProgress}
                                    onViewDetails={(goalId) => {
                                        if (onViewGoal) {
                                            onViewGoal(goalId);
                                        }
                                    }}
                                    onEdit={onEdit}
                                    onAddManualProgress={onAddManualProgress}
                                    onNavigateToCompleted={onNavigateToCompleted}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export const GoalsPage: React.FC<GoalsPageProps> = ({
    onCreateGoal,
    onViewGoal,
    onNavigateToCompleted,
    onViewWinArchive
}) => {
    const { data, loading, error, refetch } = useGoalsWithProgress();
    const { categories } = useHabitStore();
    const [manualProgressGoalId, setManualProgressGoalId] = useState<string | null>(null);
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'skills'>('overview');
    // Track expanded/collapsed state for each stack (category ID -> boolean)
    // Default to expanded on desktop (all true initially)
    const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());

    // We don't need useHabitStore().goals here if using useGoalsWithProgress for overview
    // But we might need it for other things? 
    // Actually, let's just stick to local state for tabs.

    // Helpers to find goal for modals
    const getGoalById = (id: string | null) => {
        if (!id) return null;
        return data.find(g => g.goal.id === id) || null;
    };

    // Build goal stacks grouped by category
    const goalStacks = useMemo(() => {
        if (!data || !categories) return [];
        
        // Extract goals from GoalWithProgress array
        const goals = data.map(gwp => gwp.goal);
        
        return buildGoalStacks({ goals, categories });
    }, [data, categories]);

    // Initialize all stacks as expanded on mount (desktop default)
    React.useEffect(() => {
        if (goalStacks.length > 0 && expandedStacks.size === 0) {
            setExpandedStacks(new Set(goalStacks.map(stack => stack.category.id)));
        }
    }, [goalStacks, expandedStacks.size]);

    // Toggle stack expand/collapse
    const toggleStack = (categoryId: string) => {
        setExpandedStacks(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    };

    // Find goalWithProgress by goal ID
    const getGoalWithProgress = (goalId: string) => {
        return data.find(gwp => gwp.goal.id === goalId);
    };

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
        <div className={`w-full mx-auto py-6 sm:py-8 overflow-x-hidden ${
            activeTab === 'skills' 
                ? 'max-w-[98vw] px-3 sm:px-4 lg:px-6' 
                : 'max-w-4xl px-4 sm:px-6 lg:px-8'
        }`}>
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex p-1 bg-neutral-800 rounded-lg overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all whitespace-nowrap ${activeTab === 'overview'
                            ? 'bg-neutral-700 shadow text-white'
                            : 'text-neutral-400 hover:text-white'
                            }`}
                    >
                        <Target size={16} />
                        <span className="font-medium text-sm">Overview</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('progress')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all whitespace-nowrap ${activeTab === 'progress'
                            ? 'bg-neutral-700 shadow text-white'
                            : 'text-neutral-400 hover:text-white'
                            }`}
                    >
                        <TrendingUp size={16} />
                        <span className="font-medium text-sm">Progress</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('skills')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all whitespace-nowrap ${activeTab === 'skills'
                            ? 'bg-neutral-700 shadow text-white'
                            : 'text-neutral-400 hover:text-white'
                            }`}
                    >
                        <BookOpen size={16} />
                        <span className="font-medium text-sm">Skill Tree</span>
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {onViewWinArchive && (
                        <button
                            onClick={onViewWinArchive}
                            className="flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-lg transition-colors text-sm sm:text-base whitespace-nowrap"
                        >
                            <Trophy size={18} />
                            <span className="hidden sm:inline">Win Archive</span>
                        </button>
                    )}
                    {onCreateGoal && (
                        <button
                            onClick={onCreateGoal}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors text-sm sm:text-base whitespace-nowrap"
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline">Create Goal</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'overview' && (
                goalStacks.length === 0 ? (
                    <div className="text-center py-16 sm:py-20">
                        <div className="max-w-md mx-auto">
                            <div className="mb-6">
                                <div className="w-16 h-16 mx-auto bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                                    <Plus className="text-emerald-400" size={32} />
                                </div>
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">Start Your Journey</h2>
                            <p className="text-neutral-400 mb-6 text-sm sm:text-base">
                                Create your first goal to turn your daily habits into meaningful achievements.
                            </p>
                            {onCreateGoal && (
                                <button
                                    onClick={onCreateGoal}
                                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors mx-auto text-sm sm:text-base"
                                >
                                    <Plus size={18} />
                                    Create Your First Goal
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
                        {goalStacks.map((stack) => {
                            const isExpanded = expandedStacks.has(stack.category.id);
                            const goalCount = stack.goals.length;

                            return (
                                <Stack
                                    key={stack.category.id}
                                    stack={stack}
                                    isExpanded={isExpanded}
                                    goalCount={goalCount}
                                    onToggle={() => toggleStack(stack.category.id)}
                                    getGoalWithProgress={getGoalWithProgress}
                                    onViewGoal={onViewGoal}
                                    onEdit={(goalId) => setEditingGoalId(goalId)}
                                    onAddManualProgress={(goalId, event) => {
                                        event.preventDefault();
                                        setManualProgressGoalId(goalId);
                                    }}
                                    onNavigateToCompleted={onNavigateToCompleted}
                                />
                            );
                        })}
                    </div>
                )
            )}

            {activeTab === 'progress' && (
                <div className="text-center py-12 text-neutral-500">
                    <TrendingUp className="mx-auto mb-4 opacity-50" size={48} />
                    <p>Detailed Progress Views Coming Soon</p>
                </div>
            )}

            {activeTab === 'skills' && (
                <SkillTreeTab onCreateGoal={onCreateGoal || (() => { })} />
            )}

            {/* Modals */}
            {manualProgressGoalId && (() => {
                const goal = getGoalById(manualProgressGoalId);
                if (!goal) return null;
                return (
                    <GoalManualProgressModal
                        isOpen={true}
                        onClose={() => setManualProgressGoalId(null)}
                        goalWithProgress={goal}
                        onSuccess={refetch}
                    />
                );
            })()}

            {editingGoalId && (() => {
                const goal = getGoalById(editingGoalId);
                if (!goal) return null;
                return (
                    <EditGoalModal
                        isOpen={true}
                        onClose={() => setEditingGoalId(null)}
                        goalWithProgress={goal}
                        onSuccess={refetch}
                    />
                );
            })()}
        </div>
    );
};
