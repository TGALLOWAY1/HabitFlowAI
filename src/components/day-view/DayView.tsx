import { useMemo, useState, useEffect } from 'react';
import { useHabitStore } from '../../store/HabitContext';
import { getHabitsForDate } from '../../utils/habitUtils';
import { evaluateChecklistSuccess } from '../../shared/checklistSuccessRule';
import { PinnedHabitsStrip } from './PinnedHabitsStrip';
import { DayCategorySection } from './DayCategorySection';
import { CategoryPickerModal } from '../CategoryPickerModal';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { fetchDayView, getLocalTimeZone } from '../../lib/persistenceClient';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
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

import type { Habit } from '../../types';

interface DayViewHabitStatus {
    habit: Habit;
    isComplete: boolean;
    currentValue: number;
    targetValue: number;
    progressPercent: number;
    weekComplete?: boolean;
    completedChildrenCount?: number;
    totalChildrenCount?: number;
}

interface DayViewData {
    dayKey: string;
    habits: DayViewHabitStatus[];
}

interface SortableCategoryWrapperProps {
    id: string;
    children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
}

const SortableCategoryWrapper: React.FC<SortableCategoryWrapperProps> = ({ id, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
        zIndex: isDragging ? 10 : undefined,
    };

    return (
        <div ref={setNodeRef} style={style}>
            {children({ ...attributes, ...listeners })}
        </div>
    );
};

interface DayViewProps {
    onAddHabit?: () => void;
}

export const DayView = ({ onAddHabit }: DayViewProps = {}) => {
    const {
        habits,
        categories,
        logs,
        toggleHabit,
        updateHabit,
        upsertHabitEntry,
        deleteHabitEntryByKey,
        reorderCategories
    } = useHabitStore();

    // Drag-and-drop sensors for category reordering
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleCategoryDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = categories.findIndex((c) => c.id === active.id);
            const newIndex = categories.findIndex((c) => c.id === over.id);
            try {
                await reorderCategories(arrayMove(categories, oldIndex, newIndex));
            } catch (error) {
                console.error('Failed to reorder categories:', error);
            }
        }
    };

    // Use Today — stable reference to avoid re-computation on every render
    const today = useMemo(() => new Date(), []);
    const dateStr = format(today, 'yyyy-MM-dd');
    const displayDate = format(today, 'EEEE · MMM d');

    // Day View state (from truthQuery)
    const [dayViewData, setDayViewData] = useState<DayViewData | null>(null);
    const [dayViewLoading, setDayViewLoading] = useState(true);
    const [dayViewError, setDayViewError] = useState<string | null>(null);
    const [categoryPickerHabit, setCategoryPickerHabit] = useState<Habit | null>(null);

    // Fetch day view from truthQuery endpoint
    useEffect(() => {
        const loadDayView = async () => {
            setDayViewLoading(true);
            setDayViewError(null);
            try {
                const data = await fetchDayView(dateStr, getLocalTimeZone());
                setDayViewData(data);
            } catch (err) {
                console.error('Failed to load day view:', err);
                setDayViewError(err instanceof Error ? err.message : 'Failed to load day view');
            } finally {
                setDayViewLoading(false);
            }
        };

        loadDayView();
    }, [dateStr]);

    // Create lookup map for habit statuses (from API)
    const habitStatusMap = useMemo(() => {
        if (!dayViewData) return new Map<string, DayViewHabitStatus>();
        return new Map(dayViewData.habits.map(status => [status.habit.id, status]));
    }, [dayViewData]);

    // 1. Filter Habits for Today (Root level, frequency match)
    const todaysHabits = useMemo(() => {
        if (!habits) return [];
        return getHabitsForDate(habits, today);
    }, [habits, today]);

    // Lookup Map for Bundle Resolution
    const allHabitsLookup = useMemo(() => {
        return new Map(habits.map(h => [h.id, h]));
    }, [habits]);

    // Merge with context logs so toggles from Today view update UI immediately
    const resolvedHabitStatusMap = useMemo(() => {
        const map = new Map(habitStatusMap);

        // Helper to merge a single habit's log into the map
        const mergeHabitLog = (habit: Habit) => {
            const key = `${habit.id}-${dateStr}`;
            const log = logs[key];
            if (log !== undefined) {
                const currentValue = log.value ?? 0;
                const targetValue = habit.goal?.target ?? (habit.goal?.type === 'number' ? 1 : 1);
                const isComplete = habit.goal?.type === 'number'
                    ? (habit.goal.target ? (currentValue >= habit.goal.target) : currentValue > 0)
                    : !!log.completed;
                const progressPercent = habit.goal?.target
                    ? Math.min(100, Math.round((currentValue / habit.goal.target) * 100))
                    : (isComplete ? 100 : 0);
                const existing = map.get(habit.id);
                if (existing) {
                    map.set(habit.id, { ...existing, isComplete, currentValue, targetValue, progressPercent });
                } else {
                    map.set(habit.id, {
                        habit,
                        isComplete,
                        currentValue,
                        targetValue,
                        progressPercent,
                    });
                }
            }
        };

        // Merge root habits
        todaysHabits.forEach(mergeHabitLog);

        // Merge sub-habits of bundles so DayCategorySection can look up their status
        todaysHabits.forEach(habit => {
            if (habit.type === 'bundle' && habit.subHabitIds) {
                habit.subHabitIds.forEach(subId => {
                    const subHabit = allHabitsLookup.get(subId);
                    if (subHabit) mergeHabitLog(subHabit);
                });
            }
        });

        // Recompute bundle parent completion from children's merged statuses.
        // Uses evaluateChecklistSuccess for checklist bundles (respects configurable success rule)
        // and OR logic for choice bundles (any child complete → parent complete).
        todaysHabits.forEach(habit => {
            if (habit.type === 'bundle' && habit.subHabitIds && habit.subHabitIds.length > 0) {
                let completedChildren = 0;
                habit.subHabitIds.forEach(subId => {
                    if (map.get(subId)?.isComplete) completedChildren++;
                });

                const totalChildren = habit.subHabitIds.length;
                const parentComplete = habit.bundleType === 'choice'
                    ? completedChildren > 0
                    : evaluateChecklistSuccess(completedChildren, totalChildren, habit.checklistSuccessRule).meetsSuccessRule;

                const existing = map.get(habit.id);
                if (existing) {
                    map.set(habit.id, {
                        ...existing,
                        isComplete: parentComplete,
                        completedChildrenCount: completedChildren,
                        totalChildrenCount: totalChildren,
                    });
                }
            }
        });

        return map;
    }, [habitStatusMap, logs, todaysHabits, dateStr, allHabitsLookup]);

    // 2. Identify Pinned Habits
    const pinnedHabits = useMemo(() => {
        return todaysHabits.filter(h => h.pinned);
    }, [todaysHabits]);

    // 3. Group by Category
    const UNCATEGORIZED_ID = '__uncategorized__';
    const groupedHabits = useMemo(() => {
        const groups = new Map<string, Habit[]>();
        categories.forEach(c => groups.set(c.id, []));

        todaysHabits.forEach(h => {
            const list = groups.get(h.categoryId);
            if (list) list.push(h);
            else {
                // Habit's category doesn't exist — group as uncategorized
                const uncategorized = groups.get(UNCATEGORIZED_ID) || [];
                uncategorized.push(h);
                groups.set(UNCATEGORIZED_ID, uncategorized);
            }
        });
        return groups;
    }, [todaysHabits, categories]);

    // Handlers
    const handleToggle = async (habitId: string) => {
        await toggleHabit(habitId, dateStr);
    };

    const handlePin = async (habitId: string) => {
        const habit = habits.find(h => h.id === habitId);
        if (habit) {
            await updateHabit(habitId, { pinned: !habit.pinned });
        }
    };

    const handleUpdateEstimate = async (habitId: string, minutes: number) => {
        await updateHabit(habitId, { timeEstimate: minutes });
    };

    // Sort categories (optional, if categories have order)
    // Assuming categories array is sorted or we verify sort?
    // HabitContext usually returns them in DB order?
    // Let's rely on categories array order.

    // Empty State — show actionable guidance for new users
    if (todaysHabits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-6 sm:p-10 text-center">
                {/* The Rules — matching InfoModal style */}
                <div className="w-full max-w-sm bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2.5 mb-5">
                    <p className="text-xs text-emerald-400 uppercase tracking-wide font-semibold mb-1.5">The Rules</p>
                    <ul className="space-y-0.5 text-sm text-neutral-300">
                        <li>Habits are <span className="text-emerald-400 font-medium">performed</span></li>
                        <li>Routines are <span className="text-emerald-400 font-medium">completed</span></li>
                        <li>Goals are <span className="text-emerald-400 font-medium">achieved</span></li>
                    </ul>
                </div>

                {/* Definitions — matching InfoModal structure */}
                <div className="w-full max-w-sm space-y-4 mb-6 text-left">
                    <div className="pl-3 border-l-2 border-emerald-500/40">
                        <p className="text-sm text-neutral-200">
                            <span className="font-bold text-emerald-400">Habit</span>
                        </p>
                        <p className="text-sm text-neutral-400 mt-1">A repeated behavior performed over time. Each day, a habit is simply performed or not.</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {['Morning Walk', 'Drink Water', 'Read 5 pages', 'Stretch', 'Vitamins'].map((ex) => (
                                <span key={ex} className="px-2.5 py-0.5 text-xs text-neutral-400 bg-neutral-800/80 rounded-full border border-white/5">{ex}</span>
                            ))}
                        </div>
                    </div>
                    <div className="pl-3 border-l-2 border-emerald-500/40">
                        <p className="text-sm text-neutral-200">
                            <span className="font-bold text-emerald-400">Routine</span>
                        </p>
                        <p className="text-sm text-neutral-400 mt-1">A group of habits performed together in a sequence.</p>
                        <p className="text-xs text-neutral-500 italic mt-1.5 pl-2">— "Morning Reset" — Stretch + Meditate + Review goals</p>
                    </div>
                    <div className="pl-3 border-l-2 border-emerald-500/40">
                        <p className="text-sm text-neutral-200">
                            <span className="font-bold text-emerald-400">Goal</span>
                        </p>
                        <p className="text-sm text-neutral-400 mt-1">An outcome achieved by consistently performing the habits that support it.</p>
                        <p className="text-xs text-neutral-500 italic mt-1.5 pl-2">— "Run a 10K" — supported by: Running habit</p>
                    </div>
                </div>

                {onAddHabit && (
                    <button
                        onClick={onAddHabit}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                        Create Your First Habit
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full max-w-6xl mx-auto pb-24 px-4 sm:px-6">
            {/* Header */}
            <div className="py-3 flex items-center justify-between">
                <p className="text-neutral-400 font-medium">{displayDate}</p>
            </div>

            {/* Loading State */}
            {dayViewLoading && (
                <div className="flex items-center justify-center py-8">
                    <p className="text-neutral-500">Loading...</p>
                </div>
            )}

            {/* Error State */}
            {dayViewError && (
                <div className="flex items-center justify-center py-8">
                    <p className="text-red-500">Error: {dayViewError}</p>
                </div>
            )}

            {/* Pinned / Focus Section */}
            {!dayViewLoading && !dayViewError && pinnedHabits.length > 0 && (
                <PinnedHabitsStrip
                    habits={pinnedHabits}
                    onUnpin={handlePin}
                    onToggle={handleToggle}
                    checkStatus={(id) => {
                        const status = resolvedHabitStatusMap.get(id);
                        return status?.isComplete ?? false;
                    }}
                />
            )}

            {/* Categories */}
            {!dayViewLoading && !dayViewError && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleCategoryDragEnd}
                >
                    <SortableContext
                        items={categories.map(c => c.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col gap-2">
                            {categories.map(cat => {
                                const catHabits = groupedHabits.get(cat.id) || [];
                                if (catHabits.length === 0) return null;

                                return (
                                    <SortableCategoryWrapper key={cat.id} id={cat.id}>
                                        {(dragHandleProps) => (
                                            <DayCategorySection
                                                category={cat}
                                                habits={catHabits}
                                                habitStatusMap={resolvedHabitStatusMap}
                                                dateStr={dateStr}
                                                onToggle={handleToggle}
                                                onPin={handlePin}
                                                onUpdateEstimate={handleUpdateEstimate}
                                                onMoveToCategory={(h) => setCategoryPickerHabit(h)}
                                                allHabitsLookup={allHabitsLookup}
                                                onUpdateHabitEntry={upsertHabitEntry}
                                                deleteHabitEntryByKey={deleteHabitEntryByKey}
                                                dragHandleProps={dragHandleProps}
                                            />
                                        )}
                                    </SortableCategoryWrapper>
                                );
                            })}
                            {(groupedHabits.get(UNCATEGORIZED_ID) || []).length > 0 && (
                                <DayCategorySection
                                    key={UNCATEGORIZED_ID}
                                    category={{ id: UNCATEGORIZED_ID, name: 'Uncategorized', color: 'bg-amber-600' }}
                                    habits={groupedHabits.get(UNCATEGORIZED_ID)!}
                                    habitStatusMap={resolvedHabitStatusMap}
                                    dateStr={dateStr}
                                    onToggle={handleToggle}
                                    onPin={handlePin}
                                    onUpdateEstimate={handleUpdateEstimate}
                                    onMoveToCategory={(h) => setCategoryPickerHabit(h)}
                                    allHabitsLookup={allHabitsLookup}
                                    onUpdateHabitEntry={upsertHabitEntry}
                                    deleteHabitEntryByKey={deleteHabitEntryByKey}
                                />
                            )}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* Footer / Empty Space for scrolling */}
            <div className="h-12" />

            {/* Category Picker Modal */}
            <CategoryPickerModal
                isOpen={!!categoryPickerHabit}
                onClose={() => setCategoryPickerHabit(null)}
                habitId={categoryPickerHabit?.id ?? ''}
                currentCategoryId={categoryPickerHabit?.categoryId ?? ''}
            />
        </div>
    );
};
