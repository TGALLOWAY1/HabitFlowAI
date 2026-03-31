/**
 * Goal Detail Page
 * 
 * Displays comprehensive details for a single goal including:
 * - Header with Mantra and Progress Bar
 * - Cumulative Progress Chart (Line Graph)
 * - Weekly Contribution Summary
 * - Linked Habits with Navigation
 * - Manual Progress Logging with habit-first logic
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useGoalDetail } from '../../lib/useGoalDetail';
import { useHabitStore } from '../../store/HabitContext';
import { Loader2, ArrowLeft, Check, Edit, Trash2, Trophy, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { DeleteGoalConfirmModal } from '../../components/goals/DeleteGoalConfirmModal';
import { EditGoalModal } from '../../components/goals/EditGoalModal';
import { deleteGoal, markGoalAsCompleted, fetchHabitEntries, getLocalTimeZone, createGoal } from '../../lib/persistenceClient';
import { invalidateAllGoalCaches } from '../../lib/goalDataCache';
import { GoalStatusChip } from '../../components/goals/GoalSharedComponents';
import { GoalTrendChart } from '../../components/goals/GoalTrendChart';

import { GoalCumulativeChart } from '../../components/goals/GoalCumulativeChart';
import { GoalWeeklySummary } from '../../components/goals/GoalWeeklySummary';
import { GoalEntryList } from '../../components/goals/GoalEntryList';
import type { HabitEntry } from '../../models/persistenceTypes';

interface GoalDetailPageProps {
    goalId: string;
    onBack?: () => void;
    onNavigateToCompleted?: (goalId: string) => void;
    onViewWinArchive?: () => void;
    onViewHabit?: (habitId: string) => void;
    onViewGoal?: (goalId: string) => void;
}

type Tab = 'cumulative' | 'dayByDay' | 'trend';

export const GoalDetailPage: React.FC<GoalDetailPageProps> = ({ goalId, onBack, onNavigateToCompleted, onViewHabit, onViewGoal }) => {
    const { data, loading, error, refetch } = useGoalDetail(goalId);
    const { habits } = useHabitStore();
    const [activeTab, setActiveTab] = useState<Tab>('cumulative');
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    const [showExtendForm, setShowExtendForm] = useState(false);
    const [extendTarget, setExtendTarget] = useState('');
    const [isExtending, setIsExtending] = useState(false);
    const [extendError, setExtendError] = useState<string | null>(null);

    // Habit Entries State
    const [linkedHabitEntries, setLinkedHabitEntries] = useState<HabitEntry[]>([]);

    // Track previous state to prevent infinite loops (Auto-completion)
    const previousPercentRef = useRef<number | null>(null);
    const isCompletingRef = useRef<boolean>(false);

    // Create habit lookup map
    const habitMap = useMemo(() => {
        const map = new Map<string, typeof habits[0]>();
        habits.forEach(habit => map.set(habit.id, habit));
        return map;
    }, [habits]);

    // Get linked habits
    const linkedHabits = useMemo(() => {
        if (!data) return [];
        return data.goal.linkedHabitIds
            .map(habitId => habitMap.get(habitId))
            .filter((habit): habit is NonNullable<typeof habit> => habit !== undefined);
    }, [data, habitMap]);

    // Fetch Linked Habit Entries (via truthQuery)
    useEffect(() => {
        const loadEntries = async () => {
            if (!data?.goal.linkedHabitIds.length) {
                setLinkedHabitEntries([]);
                return;
            }

            try {
                console.log('[GoalDetail] Loading entries for habits:', data.goal.linkedHabitIds);
                // Fetch all habit entries in parallel
                const entryArrays = await Promise.all(
                    data.goal.linkedHabitIds.map(habitId =>
                        fetchHabitEntries(habitId, undefined, undefined, getLocalTimeZone())
                            .then(entries => {
                                console.log(`[GoalDetail] Fetched ${entries.length} entries for habit ${habitId}`);
                                return entries.map((ev: any) => ({
                                    id: ev.id || `entry-${ev.habitId}-${ev.dayKey}`,
                                    habitId: ev.habitId,
                                    timestamp: ev.timestampUtc,
                                    dayKey: ev.dayKey,
                                    date: ev.dayKey,
                                    dateKey: ev.dayKey,
                                    value: ev.value,
                                    source: ev.source,
                                    routineId: ev.provenance.routineId,
                                    deletedAt: ev.deletedAt,
                                    createdAt: ev.timestampUtc,
                                    updatedAt: ev.timestampUtc,
                                }));
                            })
                    )
                );
                setLinkedHabitEntries(entryArrays.flat());
            } catch (err) {
                console.error("Failed to load habit entries", err);
            }
        };

        if (data) {
            loadEntries();
        }
    }, [data?.goal.linkedHabitIds]);

    // Combine Data for Charts/List
    const combinedEntries = useMemo(() => {
        if (!data) return [];

        const fromHabits = linkedHabitEntries
            .filter(entry => {
                const habit = habitMap.get(entry.habitId);
                if (!habit) return false;

                // Type-Based Aggregation Logic
                if (data.goal.type === 'cumulative') {
                    // Include all habits (boolean habits contribute their target per entry)
                    return true;
                }

                // For other goal types (onetime), accept everything
                return true;
            })
            .map(entry => {
                const habit = habitMap.get(entry.habitId);
                // Use entry.date (YYYY-MM-DD) as the canonical date source.
                // Fallback to timestamp split if needed, but entry.date is required.
                const dateStr = entry.date || entry.timestamp.split('T')[0];

                return {
                    id: entry.id,
                    date: dateStr,
                    // Now that we filtered incompatible units, we can safely use value.
                    // If value is undefined but unit matched (unlikely if strictly checked, but possible for some data shapes),
                    // we might default to 0 or 1.
                    // If goal is cumulative, we expect a number.
                    value: (() => {
                        const h = habitMap.get(entry.habitId);
                        // Boolean habits contribute their target value per entry
                        if (h?.goal.type === 'boolean' && data.goal.type === 'cumulative') {
                            return h.goal.target ?? 1;
                        }
                        return entry.value !== undefined ? entry.value : 0;
                    })(),
                    source: 'habit' as const,
                    habitName: habit?.name,
                    unit: habit?.goal.unit || data.goal.unit
                };
            });

        const combined = fromHabits.filter(item => item.date);
        console.log('[GoalDetail] Final combined entries:', combined);
        return combined.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }, [data, linkedHabitEntries, habitMap]);

    // Calculate Cumulative Data for Chart
    const cumulativeData = useMemo(() => {
        let total = 0;
        // Sort ascending by date safely
        const sorted = [...combinedEntries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        return sorted.map(entry => {
            total += entry.value;
            return {
                date: entry.date,
                value: total
            };
        });
    }, [combinedEntries]);

    // Inline Milestones Logic
    const milestones = useMemo(() => {
        if (!data?.goal.targetValue) return [];
        return [
            { percent: 25 },
            { percent: 50 },
            { percent: 75 }
        ];
    }, [data]);

    const handleDeleteGoal = async () => {
        try {
            await deleteGoal(goalId);
            invalidateAllGoalCaches();
            if (onBack) onBack();
        } catch (err) {
            console.error('Error deleting goal:', err);
        }
    };

    const handleMarkComplete = async () => {
        setIsMarkingComplete(true);
        try {
            await markGoalAsCompleted(goalId);
            invalidateAllGoalCaches();
            setShowCompleteConfirm(false);
            if (onNavigateToCompleted) onNavigateToCompleted(goalId);
            else refetch();
        } catch (err) {
            console.error('Error marking goal complete:', err);
            setIsMarkingComplete(false);
        }
    };

    const handleExtendGoal = async () => {
        if (!data) return;
        const numTarget = parseFloat(extendTarget);
        if (isNaN(numTarget) || numTarget <= 0) {
            setExtendError('Target must be a positive number');
            return;
        }
        if (numTarget <= (data.goal.targetValue ?? 0)) {
            setExtendError(`New target must be higher than the original (${data.goal.targetValue})`);
            return;
        }

        setIsExtending(true);
        setExtendError(null);

        try {
            const { goal } = data;
            // Clear past deadlines to avoid invalid date intervals in GoalTrendChart
            const deadline = goal.deadline && goal.deadline >= new Date().toISOString().slice(0, 10)
                ? goal.deadline
                : undefined;

            const newGoal = await createGoal({
                title: goal.title,
                type: goal.type,
                targetValue: numTarget,
                unit: goal.unit,
                linkedHabitIds: goal.linkedHabitIds,
                linkedTargets: goal.linkedTargets,
                aggregationMode: goal.aggregationMode,
                countMode: goal.countMode,
                deadline,
                categoryId: goal.categoryId,
                notes: goal.notes,
            });

            invalidateAllGoalCaches();

            // Navigate to the new active goal
            if (onViewGoal) {
                onViewGoal(newGoal.id);
            } else if (onBack) {
                onBack();
            }
        } catch (err) {
            console.error('Error extending goal:', err);
            setExtendError(err instanceof Error ? err.message : 'Failed to extend goal');
            setIsExtending(false);
        }
    };

    // Auto-completion Effect
    useEffect(() => {
        if (!data || loading || isCompletingRef.current) return;
        const { goal, progress } = data;
        if (goal.type === 'onetime' || !goal.targetValue) return;

        const currentPercent = progress.percent;
        const currentCompletedAt = goal.completedAt;

        if (currentPercent >= 100 && !currentCompletedAt && !isCompletingRef.current) {
            if ((previousPercentRef.current === null || previousPercentRef.current < 100)) {
                isCompletingRef.current = true;
                markGoalAsCompleted(goalId).then(() => {
                    invalidateAllGoalCaches();
                    refetch();
                    if (onNavigateToCompleted) onNavigateToCompleted(goalId);
                }).catch(err => {
                    console.error(err);
                    isCompletingRef.current = false;
                });
            }
        }
        previousPercentRef.current = currentPercent;
    }, [data, loading, goalId, refetch, onNavigateToCompleted]);


    if (loading || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="text-emerald-500 animate-spin mb-4" size={32} />
                <div className="text-neutral-400">Loading goal details...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="text-red-400 mb-2">Error loading goal</div>
                <button onClick={() => refetch()} className="text-white underline">Retry</button>
            </div>
        );
    }

    const { goal, progress } = data;
    const progressPercent = goal.completedAt ? 100 : progress.percent;

    // Determine if Trend tab should be shown
    const canShowTrend = goal.type === 'cumulative' && goal.deadline;

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8 bg-[#0A0A0A] min-h-screen text-white">
            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-8">
                {onBack && (
                    <button onClick={onBack} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
                        <ArrowLeft size={18} />
                        <span>Back</span>
                    </button>
                )}
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowEditModal(true)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" aria-label="Edit goal">
                        <Edit size={18} />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(true)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" aria-label="Delete goal">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Header Section */}
            <div className="mb-10">
                <div className="flex flex-col gap-4">
                    {/* Title & Badge */}
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-white tracking-tight">{goal.title}</h1>
                                <GoalStatusChip status={goal.completedAt ? 'completed' : 'active'}>
                                    {goal.completedAt ? 'Completed' : 'Active'}
                                </GoalStatusChip>
                            </div>
                            {/* Mantra / Notes (Read Only) */}
                            {goal.notes && (
                                <p className="text-neutral-400 text-sm leading-relaxed max-w-2xl">
                                    “{goal.notes}”
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar with Inline Milestones */}
                    <div className="relative pt-6 pb-2">
                        <div className="h-4 bg-neutral-800 rounded-full overflow-hidden relative">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                            {/* Milestones Markers */}
                            {milestones.map(m => (
                                <div
                                    key={m.percent}
                                    className="absolute top-0 bottom-0 w-px bg-white/20 z-10"
                                    style={{ left: `${m.percent}%` }}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between mt-2 text-xs font-medium text-neutral-500">
                            <span>Start</span>
                            {goal.targetValue && (
                                <span>{goal.targetValue} {goal.unit}</span>
                            )}
                        </div>

                        {/* Current Value Display */}
                        <div className="mt-2 text-2xl font-semibold text-white">
                            {goal.type === 'cumulative'
                                ? <span>{progress.currentValue} <span className="text-neutral-500 text-lg font-normal">/ {goal.targetValue} {goal.unit}</span></span>
                                : <span>{progressPercent}% Complete</span>
                            }
                        </div>
                    </div>

                    {/* Target Date */}
                    {goal.deadline && (
                        <div className="flex items-center gap-2 text-neutral-500 text-sm">
                            <span className=" px-2 py-0.5 bg-neutral-900 rounded border border-white/5">
                                Target: {format(parseISO(goal.deadline), 'MMM d, yyyy')}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Mark Complete Button (for active goals) */}
            {!goal.completedAt && (
                <div className="mb-8">
                    {!showCompleteConfirm ? (
                        <button
                            onClick={() => setShowCompleteConfirm(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors font-medium text-sm"
                        >
                            <Trophy size={16} />
                            Mark as Complete
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                            <span className="text-sm text-emerald-300">Mark this goal as achieved?</span>
                            <button
                                onClick={handleMarkComplete}
                                disabled={isMarkingComplete}
                                className="px-4 py-1.5 bg-emerald-500 text-neutral-900 font-medium text-sm rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
                            >
                                {isMarkingComplete ? 'Completing...' : 'Yes, I did it!'}
                            </button>
                            <button
                                onClick={() => setShowCompleteConfirm(false)}
                                className="px-3 py-1.5 text-neutral-400 hover:text-white text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Extend Goal (for completed goals) */}
            {goal.completedAt && goal.type !== 'onetime' && (
                <div className="mb-8">
                    {!showExtendForm ? (
                        <div>
                            <button
                                onClick={() => {
                                    setExtendTarget(((goal.targetValue ?? 0) * 2).toString());
                                    setExtendError(null);
                                    setShowExtendForm(true);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors font-medium text-sm"
                            >
                                <TrendingUp size={16} />
                                Extend Goal
                            </button>
                            <p className="text-neutral-500 text-xs mt-2">
                                Create a new goal with a higher target. This goal stays in your Win Archive.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-3">
                            <div className="text-sm text-blue-300 font-medium">Set your new target</div>
                            <div className="text-xs text-neutral-500">
                                Original target: {goal.targetValue} {goal.unit} (completed). Your progress carries over to the new goal.
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    value={extendTarget}
                                    onChange={(e) => setExtendTarget(e.target.value)}
                                    min={(goal.targetValue ?? 0) + 1}
                                    className="w-32 bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="New target"
                                    autoFocus
                                />
                                {goal.unit && <span className="text-neutral-400 text-sm">{goal.unit}</span>}
                            </div>
                            {extendError && (
                                <div className="text-red-400 text-xs">{extendError}</div>
                            )}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleExtendGoal}
                                    disabled={isExtending}
                                    className="px-4 py-1.5 bg-blue-500 text-white font-medium text-sm rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50"
                                >
                                    {isExtending ? 'Creating...' : 'Create Extended Goal'}
                                </button>
                                <button
                                    onClick={() => setShowExtendForm(false)}
                                    disabled={isExtending}
                                    className="px-3 py-1.5 text-neutral-400 hover:text-white text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-white/10 mb-8">
                <button
                    onClick={() => setActiveTab('cumulative')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'cumulative'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-neutral-400 hover:text-white'
                        }`}
                >
                    Cumulative
                </button>
                {canShowTrend && (
                    <button
                        onClick={() => setActiveTab('trend')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'trend'
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-transparent text-neutral-400 hover:text-white'
                            }`}
                    >
                        Trend
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('dayByDay')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dayByDay'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-neutral-400 hover:text-white'
                        }`}
                >
                    Day by Day
                </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-8 animate-in fade-in duration-300">
                {activeTab === 'cumulative' && (
                    <div className="space-y-8 h-full">
                        {/* Cumulative Chart */}
                        <div>
                            <h3 className="text-neutral-400 text-sm font-medium mb-4 uppercase tracking-wider">Total Progress</h3>
                            <GoalCumulativeChart
                                data={cumulativeData}
                                color="#10b981"
                                unit={goal.unit}
                                targetValue={goal.targetValue}
                            />
                        </div>

                        {/* Weekly Summary */}
                        <GoalWeeklySummary entries={combinedEntries} unit={goal.unit} />
                    </div>
                )}

                {activeTab === 'trend' && canShowTrend && (
                    <div className="space-y-8 h-full">
                        <div>
                            <h3 className="text-neutral-400 text-sm font-medium mb-4 uppercase tracking-wider">Progress Trend</h3>
                            <p className="text-neutral-500 text-sm mb-4">
                                Solid line is your actual progress. Dashed line is the pace needed to reach your target by the deadline.
                            </p>
                            <GoalTrendChart
                                data={cumulativeData}
                                startDate={goal.createdAt}
                                deadline={goal.deadline!}
                                targetValue={goal.targetValue!}
                                color="#10b981"
                                unit={goal.unit}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'dayByDay' && (
                    <div>
                        <GoalEntryList entries={combinedEntries} />
                    </div>
                )}
            </div>


            {/* Linked Habits Section */}
            <div className="mt-12 pt-8 border-t border-white/10">
                <div className="mb-6">
                    <p className="text-emerald-400 font-medium mb-1">Habits are how goals are achieved.</p>
                    <p className="text-neutral-500 text-sm">Consistent daily action drives your progress.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {linkedHabits.length > 0 ? linkedHabits.map(habit => (
                        <button
                            key={habit.id}
                            onClick={() => {
                                if (onViewHabit) onViewHabit(habit.id);
                            }}
                            className="flex items-center gap-4 p-4 bg-neutral-900/50 border border-white/5 rounded-xl hover:bg-neutral-800 hover:border-white/10 transition-all text-left group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
                                {habit.goal.type === 'boolean' ? <Check size={20} /> : <span className="font-bold text-xs">{habit.goal.unit}</span>}
                            </div>
                            <div>
                                <div className="font-medium text-white group-hover:text-emerald-400 transition-colors">{habit.name}</div>
                                <div className="text-xs text-neutral-500 mt-0.5">
                                    {habit.goal.type === 'number' ? `Daily Target: ${habit.goal.target} ${habit.goal.unit}` : 'Daily Completion'}
                                </div>
                            </div>
                        </button>
                    )) : (
                        <div className="col-span-full p-6 border border-dashed border-neutral-800 rounded-xl text-center">
                            <p className="text-neutral-500 text-sm mb-3">No habits linked to this goal yet.</p>
                            <button
                                onClick={() => setShowEditModal(true)} // Edit modal allows linking/creating habits
                                className="text-emerald-400 text-sm font-medium hover:underline"
                            >
                                Link a habit
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Manual contribution area removed in V1: progress is derived from habit entries */}

            {/* Modals */}
            {data && (
                <EditGoalModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    goalWithProgress={data}
                    onSuccess={refetch}
                />
            )}

            {data && (
                <DeleteGoalConfirmModal
                    isOpen={showDeleteConfirm}
                    onClose={() => setShowDeleteConfirm(false)}
                    onConfirm={handleDeleteGoal}
                    goalTitle={data.goal.title}
                />
            )}
        </div>
    );
};
