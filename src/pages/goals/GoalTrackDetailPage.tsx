/**
 * GoalTrackDetailPage
 *
 * Displays detailed view of a single goal track with its ordered goals.
 * Supports reordering, adding goals, and removing goals.
 */
import React, { useState, useMemo, useCallback } from 'react';
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
import { ArrowLeft, Route, Lock, Check, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { useGoalTrackDetail } from '../../lib/useGoalTrackDetail';
import { useGoalsWithProgress } from '../../lib/useGoalsWithProgress';
import { useHabitStore } from '../../store/HabitContext';
import { reorderTrackGoals, removeGoalFromTrack, addGoalToTrack } from '../../lib/persistenceClient';
import { format, parseISO } from 'date-fns';
import type { Goal } from '../../types';

interface GoalTrackDetailPageProps {
    trackId: string;
    onBack?: () => void;
    onViewGoal?: (goalId: string) => void;
}

const SortableTrackGoal: React.FC<{
    goal: Goal;
    index: number;
    total: number;
    onViewGoal?: (goalId: string) => void;
    onRemove: (goalId: string) => void;
}> = ({ goal, index, total, onViewGoal, onRemove }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: goal.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    const isLocked = goal.trackStatus === 'locked';
    const isCompleted = goal.trackStatus === 'completed';
    const isActive = goal.trackStatus === 'active';

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                isDragging ? 'bg-neutral-700/50 shadow-lg' :
                isActive ? 'bg-emerald-500/5 border border-emerald-500/20' :
                'bg-neutral-800/30 border border-white/5'
            } ${isLocked ? 'opacity-40' : ''}`}
        >
            {/* Drag handle */}
            <div {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none">
                <GripVertical size={16} className="text-neutral-500" />
            </div>

            {/* State indicator */}
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {isCompleted ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check size={12} className="text-emerald-400" />
                    </div>
                ) : isLocked ? (
                    <Lock size={14} className="text-neutral-600" />
                ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
            </div>

            {/* Goal info */}
            <button
                onClick={() => !isLocked && onViewGoal?.(goal.id)}
                disabled={isLocked}
                className={`flex-1 min-w-0 text-left ${isLocked ? 'cursor-default' : ''}`}
            >
                <div className={`text-sm ${
                    isCompleted ? 'text-neutral-500 line-through' :
                    isLocked ? 'text-neutral-500' :
                    'text-white font-medium'
                }`}>
                    {goal.title}
                </div>
                {isActive && goal.activeWindowStart && (
                    <div className="text-xs text-neutral-500 mt-0.5">
                        Tracking since {format(parseISO(goal.activeWindowStart), 'MMM d, yyyy')}
                    </div>
                )}
                {isCompleted && goal.activeWindowEnd && (
                    <div className="text-xs text-neutral-600 mt-0.5">
                        Completed {format(parseISO(goal.activeWindowEnd), 'MMM d, yyyy')}
                    </div>
                )}
            </button>

            {/* Step indicator */}
            <span className="text-xs text-neutral-600 flex-shrink-0">{index + 1}/{total}</span>

            {/* Remove button */}
            <button
                onClick={() => onRemove(goal.id)}
                className="p-1 rounded hover:bg-red-500/10 transition-colors flex-shrink-0"
                title="Remove from track"
            >
                <Trash2 size={13} className="text-neutral-600 hover:text-red-400" />
            </button>
        </div>
    );
};

export const GoalTrackDetailPage: React.FC<GoalTrackDetailPageProps> = ({
    trackId,
    onBack,
    onViewGoal,
}) => {
    const { data, loading, error, refetch } = useGoalTrackDetail(trackId);
    const { data: allGoalsWithProgress } = useGoalsWithProgress();
    const { categories } = useHabitStore();
    const [showAddGoalPicker, setShowAddGoalPicker] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const category = useMemo(() => {
        if (!data) return null;
        return categories.find(c => c.id === data.track.categoryId) || null;
    }, [data, categories]);

    // Available goals to add: same category, not in any track, not completed
    const availableGoals = useMemo(() => {
        if (!data || !allGoalsWithProgress) return [];
        return allGoalsWithProgress
            .filter(gwp =>
                gwp.goal.categoryId === data.track.categoryId &&
                !gwp.goal.trackId &&
                !gwp.goal.completedAt
            )
            .map(gwp => gwp.goal);
    }, [data, allGoalsWithProgress]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        if (!data) return;
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = data.goals.findIndex(g => g.id === active.id);
        const newIndex = data.goals.findIndex(g => g.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(data.goals, oldIndex, newIndex);
        try {
            await reorderTrackGoals(trackId, reordered.map(g => g.id));
            refetch();
        } catch (err) {
            console.error('Failed to reorder track goals:', err);
            refetch();
        }
    }, [data, trackId, refetch]);

    const handleRemoveGoal = useCallback(async (goalId: string) => {
        try {
            await removeGoalFromTrack(trackId, goalId);
            refetch();
        } catch (err) {
            console.error('Failed to remove goal from track:', err);
        }
    }, [trackId, refetch]);

    const handleAddGoal = useCallback(async (goalId: string) => {
        try {
            await addGoalToTrack(trackId, goalId);
            setShowAddGoalPicker(false);
            refetch();
        } catch (err) {
            console.error('Failed to add goal to track:', err);
        }
    }, [trackId, refetch]);

    if (loading) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-12">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400 text-sm">Loading track...</div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
                <button onClick={onBack} className="flex items-center gap-1.5 text-neutral-400 hover:text-white mb-4 text-sm">
                    <ArrowLeft size={16} /> Back
                </button>
                <div className="text-red-400 text-sm">{error || 'Track not found'}</div>
            </div>
        );
    }

    const { track, goals } = data;
    const completedCount = goals.filter(g => g.trackStatus === 'completed').length;
    const progressPercent = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;

    const isTailwindClass = category?.color?.startsWith('bg-');
    const categoryColorClass = isTailwindClass ? category!.color.replace('bg-', 'text-') : undefined;

    return (
        <div className="w-full max-w-2xl mx-auto py-6 px-4 sm:px-6">
            {/* Back button */}
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-neutral-400 hover:text-white mb-4 text-sm transition-colors"
            >
                <ArrowLeft size={16} /> Back to Goals
            </button>

            {/* Track header */}
            <div className="mb-6">
                <div className="flex items-center gap-2.5 mb-2">
                    <Route size={20} className="text-emerald-400" />
                    <h1 className="text-xl font-bold text-white">{track.name}</h1>
                </div>
                {track.description && (
                    <p className="text-sm text-neutral-400 mb-3">{track.description}</p>
                )}
                <div className="flex items-center gap-3 text-sm">
                    {category && (
                        <span className={`font-medium ${categoryColorClass || 'text-neutral-400'}`}>
                            {category.name}
                        </span>
                    )}
                    <span className="text-neutral-500">
                        {completedCount} of {goals.length} completed
                    </span>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-2 bg-neutral-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Goals list */}
            <div className="space-y-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={goals.map(g => g.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {goals.map((goal, index) => (
                            <SortableTrackGoal
                                key={goal.id}
                                goal={goal}
                                index={index}
                                total={goals.length}
                                onViewGoal={onViewGoal}
                                onRemove={handleRemoveGoal}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>

            {/* Add goal */}
            <div className="mt-4">
                {showAddGoalPicker ? (
                    <div className="bg-neutral-800/50 border border-white/10 rounded-lg p-3">
                        <div className="text-sm font-medium text-white mb-2">Add a goal to this track</div>
                        {availableGoals.length === 0 ? (
                            <div className="text-xs text-neutral-500">No available goals in this category</div>
                        ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {availableGoals.map(goal => (
                                    <button
                                        key={goal.id}
                                        onClick={() => handleAddGoal(goal.id)}
                                        className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700/50 rounded-md transition-colors"
                                    >
                                        {goal.title}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => setShowAddGoalPicker(false)}
                            className="mt-2 text-xs text-neutral-500 hover:text-neutral-400"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAddGoalPicker(true)}
                        className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-emerald-400 transition-colors"
                    >
                        <Plus size={15} /> Add goal to track
                    </button>
                )}
            </div>
        </div>
    );
};
