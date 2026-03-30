import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Target, ChevronDown, ChevronRight } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useGoalsWithProgress } from '../../lib/useGoalsWithProgress';
import { GoalGridCard } from '../../components/goals/GoalGridCard';
import { Loader2, AlertCircle } from 'lucide-react';
import { EditGoalModal } from '../../components/goals/EditGoalModal';
import { useHabitStore } from '../../store/HabitContext';
import { buildGoalStacks } from '../../utils/goalUtils';
import { reorderGoals } from '../../lib/persistenceClient';
import type { GoalWithProgress } from '../../types';

interface GoalsPageProps {
    onCreateGoal?: () => void;
    onViewGoal?: (goalId: string) => void;
    onNavigateToCompleted?: (goalId: string) => void;
    onViewWinArchive?: () => void;
}

// Sortable wrapper for a goal card
const SortableGoalCard: React.FC<{
    goalWithProgress: GoalWithProgress;
    onViewDetails: (goalId: string) => void;
    onEdit: (goalId: string) => void;
    onNavigateToCompleted?: (goalId: string) => void;
}> = ({ goalWithProgress, onViewDetails, onEdit, onNavigateToCompleted }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: goalWithProgress.goal.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: isDragging ? 'relative' as const : undefined,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <GoalGridCard
                goalWithProgress={goalWithProgress}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onNavigateToCompleted={onNavigateToCompleted}
                dragHandleProps={listeners}
                isDragging={isDragging}
            />
        </div>
    );
};

interface StackProps {
    stack: { category: { id: string; name: string; color: string }; goals: Array<{ id: string }> };
    isExpanded: boolean;
    goalCount: number;
    onToggle: () => void;
    getGoalWithProgress: (goalId: string) => GoalWithProgress | undefined;
    onViewGoal?: (goalId: string) => void;
    onEdit: (goalId: string) => void;
    onNavigateToCompleted?: (goalId: string) => void;
    onDragEnd: (event: DragEndEvent, categoryId: string) => void;
    sensors: ReturnType<typeof useSensors>;
    /** Whether any goals in this stack are cumulative (need grid layout) */
    hasCumulativeGoals: boolean;
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
    onDragEnd,
    sensors,
    hasCumulativeGoals,
}) => {
    const isTailwindClass = stack.category.color?.startsWith('bg-');
    const textColorClass = isTailwindClass ? stack.category.color.replace('bg-', 'text-') : undefined;
    const styleColor = !isTailwindClass && stack.category.color ? { color: stack.category.color } : undefined;

    const goalIds = stack.goals.map(g => g.id);

    return (
        <div className="overflow-hidden w-full">
            {/* Stack Header */}
            <button
                onClick={onToggle}
                className="flex items-center gap-2 mb-2 px-1 w-full text-left group transition-opacity hover:opacity-80"
            >
                <div className={`flex-shrink-0 ${textColorClass || ''}`} style={styleColor}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                <h2
                    className={`text-base font-bold transition-colors truncate ${textColorClass || ''}`}
                    style={styleColor}
                >
                    {stack.category.name}
                </h2>
                <span className="text-xs text-neutral-500 font-medium flex-shrink-0">
                    ({goalCount})
                </span>
            </button>

            {/* Stack Body */}
            {isExpanded && (
                <div className="pl-1 pr-1 pb-1">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => onDragEnd(event, stack.category.id)}
                    >
                        <SortableContext items={goalIds} strategy={verticalListSortingStrategy}>
                            {/* Compact goals (onetime/frequency) in a vertical list */}
                            {/* Cumulative goals in a responsive grid */}
                            {hasCumulativeGoals ? (
                                <div className="space-y-2">
                                    {/* Compact goals first */}
                                    {stack.goals.map((goal) => {
                                        const gwp = getGoalWithProgress(goal.id);
                                        if (!gwp) return null;
                                        return (
                                            <SortableGoalCard
                                                key={goal.id}
                                                goalWithProgress={gwp}
                                                onViewDetails={onViewGoal || (() => {})}
                                                onEdit={onEdit}
                                                onNavigateToCompleted={onNavigateToCompleted}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {stack.goals.map((goal) => {
                                        const gwp = getGoalWithProgress(goal.id);
                                        if (!gwp) return null;
                                        return (
                                            <SortableGoalCard
                                                key={goal.id}
                                                goalWithProgress={gwp}
                                                onViewDetails={onViewGoal || (() => {})}
                                                onEdit={onEdit}
                                                onNavigateToCompleted={onNavigateToCompleted}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </SortableContext>
                    </DndContext>
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
    const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const getGoalById = (id: string | null) => {
        if (!id) return null;
        return data.find(g => g.goal.id === id) || null;
    };

    const goalStacks = useMemo(() => {
        if (!data || !categories) return [];
        const goals = data.map(gwp => gwp.goal);
        return buildGoalStacks({ goals, categories });
    }, [data, categories]);

    // Initialize all stacks as expanded on mount
    React.useEffect(() => {
        if (goalStacks.length > 0 && expandedStacks.size === 0) {
            setExpandedStacks(new Set(goalStacks.map(stack => stack.category.id)));
        }
    }, [goalStacks, expandedStacks.size]);

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

    const getGoalWithProgress = useCallback((goalId: string) => {
        return data.find(gwp => gwp.goal.id === goalId);
    }, [data]);

    // Handle drag end within a category stack
    const handleDragEnd = useCallback((event: DragEndEvent, categoryId: string) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        // Find the stack for this category
        const stack = goalStacks.find(s => s.category.id === categoryId);
        if (!stack) return;

        const oldIndex = stack.goals.findIndex(g => g.id === active.id);
        const newIndex = stack.goals.findIndex(g => g.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        // Compute new order: reorder within this stack, then combine all stacks
        const reorderedStackGoals = arrayMove(stack.goals, oldIndex, newIndex);

        // Build the full ordered list of all goal IDs across all stacks
        const allGoalIds: string[] = [];
        for (const s of goalStacks) {
            if (s.category.id === categoryId) {
                allGoalIds.push(...reorderedStackGoals.map(g => g.id));
            } else {
                allGoalIds.push(...s.goals.map(g => g.id));
            }
        }

        // Optimistically update by calling the API
        reorderGoals(allGoalIds).then(() => {
            refetch();
        }).catch((err) => {
            console.error('Failed to reorder goals:', err);
            refetch(); // Revert on error
        });
    }, [goalStacks, refetch]);

    if (loading) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-12">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400 text-sm">Loading goals...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
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
        <div className="w-full max-w-2xl mx-auto py-6 overflow-x-hidden px-4 sm:px-6">
            {goalStacks.length === 0 ? (
                <div className="text-center py-12">
                    <div className="max-w-md mx-auto">
                        <div className="w-14 h-14 mx-auto bg-neutral-800 rounded-full flex items-center justify-center mb-5">
                            <Target className="text-neutral-500" size={28} />
                        </div>
                        <h2 className="text-lg font-semibold text-white mb-2">
                            Goals give your habits direction.
                        </h2>
                        <p className="text-sm text-neutral-400 mb-5 leading-relaxed">
                            Track progress over time toward outcomes, milestones, or events.
                        </p>
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
                <div className="space-y-5">
                    {goalStacks.map((stack) => {
                        const isExpanded = expandedStacks.has(stack.category.id);
                        const goalCount = stack.goals.length;
                        const hasCumulativeGoals = stack.goals.some(g => g.type === 'cumulative');

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
                                onDragEnd={handleDragEnd}
                                sensors={sensors}
                                hasCumulativeGoals={hasCumulativeGoals}
                            />
                        );
                    })}
                </div>
            )}

            {/* Edit Modal */}
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
