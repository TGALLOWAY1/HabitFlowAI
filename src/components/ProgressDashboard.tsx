import React from 'react';
import { useHabitStore } from '../store/HabitContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateHabitStats } from '../utils/analytics';
import { getEstimatedCompletionDate } from '../utils/pace';
import { Flame, Target, Activity, Clock } from 'lucide-react';
import { AccomplishmentsLog } from './AccomplishmentsLog';
import { Heatmap } from './Heatmap';

export const ProgressDashboard: React.FC = () => {
    const { habits, logs } = useHabitStore();

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
            {/* Heatmap Section */}
            <Heatmap />

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {habitStats.map(habit => (
                    <div key={habit.id} className="bg-neutral-900/50 border border-white/5 rounded-xl p-5 backdrop-blur-sm hover:bg-neutral-800/50 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-lg text-white">{habit.name}</h4>
                                <p className="text-xs text-neutral-400">
                                    {habit.goal.frequency === 'total'
                                        ? `Goal: ${habit.goal.target} ${habit.goal.unit}`
                                        : `${habit.goal.frequency} goal`}
                                </p>
                            </div>
                            <div className="p-2 bg-neutral-800 rounded-lg text-emerald-500">
                                <Activity size={20} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col">
                                <span className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
                                    <Flame size={12} className="text-orange-500" /> Streak
                                </span>
                                <span className="text-xl font-bold text-white">{habit.stats.currentStreak} <span className="text-xs font-normal text-neutral-500">days</span></span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
                                    <Target size={12} className="text-blue-500" /> Consistency
                                </span>
                                <span className="text-xl font-bold text-white">{habit.stats.consistencyScore}%</span>
                            </div>

                            {habit.goal.frequency === 'total' && habit.goal.target && (
                                <div className="col-span-2 mt-2 space-y-3">
                                    <div>
                                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                                            <span>Progress</span>
                                            <span>{Math.round((habit.stats.cumulativeValue / habit.goal.target) * 100)}%</span>
                                        </div>
                                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min((habit.stats.cumulativeValue / habit.goal.target) * 100, 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-neutral-500 mt-1">
                                            <span>{habit.stats.cumulativeValue} {habit.goal.unit}</span>
                                            <span>{habit.goal.target} {habit.goal.unit}</span>
                                        </div>
                                    </div>

                                    {habit.pace && (
                                        <div className="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-800/50 p-2 rounded-lg">
                                            <Clock size={12} className="text-emerald-400" />
                                            <span>{habit.pace}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Charts Section */}
                <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-white mb-6">Consistency Overview</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <XAxis dataKey="name" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="consistency" name="Consistency %" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Accomplishments Log */}
                <AccomplishmentsLog />
            </div>
        </div>
    );
};
