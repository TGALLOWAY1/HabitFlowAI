import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { useHabitStore } from '../store/HabitContext';
import { format, subDays } from 'date-fns';
import { Brain, Activity, Battery, Moon } from 'lucide-react';

export const ProgressRings: React.FC = () => {
    const { habits, logs, wellbeingLogs } = useHabitStore();
    const today = format(new Date(), 'yyyy-MM-dd');

    // Calculate Habit Completion
    const activeHabits = habits.filter(h => !h.archived);
    const completedCount = activeHabits.filter(h => {
        const log = logs[`${h.id}-${today}`];
        return log?.completed;
    }).length;
    const completionRate = activeHabits.length > 0
        ? Math.round((completedCount / activeHabits.length) * 100)
        : 0;

    const habitData = [
        { name: 'Completed', value: completionRate },
        { name: 'Remaining', value: 100 - completionRate }
    ];

    // Wellbeing Data Helpers
    const getDailyValue = (date: string, metric: 'depression' | 'anxiety' | 'energy' | 'sleepScore') => {
        const log = wellbeingLogs[date];
        if (!log) return 0;
        // Prioritize evening, then morning, then legacy top-level
        if (metric === 'sleepScore') {
            return log.evening?.sleepScore || log.morning?.sleepScore || log.sleepScore || 0;
        }
        return log.evening?.[metric] || log.morning?.[metric] || log[metric] || 0;
    };

    const getWeeklyData = (metric: 'depression' | 'anxiety' | 'energy') => {
        return Array.from({ length: 7 }).map((_, i) => {
            const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
            return {
                date: format(new Date(date), 'MMM d'),
                day: format(new Date(date), 'EEE'),
                value: getDailyValue(date, metric)
            };
        });
    };

    const currentWellbeing = {
        depression: getDailyValue(today, 'depression'),
        anxiety: getDailyValue(today, 'anxiety'),
        energy: getDailyValue(today, 'energy'),
        sleepScore: getDailyValue(today, 'sleepScore'),
    };

    const MetricRow = ({
        label,
        value,
        max,
        color,
        icon: Icon,
        metricKey
    }: {
        label: string;
        value: number;
        max: number;
        color: string;
        icon: any;
        metricKey: 'depression' | 'anxiety';
    }) => {
        const weeklyData = getWeeklyData(metricKey);
        const percentage = (value / max) * 100;
        const ringData = [{ value: percentage }, { value: 100 - percentage }];

        return (
            <div className="flex items-center justify-between p-6 bg-neutral-900/50 rounded-2xl border border-white/5 h-full">
                <div className="flex items-center gap-6">
                    {/* Larger Progress Ring */}
                    <div className="relative w-24 h-24">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={ringData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={45}
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    <Cell key="val" fill={color} />
                                    <Cell key="empty" fill="#262626" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xl">
                            {value}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 text-neutral-400 mb-1 font-medium">
                            <Icon size={18} style={{ color }} />
                            {label}
                        </div>
                        <div className="text-xs text-neutral-500">Last 7 Days</div>
                    </div>
                </div>

                {/* Weekly Trend Line Chart */}
                <div className="flex-1 h-24 ml-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyData}>
                            <XAxis
                                dataKey="day"
                                stroke="#525252"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                domain={[1, 5]}
                                hide
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px', fontSize: '12px' }}
                                itemStyle={{ color: color }}
                                labelStyle={{ color: '#a3a3a3', marginBottom: '4px' }}
                                formatter={(value: number) => [value, label]}
                                labelFormatter={(label, payload) => {
                                    if (payload && payload.length > 0) {
                                        return `${payload[0].payload.day}, ${payload[0].payload.date}`;
                                    }
                                    return label;
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={2}
                                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Daily Overview & Main Ring */}
            <div className="flex flex-col items-center justify-between p-6 bg-neutral-900/50 rounded-2xl border border-white/5 h-full">
                <h3 className="text-xl font-bold text-white mb-4">Daily Overview</h3>

                <div className="relative w-48 h-48 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={habitData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={85}
                                startAngle={90}
                                endAngle={-270}
                                dataKey="value"
                                stroke="none"
                            >
                                <Cell key="completed" fill="#10b981" />
                                <Cell key="remaining" fill="#262626" />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold text-white">{completionRate}%</span>
                        <span className="text-sm text-neutral-500 uppercase tracking-wider">Done</span>
                    </div>
                </div>

                {/* Sleep & Energy Stacked Below Ring */}
                <div className="flex flex-col gap-3 w-full">
                    <div className="flex items-center gap-3 px-4 py-3 bg-neutral-800/50 rounded-xl border border-white/5 w-full">
                        <Moon size={20} className="text-indigo-400" />
                        <div className="flex items-center justify-between w-full">
                            <span className="text-sm text-neutral-400">Sleep Score</span>
                            <span className="text-lg font-bold text-white">{currentWellbeing.sleepScore}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 bg-neutral-800/50 rounded-xl border border-white/5 w-full">
                        <Battery size={20} className="text-emerald-400" />
                        <div className="flex items-center justify-between w-full">
                            <span className="text-sm text-neutral-400">Energy</span>
                            <span className="text-lg font-bold text-white">{currentWellbeing.energy}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Wellbeing Metrics with Trends */}
            <div className="col-span-1 md:col-span-2 flex flex-col gap-6 h-full">
                <div className="flex-1">
                    <MetricRow
                        label="Depression"
                        value={currentWellbeing.depression}
                        max={5}
                        color="#3b82f6" // Blue
                        icon={Brain}
                        metricKey="depression"
                    />
                </div>
                <div className="flex-1">
                    <MetricRow
                        label="Anxiety"
                        value={currentWellbeing.anxiety}
                        max={5}
                        color="#8b5cf6" // Violet
                        icon={Activity}
                        metricKey="anxiety"
                    />
                </div>
            </div>
        </div>
    );
};
