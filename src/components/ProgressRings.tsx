import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { useHabitStore } from '../store/HabitContext';
import { format, subDays } from 'date-fns';
import { Brain, Activity, Battery, Moon } from 'lucide-react';

// Custom Tooltip for dual-line charts
const DualTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Dedup payload in case we have multiple lines (solid + dashed) for same data
        const uniquePayload = payload.filter((entry: any, index: number, self: any[]) =>
            index === self.findIndex((e: any) => e.name === entry.name)
        );

        return (
            <div className="bg-neutral-800 border border-neutral-700 p-2 rounded shadow-lg text-xs z-50">
                <p className="text-white font-medium mb-1">{label}</p>
                {uniquePayload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span style={{ color: entry.color }}>
                            {entry.name}: {entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// Custom Diamond Dot for Evening
const DiamondDot = (props: any) => {
    const { cx, cy, stroke, value } = props;
    if (value === null || value === undefined) return null;

    return (
        <path
            d={`M${cx},${cy - 3}L${cx + 3},${cy}L${cx},${cy + 3}L${cx - 3},${cy}Z`}
            fill={stroke}
            stroke="none"
        />
    );
};

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

        // For sleep/energy, prioritize evening -> morning -> legacy
        if (metric === 'sleepScore') {
            return log.evening?.sleepScore || log.morning?.sleepScore || log.sleepScore || 0;
        }
        if (metric === 'energy') {
            return log.evening?.energy || log.morning?.energy || log.energy || 0;
        }

        // For depression/anxiety, we use this for the summary number (showing latest available)
        return log.evening?.[metric] || log.morning?.[metric] || log[metric] || 0;
    };

    const getDetailedDailyValue = (date: string, metric: 'depression' | 'anxiety') => {
        const log = wellbeingLogs[date];
        return {
            morning: log?.morning?.[metric] || 0,
            evening: log?.evening?.[metric] || 0
        };
    };

    const getDualWeeklyData = (metric: 'depression' | 'anxiety') => {
        const todayDate = new Date();
        return Array.from({ length: 7 }).map((_, i) => {
            const dateObj = subDays(todayDate, 6 - i);
            const dateStr = format(dateObj, 'yyyy-MM-dd');
            const log = wellbeingLogs[dateStr];

            return {
                date: format(dateObj, 'MMM d'),
                day: format(dateObj, 'EEE'),
                morning: log?.morning?.[metric] || null,
                evening: log?.evening?.[metric] || null,
                // Fallback for legacy single-value data mapped to evening
                eveningComputed: log?.evening?.[metric] ?? log?.[metric] ?? null
            };
        });
    };

    const currentWellbeing = {
        depression: getDetailedDailyValue(today, 'depression'),
        anxiety: getDetailedDailyValue(today, 'anxiety'),
        energy: getDailyValue(today, 'energy'),
        sleepScore: getDailyValue(today, 'sleepScore'),
    };

    const MetricRow = ({
        label,
        morningValue,
        eveningValue,
        max,
        metricKey,
        morningColor,
        eveningColor,
        iconColor,
        icon: Icon
    }: {
        label: string;
        morningValue: number;
        eveningValue: number;
        max: number;
        metricKey: 'depression' | 'anxiety';
        morningColor: string;
        eveningColor: string;
        iconColor: string;
        icon: any;
    }) => {
        const weeklyData = getDualWeeklyData(metricKey);

        const morningPercentage = (morningValue / max) * 100;
        const morningRingData = [{ value: morningPercentage }, { value: 100 - morningPercentage }];

        const eveningPercentage = (eveningValue / max) * 100;
        const eveningRingData = [{ value: eveningPercentage }, { value: 100 - eveningPercentage }];

        const renderRing = (data: any[], color: string, value: number, label: string) => (
            <div className="flex flex-col items-center gap-1">
                <div className="relative w-20 h-20">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={28}
                                outerRadius={36}
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
                    <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                        {value > 0 ? value : '-'}
                    </div>
                </div>
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>{label}</div>
            </div>
        );

        return (
            <div className="flex items-center justify-between p-6 bg-neutral-900/50 rounded-2xl border border-white/5 h-full">
                <div className="flex items-center">
                    {/* Icon and Label Section */}
                    <div className="mr-6 min-w-[100px]">
                        <div className="flex items-center gap-2 text-neutral-400 mb-1 font-medium">
                            <Icon size={18} style={{ color: iconColor }} />
                            {label}
                        </div>
                        <div className="text-xs text-neutral-500">Last 7 Days (M vs E)</div>
                    </div>

                    {/* Dual Rings */}
                    <div className="flex items-center gap-4 border-l border-white/5 pl-6">
                        {renderRing(morningRingData, morningColor, morningValue, 'Morning')}
                        {renderRing(eveningRingData, eveningColor, eveningValue, 'Evening')}
                    </div>
                </div>

                {/* Dual Line Chart */}
                <div className="flex-1 h-24 ml-8 border-l border-white/5 pl-8">
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
                                domain={[0, 5]}
                                hide
                            />
                            <Tooltip content={<DualTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />

                            {/* Morning - Dashed Layer (connects gaps) */}
                            <Line
                                name="Morning"
                                type="monotone"
                                dataKey="morning"
                                stroke={morningColor}
                                strokeWidth={2}
                                strokeDasharray="3 3"
                                strokeOpacity={0.6}
                                dot={false}
                                activeDot={false}
                                connectNulls={true}
                                isAnimationActive={false}
                            />
                            {/* Morning - Solid Layer (only consecutive data) */}
                            <Line
                                name="Morning"
                                type="monotone"
                                dataKey="morning"
                                stroke={morningColor}
                                strokeWidth={2}
                                dot={{ r: 3, fill: morningColor, strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                                connectNulls={false}
                                isAnimationActive={false}
                            />

                            {/* Evening - Dashed Layer (connects gaps) */}
                            <Line
                                name="Evening"
                                type="monotone"
                                dataKey="eveningComputed"
                                stroke={eveningColor}
                                strokeWidth={2}
                                strokeDasharray="3 3"
                                strokeOpacity={0.6}
                                dot={false}
                                activeDot={false}
                                connectNulls={true}
                                isAnimationActive={false}
                            />
                            {/* Evening - Solid Layer (only consecutive data) */}
                            <Line
                                name="Evening"
                                type="monotone"
                                dataKey="eveningComputed"
                                stroke={eveningColor}
                                strokeWidth={2}
                                dot={<DiamondDot fill={eveningColor} stroke={eveningColor} />}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                                connectNulls={false}
                                isAnimationActive={false}
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

            {/* Right Column: Wellbeing Metrics with Dual-Line Charts */}
            <div className="col-span-1 md:col-span-2 flex flex-col gap-6 h-full">
                <div className="flex-1">
                    <MetricRow
                        label="Depression"
                        morningValue={currentWellbeing.depression.morning}
                        eveningValue={currentWellbeing.depression.evening}
                        max={5}
                        metricKey="depression"
                        morningColor="#3b82f6" // Blue
                        eveningColor="#8b5cf6" // Violet
                        iconColor="#3b82f6"
                        icon={Brain}
                    />
                </div>
                <div className="flex-1">
                    <MetricRow
                        label="Anxiety"
                        morningValue={currentWellbeing.anxiety.morning}
                        eveningValue={currentWellbeing.anxiety.evening}
                        max={5}
                        metricKey="anxiety"
                        morningColor="#0ea5e9" // Sky
                        eveningColor="#a855f7" // Purple
                        iconColor="#8b5cf6"
                        icon={Activity}
                    />
                </div>
            </div>
        </div>
    );
};
