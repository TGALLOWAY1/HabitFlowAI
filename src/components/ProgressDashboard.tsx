import React, { useState } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { useProgressOverview } from '../lib/useProgressOverview';
import { Heatmap } from './Heatmap';
import { ProgressRings } from './ProgressRings';
import { DailyCheckInModal } from './DailyCheckInModal';
import { Sun, Flame, Target, Activity, Clock, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { calculateHabitStats } from '../utils/analytics';
import { getEstimatedCompletionDate } from '../utils/pace';
import { GoalPulseCard } from './goals/GoalPulseCard';

import { CategoryActivityRow } from './CategoryActivityRow';

interface ProgressDashboardProps {
    onCreateGoal?: () => void;
    onViewGoal?: (goalId: string) => void;
    onSelectCategory?: (categoryId: string) => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ onCreateGoal, onViewGoal, onSelectCategory }) => {
    const { habits, logs, categories } = useHabitStore();
    const { data: progressData, loading: progressLoading } = useProgressOverview();
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [activityTab, setActivityTab] = useState<'overall' | 'category'>('overall');
    const [heatmapRange, setHeatmapRange] = useState<'year' | '90d' | '30d'>('year');
    const [categoryRange, setCategoryRange] = useState<'7d' | '14d' | '30d'>('14d');

    const habitStats = habits.map(habit => {
        const stats = calculateHabitStats(habit, logs);
        const pace = getEstimatedCompletionDate(habit, logs);
        return { ...habit, stats, pace };
    });



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

            {/* Activity Heatmap Section */}
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold text-white">Activity</h3>
                        {activityTab === 'overall' ? (
                            <select
                                value={heatmapRange}
                                onChange={(e) => setHeatmapRange(e.target.value as 'year' | '90d' | '30d')}
                                className="bg-neutral-800 text-xs text-neutral-300 border border-white/5 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                                <option value="year">Last Year</option>
                                <option value="90d">Last 90 Days</option>
                                <option value="30d">Last 30 Days</option>
                            </select>
                        ) : (
                            <div className="flex bg-neutral-800 rounded-md p-0.5 border border-white/5">
                                {(['7d', '14d', '30d'] as const).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setCategoryRange(r)}
                                        className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${categoryRange === r
                                            ? 'bg-neutral-700 text-white shadow-sm'
                                            : 'text-neutral-400 hover:text-white'
                                            }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex p-1 bg-neutral-800 rounded-lg self-start lg:self-auto">
                        <button
                            onClick={() => setActivityTab('overall')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activityTab === 'overall'
                                ? 'bg-neutral-700 text-white shadow-sm'
                                : 'text-neutral-400 hover:text-white'
                                }`}
                        >
                            Overall
                        </button>
                        <button
                            onClick={() => setActivityTab('category')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activityTab === 'category'
                                ? 'bg-neutral-700 text-white shadow-sm'
                                : 'text-neutral-400 hover:text-white'
                                }`}
                        >
                            By Category
                        </button>
                    </div>
                </div>

                <div className="animate-in fade-in duration-300">
                    {activityTab === 'overall' ? (
                        <Heatmap range={heatmapRange} />
                    ) : (
                        <div className="space-y-3">
                            {categories.map(category => {
                                const catHabits = habits.filter(h => h.categoryId === category.id && !h.archived);
                                if (catHabits.length === 0) return null;

                                return (
                                    <CategoryActivityRow
                                        key={category.id}
                                        category={category}
                                        habits={catHabits}
                                        range={categoryRange}
                                        onClick={() => onSelectCategory && onSelectCategory(category.id)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Goals at a glance */}
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Goals at a glance</h3>
                    <button
                        onClick={() => onViewGoal && onViewGoal('all')} // Use a safe fallback if 'all' isn't standard, but typically routing handles it. Or just rely on sidebar. 
                        className="text-xs text-neutral-500 hover:text-white transition-colors"
                    >
                        View all
                    </button>
                </div>

                {progressLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="text-emerald-500 animate-spin" size={20} />
                    </div>
                ) : !progressData || progressData.goalsWithProgress.length === 0 ? (
                    <div className="text-center py-6">
                        <h4 className="text-neutral-400 text-sm mb-2">No active goals</h4>
                        {onCreateGoal && (
                            <button
                                onClick={onCreateGoal}
                                className="text-emerald-500 hover:text-emerald-400 text-xs font-medium transition-colors"
                            >
                                + Add a goal
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {progressData.goalsWithProgress
                            .filter(({ goal }) => !goal.completedAt) // active only
                            .slice(0, 4) // max 4
                            .map((goalWithProgress) => (
                                <GoalPulseCard
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




            <DailyCheckInModal
                isOpen={isCheckInOpen}
                onClose={() => setIsCheckInOpen(false)}
            />
        </div>
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
