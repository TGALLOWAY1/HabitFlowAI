import React, { useState, useMemo } from 'react';
import { Plus, Target, ChevronDown, ChevronRight } from 'lucide-react';
import { useGoalsWithProgress } from '../../lib/useGoalsWithProgress';
import { GoalGridCard } from '../../components/goals/GoalGridCard';
import { Loader2, AlertCircle } from 'lucide-react';
import { EditGoalModal } from '../../components/goals/EditGoalModal';
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
    onNavigateToCompleted,
}) => {
    // Determine color application strategy (match Today view style)
    const isTailwindClass = stack.category.color?.startsWith('bg-');
    const textColorClass = isTailwindClass ? stack.category.color.replace('bg-', 'text-') : undefined;
    const styleColor = !isTailwindClass && stack.category.color ? { color: stack.category.color } : undefined;

    return (
        <div className="overflow-hidden w-full">
            {/* Stack Header */}
            <button
                onClick={onToggle}
                className="flex items-center gap-2 mb-3 px-1 w-full text-left group transition-opacity hover:opacity-80"
            >
                <div className={`flex-shrink-0 ${textColorClass || ''}`} style={styleColor}>
                    {isExpanded ? (
                        <ChevronDown size={20} />
                    ) : (
                        <ChevronRight size={20} />
                    )}
                </div>
                <h2
                    className={`text-lg font-bold transition-colors truncate ${textColorClass || ''}`}
                    style={styleColor}
                >
                    {stack.category.name}
                </h2>
                <span className="text-xs text-neutral-500 font-medium flex-shrink-0">
                    ({goalCount} {goalCount === 1 ? 'goal' : 'goals'})
                </span>
            </button>

            {/* Stack Body - Goal Cards */}
            {isExpanded && (
                <div className="px-1 py-2 overflow-x-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {(stack.goals as Array<{ id: string }>).map((goal) => {
                            const goalWithProgress = getGoalWithProgress(goal.id);
                            if (!goalWithProgress) return null;

                            return (
                                <GoalGridCard
                                    key={goal.id}
                                    goalWithProgress={goalWithProgress as import('../../types').GoalWithProgress}
                                    onViewDetails={(goalId) => {
                                        if (onViewGoal) {
                                            onViewGoal(goalId);
                                        }
                                    }}
                                    onEdit={onEdit}
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
    onViewWinArchive: _onViewWinArchive
}) => {
    const { data, loading, error, refetch } = useGoalsWithProgress();
    const { categories } = useHabitStore();
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
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
        <div className="w-full max-w-4xl mx-auto py-6 sm:py-8 overflow-x-hidden px-4 sm:px-6 lg:px-8">
            {/* Content Area */}
            {goalStacks.length === 0 ? (
                    <div className="text-center py-12 sm:py-16">
                        <div className="max-w-md mx-auto">
                            <div className="w-14 h-14 mx-auto bg-neutral-800 rounded-full flex items-center justify-center mb-5">
                                <Target className="text-neutral-500" size={28} />
                            </div>
                            <h2 className="text-lg font-semibold text-white mb-2">
                                Goals are outcomes, milestones or states that are the result of your habits.
                            </h2>
                            <p className="text-sm text-neutral-400 mb-5 leading-relaxed">
                                Use goals to track progress over time and give your habits direction.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 mb-6">
                                {['Build consistency', 'Reach a milestone', 'Complete a project'].map((ex) => (
                                    <span key={ex} className="px-3 py-1.5 text-xs text-neutral-400 bg-neutral-800/80 rounded-full border border-white/5">
                                        {ex}
                                    </span>
                                ))}
                            </div>
                            {onCreateGoal && (
                                <button
                                    onClick={onCreateGoal}
                                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors mx-auto text-sm"
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
                                    onNavigateToCompleted={onNavigateToCompleted}
                                />
                            );
                        })}
                    </div>
                )}

            {/* Modals */}
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
