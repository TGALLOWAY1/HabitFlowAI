import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, isValid, subDays, startOfDay } from 'date-fns';

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
    ts: number;
    value: number;
    isEntry?: boolean;
}

export const GoalCumulativeChart: React.FC<GoalCumulativeChartProps> = ({
    data,
    color = "#10b981", // emerald-500
    unit = ""
}) => {
    const chartData = useMemo<ChartPoint[]>(() => {
        // Only real entries become data points; the time-scaled x-axis keeps
        // spacing linear in time regardless of gaps, so the point count stays
        // bounded by the entry count no matter how far back the series starts.
        const sorted = [...data]
            .filter(d => isValid(parseISO(d.date)))
            .sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length === 0) return [];

        const entries: ChartPoint[] = sorted.map(d => ({
            ts: parseISO(d.date).getTime(),
            value: d.value,
            isEntry: true
        }));

        // Zero point 2 days before the first entry so the line visibly rises
        // from a baseline instead of starting mid-chart.
        const points: ChartPoint[] = [
            { ts: subDays(entries[0].ts, 2).getTime(), value: 0 },
            ...entries
        ];

        // Extend the line flat through today (unless the last entry is
        // future-dated) so the axis doesn't stop at the last logged day.
        const todayTs = startOfDay(new Date()).getTime();
        const last = entries[entries.length - 1];
        if (todayTs > last.ts) {
            points.push({ ts: todayTs, value: last.value });
        }

        return points;
    }, [data]);

    const formatXAxis = (ts: number) => {
        const date = new Date(ts);
        return isValid(date) ? format(date, 'MMM d') : '';
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
                        dataKey="ts"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
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
                        labelFormatter={(label: number) => formatXAxis(label)}
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
                                    key={`dot-${index ?? payload.ts}`}
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
