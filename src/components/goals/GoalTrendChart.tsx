import React, { useMemo } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, isValid, eachDayOfInterval, isAfter } from 'date-fns';

interface GoalTrendChartProps {
    data: Array<{
        date: string;
        value: number;
    }>;
    startDate: string;
    deadline: string;
    targetValue: number;
    color?: string;
    unit?: string;
}

export const GoalTrendChart: React.FC<GoalTrendChartProps> = ({
    data,
    startDate,
    deadline,
    targetValue,
    color = "#10b981", // emerald-500
    unit = ""
}) => {
    const chartData = useMemo(() => {
        // 1. Generate the full date range from Start -> Deadline
        const today = new Date();
        const start = parseISO(startDate);
        const end = parseISO(deadline);

        if (!isValid(start) || !isValid(end)) return [];

        // Generate all days between start and deadline
        const allDays = eachDayOfInterval({ start, end });

        // Calculate the ideal pace (linear growth)
        const totalDuration = allDays.length;
        const dailyPace = targetValue / (totalDuration - 1); // -1 because day 1 is 0 progress

        // Create a map of actual data for O(1) lookup
        const dataMap = new Map(data.map(d => [d.date, d.value]));

        // Fill data points
        // We only want to show "Actual" up to today (or the last log date if future)
        // But we want "Ideal" for the whole range

        // Note: The passed 'data' prop is already cumulative from GoalDetailPage.
        // However, if there are gaps in 'data' (days with no logs), the cumulative value stays the same.
        // We need to carry forward the last known actual value to fill gaps in the chart
        // until we reach "today".

        let lastKnownActual = 0;

        return allDays.map((dateObj, index) => {
            const dateStr = format(dateObj, 'yyyy-MM-dd');

            // Ideal Value: Linear projection
            const idealValue = Math.min(targetValue, index * dailyPace);

            // Actual Value:
            // Only populate if date <= today
            let actualValue: number | null = null;

            if (!isAfter(dateObj, today)) {
                if (dataMap.has(dateStr)) {
                    lastKnownActual = dataMap.get(dateStr)!;
                }
                actualValue = lastKnownActual;
            }

            return {
                date: dateStr,
                actual: actualValue,
                ideal: idealValue
            };
        });
    }, [data, startDate, deadline, targetValue]);

    const formatXAxis = (tickItem: string) => {
        try {
            const date = parseISO(tickItem);
            return isValid(date) ? format(date, 'MMM d') : tickItem;
        } catch {
            return tickItem;
        }
    };

    if (!isValid(parseISO(startDate)) || !isValid(parseISO(deadline))) {
        return (
            <div className="flex items-center justify-center h-64 bg-neutral-900/30 rounded-lg border border-white/5">
                <p className="text-neutral-500 text-sm">Invalid date configuration.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-80 bg-neutral-900/30 rounded-lg border border-white/5 p-4">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
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
                        domain={[0, 'auto']} // Let it auto-scale, likely up to targetValue
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#171717',
                            borderColor: '#262626',
                            color: '#e5e5e5',
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}
                        labelFormatter={(label: string) => formatXAxis(label)}
                        formatter={(value: number, name: string) => {
                            if (name === 'actual') return [`${value.toFixed(1)} ${unit}`, 'Actual'];
                            if (name === 'ideal') return [`${value.toFixed(1)} ${unit}`, 'Ideal Pace'];
                            return [value, name];
                        }}
                    />

                    {/* Ideal Line (Dashed) */}
                    <Line
                        type="monotone"
                        dataKey="ideal"
                        stroke="#525252" // Neutral-600
                        strokeDasharray="5 5"
                        dot={false}
                        strokeWidth={2}
                        name="ideal"
                    />

                    {/* Actual Area (Solid) */}
                    <Area
                        type="monotone"
                        dataKey="actual"
                        stroke={color}
                        fillOpacity={1}
                        fill="url(#colorActual)"
                        strokeWidth={2}
                        name="actual"
                        connectNulls // In case of gaps, though we fill them logic-side
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};
