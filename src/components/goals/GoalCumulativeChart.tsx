import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, isValid, subDays, eachDayOfInterval, isAfter } from 'date-fns';

interface GoalCumulativeChartProps {
    data: Array<{
        date: string;
        value: number;
    }>;
    color?: string;
    unit?: string;
    targetValue?: number;
}

interface ChartPoint {
    date: string;
    value: number;
    isEntry?: boolean;
}

export const GoalCumulativeChart: React.FC<GoalCumulativeChartProps> = ({
    data,
    color = "#10b981", // emerald-500
    unit = ""
}) => {
    const chartData = useMemo<ChartPoint[]>(() => {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length === 0) return [];

        const firstEntry = parseISO(sorted[0].date);
        const lastEntry = parseISO(sorted[sorted.length - 1].date);
        if (!isValid(firstEntry) || !isValid(lastEntry)) {
            return sorted.map(d => ({ date: d.date, value: d.value, isEntry: true }));
        }

        // One point per calendar day so the x-axis is linear in time — with only
        // entry dates plotted, a 1-day gap and a 30-day gap would render the
        // same width. Start 2 days before the first entry for a small visual
        // buffer, and extend through today (or the last entry if future-dated)
        // so the chart doesn't stop at the last logged day.
        const today = new Date();
        const start = subDays(firstEntry, 2);
        const end = isAfter(lastEntry, today) ? lastEntry : today;

        const dataMap = new Map(sorted.map(d => [d.date, d.value]));
        let runningTotal = 0;
        return eachDayOfInterval({ start, end }).map(dateObj => {
            const dateStr = format(dateObj, 'yyyy-MM-dd');
            const isEntry = dataMap.has(dateStr);
            if (isEntry) runningTotal = dataMap.get(dateStr)!;
            return { date: dateStr, value: runningTotal, isEntry };
        });
    }, [data]);

    const formatXAxis = (tickItem: string) => {
        try {
            const date = parseISO(tickItem);
            return isValid(date) ? format(date, 'MMM d') : tickItem;
        } catch {
            return tickItem;
        }
    };

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-neutral-900/30 rounded-lg border border-white/5">
                <p className="text-neutral-500 text-sm">No progress data available yet.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-64 bg-neutral-900/30 rounded-lg border border-white/5 p-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorValueCumulative" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatXAxis}
                        stroke="#737373"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        stroke="#737373"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 'auto']}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#171717',
                            borderColor: '#262626',
                            color: '#e5e5e5',
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}
                        itemStyle={{ color: color }}
                        formatter={(value: number) => [`${value} ${unit}`, 'Total Progress']}
                        labelFormatter={(label: string) => formatXAxis(label)}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fillOpacity={1}
                        fill="url(#colorValueCumulative)"
                        strokeWidth={2}
                        dot={(props: { cx?: number; cy?: number; payload?: ChartPoint; index?: number }) => {
                            const { cx, cy, payload, index } = props;
                            if (!payload || !payload.isEntry || cx == null || cy == null) {
                                // Recharts requires an SVG element return; render an invisible marker
                                return <circle key={`dot-hidden-${index ?? 'x'}`} cx={0} cy={0} r={0} fill="none" />;
                            }
                            return (
                                <circle
                                    key={`dot-${index ?? payload.date}`}
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={color}
                                    stroke="#0A0A0A"
                                    strokeWidth={1.5}
                                />
                            );
                        }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        isAnimationActive={true}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
