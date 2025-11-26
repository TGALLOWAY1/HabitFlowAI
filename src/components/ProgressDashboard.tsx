import React, { useState } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { Heatmap } from './Heatmap';
import { ProgressRings } from './ProgressRings';
import { DailyCheckInModal } from './DailyCheckInModal';
import { Sun, Flame, Target, Activity, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { calculateHabitStats } from '../utils/analytics';
import { getEstimatedCompletionDate } from '../utils/pace';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AccomplishmentsLog } from './AccomplishmentsLog';

export const ProgressDashboard: React.FC = () => {
    const { habits, logs, categories } = useHabitStore();
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
