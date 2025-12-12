import React, { useState, useMemo } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { useProgressOverview } from '../lib/useProgressOverview';
import { Heatmap } from './Heatmap';
import { ProgressRings } from './ProgressRings';
import { DailyCheckInModal } from './DailyCheckInModal';
import { Sun, Flame, Target, Activity, Clock, ChevronDown, ChevronRight, AlertTriangle, Plus, Loader2, AlertCircle } from 'lucide-react';
import { calculateHabitStats } from '../utils/analytics';
import { getEstimatedCompletionDate } from '../utils/pace';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AccomplishmentsLog } from './AccomplishmentsLog';
import { format } from 'date-fns';
import { GoalProgressBar, GoalStatusChip, goalCardBaseClasses, goalTitleCompactClasses, goalMetadataClasses } from './goals/GoalSharedComponents';

interface ProgressDashboardProps {
    onCreateGoal?: () => void;
    onViewGoal?: (goalId: string) => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ onCreateGoal, onViewGoal }) => {
    const { habits, logs, categories } = useHabitStore();
    const { data: progressData, loading: progressLoading, error: progressError } = useProgressOverview();
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);

    const habitStats = habits.map(habit => {
        const stats = calculateHabitStats(habit, logs);
        const pace = getEstimatedCompletionDate(habit, logs);
        return { ...habit, stats, pace };
    });

    const chartData = habitStats.map(h => ({
        name: h.name,
        completed: h.stats.totalCompletions,
        consistency: h.stats.consistencyScore,
    }));

    return (
        <div className="space-y-6 overflow-y-auto pb-20">
            {/* Header with Check-in Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setIsCheckInOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/5"
                >
                    <Sun size={16} className="text-amber-400" />
                    Daily Check-in
                </button>
            </div>

            {/* Progress Rings */}
            <ProgressRings />

            {/* Heatmap Section */}
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                <Heatmap />
            </div>

            {/* Goals Section */}
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">How your goals are progressing</h3>
                </div>

                {progressLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="text-emerald-500 animate-spin" size={24} />
                    </div>
                ) : progressError ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                        <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                        <div className="flex-1">
                            <div className="text-red-400 text-sm">{progressError.message}</div>
                        </div>
                    </div>
                ) : !progressData || progressData.goalsWithProgress.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="mb-4">
                            <Target className="text-emerald-400/50 mx-auto" size={40} />
                        </div>
                        <h4 className="text-white font-medium mb-2">No goals yet</h4>
                        <p className="text-neutral-400 text-sm mb-4">
                            Create a goal to turn your daily habits into meaningful long-term achievements.
                        </p>
                        {onCreateGoal && (
                            <button
                                onClick={onCreateGoal}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors mx-auto text-sm"
                            >
                                <Plus size={16} />
                                Create Your First Goal
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* 
                            Completed Goals Display Policy:
                            We hide completed goals from the active goals list on the Progress page.
                            Completed goals are accessible via the Win Archive.
                            This keeps the Progress page focused on active, in-progress goals.
                        */}
                        {progressData.goalsWithProgress
                            .filter(({ goal }) => !goal.completedAt) // Only show active goals
                            .map((goalWithProgress) => (
                                <CompactGoalCard
                                    key={goalWithProgress.goal.id}
                                    goalWithProgress={goalWithProgress}
                                    onClick={() => {
                                        if (onViewGoal) {
                                            onViewGoal(goalWithProgress.goal.id);
                                        }
                                    }}
                                />
                            ))}
                    </div>
                )}
            </div>

            {/* Habit Stats Grouped by Category */}
            <div className="space-y-4">
                {categories.map(category => {
                    const categoryHabits = habitStats.filter(h => h.categoryId === category.id);
                    if (categoryHabits.length === 0) return null;
                    return <CategorySection key={category.id} category={category} habits={categoryHabits} />;
                })}
            </div>

            {/* Consistency Chart */}
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-white mb-6">Consistency Trends</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis dataKey="name" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }}
                                itemStyle={{ color: '#e5e5e5' }}
                            />
                            <Bar dataKey="consistency" name="Consistency %" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <AccomplishmentsLog />

            <DailyCheckInModal
                isOpen={isCheckInOpen}
                onClose={() => setIsCheckInOpen(false)}
            />
        </div>
    );
};

/**
 * Get today's date in YYYY-MM-DD format.
 */
function getTodayDateString(): string {
    return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Compute today's contribution to a goal from lastSevenDays data.
 * 
 * lastSevenDays is ordered with most recent first (index 0 = today).
 * 
 * @param progress - GoalProgress object with lastSevenDays array
 * @param progress - GoalProgress object with lastSevenDays array
 * @returns Today's contribution value, or null if no data for today
 */
function getTodayContribution(progress: any): number | null {
    if (!progress.lastSevenDays || progress.lastSevenDays.length === 0) {
        return null;
    }

    // lastSevenDays is ordered most recent first, so index 0 should be today
    const todayDate = getTodayDateString();
    const todayEntry = progress.lastSevenDays.find((day: any) => day.date === todayDate);

    if (!todayEntry) {
        return null;
    }

    return todayEntry.value;
}

/**
 * Compact Goal Card for Progress Dashboard
 * 
 * A simplified version of GoalCard that shows:
 * - Title
 * - Progress bar with percent
 * - Inactivity warning badge (if present)
 * - Today's contribution (if any)
 * - Clickable to navigate to goal detail
 */
const CompactGoalCard: React.FC<{
    goalWithProgress: { goal: any; progress: any };
    onClick: () => void;
}> = ({ goalWithProgress, onClick }) => {
    const { goal, progress } = goalWithProgress;

    // Compute today's contribution
    const todayContribution = useMemo(() => {
        return getTodayContribution(progress);
    }, [progress]);

    return (
        <button
            onClick={onClick}
            className={`w-full text-left ${goalCardBaseClasses} p-4 hover:border-emerald-500/50 hover:bg-neutral-800 transition-all duration-200 group`}
        >
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                    <h4 className={`${goalTitleCompactClasses} mb-1 group-hover:text-emerald-400 transition-colors truncate`}>
                        {goal.title}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${goalMetadataClasses} capitalize`}>{goal.type}</span>
                        {progress.inactivityWarning && (
                            <GoalStatusChip status="warning">
                                <AlertTriangle size={12} className="inline mr-1" />
                                Inactive
                            </GoalStatusChip>
                        )}
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-emerald-400">
                        {Math.min(100, progress.percent)}%
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-2">
                <GoalProgressBar percent={progress.percent} height="sm" />
            </div>

            {/* Progress Details */}
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                <span>
                    {goal.type === 'cumulative'
                        ? `${progress.currentValue} / ${goal.targetValue} ${goal.unit || ''}`
                        : goal.type === 'frequency'
                            ? `${progress.currentValue} of ${goal.targetValue} days`
                            : goal.completedAt ? 'Completed' : 'In Progress'}
                </span>
                <span>{goal.linkedHabitIds.length} {goal.linkedHabitIds.length === 1 ? 'habit' : 'habits'}</span>
            </div>

            {/* Today's Contribution */}
            <div className="text-xs">
                {todayContribution !== null && todayContribution > 0 ? (
                    <span className="text-emerald-400 font-medium">
                        Today: +{todayContribution} {goal.type === 'cumulative' ? goal.unit || '' : 'day'}
                    </span>
                ) : (
                    <span className="text-neutral-500">No progress yet today</span>
                )}
            </div>
        </button>
    );
};

const CategorySection: React.FC<{ category: any, habits: any[] }> = ({ category, habits }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const avgConsistency = Math.round(
        habits.reduce((acc, h) => acc + h.stats.consistencyScore, 0) / habits.length
    );

    // Extract color safely (assuming format 'bg-color-500')
    const colorMap: Record<string, string> = {
        'bg-emerald-500': 'text-emerald-500',
        'bg-violet-500': 'text-violet-500',
        'bg-rose-500': 'text-rose-500',
        'bg-amber-500': 'text-amber-500',
        'bg-blue-500': 'text-blue-500',
        'bg-fuchsia-500': 'text-fuchsia-500',
        'bg-cyan-500': 'text-cyan-500',
        'bg-green-500': 'text-green-500',
        'bg-purple-500': 'text-purple-500', // Legacy support
    };

    const textColorClass = colorMap[category.color] || category.color.replace('bg-', 'text-');

    return (
        <div className="bg-neutral-900/30 rounded-2xl border border-white/5 overflow-hidden transition-all">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={20} className="text-neutral-400" /> : <ChevronRight size={20} className="text-neutral-400" />}
                    <h3 className={`text-lg font-bold ${textColorClass}`}>
                        {category.name}
                    </h3>
                    <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">
                        {habits.length} habits
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-medium text-white">{avgConsistency}%</div>
                        <div className="text-xs text-neutral-500">Consistency</div>
                    </div>
                    {/* Mini Progress Bar for Summary */}
                    <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${category.color} opacity-80`}
                            style={{ width: `${avgConsistency}%` }}
                        />
                    </div>
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 pt-0 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {habits.map((habit: any) => (
                            <div key={habit.id} className="bg-neutral-900/50 rounded-xl border border-white/5 p-4 backdrop-blur-sm hover:bg-neutral-900/80 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-medium text-white">{habit.name}</h4>
                                        <p className="text-xs text-neutral-500 mt-1">
                                            Started {new Date(habit.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 bg-neutral-800 px-2 py-1 rounded text-xs text-neutral-400">
                                        <Activity size={14} />
                                        <span>{habit.goal.frequency}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-neutral-800/50 rounded-lg p-2 text-center">
                                        <div className="flex items-center justify-center gap-1 text-xs text-neutral-500 mb-1">
                                            <Flame size={12} className="text-orange-500" /> Streak
                                        </div>
                                        <div className="text-lg font-bold text-white">{habit.stats.currentStreak}</div>
                                    </div>
                                    <div className="bg-neutral-800/50 rounded-lg p-2 text-center">
                                        <div className="flex items-center justify-center gap-1 text-xs text-neutral-500 mb-1">
                                            <Target size={12} className="text-blue-500" /> Consistency
                                        </div>
                                        <div className="text-lg font-bold text-white">{habit.stats.consistencyScore}%</div>
                                    </div>
                                    <div className="bg-neutral-800/50 rounded-lg p-2 text-center">
                                        <div className="flex items-center justify-center gap-1 text-xs text-neutral-500 mb-1">
                                            <Clock size={12} className="text-emerald-400" /> Total
                                        </div>
                                        <div className="text-lg font-bold text-white">{habit.stats.totalCompletions}</div>
                                    </div>
                                </div>

                                {habit.pace && (
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-neutral-500">Estimated Completion</span>
                                            <span className="text-emerald-400 font-medium">{habit.pace}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
