import React, { useMemo } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, isValid, eachDayOfInterval, isAfter, subDays } from 'date-fns';

interface GoalTrendChartProps {
    data: Array<{
        date: string;
        value: number;
    }>;
    startDate: string;
    deadline: string;
    targetValue: number;
    /**
     * Date of the first real entry (YYYY-MM-DD). When provided, the chart's
     * x-axis starts 2 days before this date instead of the goal creation date,
     * and the ideal-pace line is recomputed from this start to the deadline.
     */
    firstEntryDate?: string;
    color?: string;
    unit?: string;
}

export const GoalTrendChart: React.FC<GoalTrendChartProps> = ({
    data,
    startDate,
    deadline,
    targetValue,
    firstEntryDate,
    color = "#10b981", // emerald-500
    unit = ""
}) => {
    const chartData = useMemo(() => {
        // 1. Determine the effective chart start: first entry minus a 2-day
        // buffer if we have one, else fall back to the goal's startDate.
        const today = new Date();
        const fallbackStart = parseISO(startDate);
        const firstEntry = firstEntryDate ? parseISO(firstEntryDate) : null;
        const effectiveStart = (firstEntry && isValid(firstEntry))
            ? subDays(firstEntry, 2)
            : fallbackStart;
        const end = parseISO(deadline);

        if (!isValid(effectiveStart) || !isValid(end)) return [];

        // Generate all days between effectiveStart and deadline
        const allDays = eachDayOfInterval({ start: effectiveStart, end });

        // Calculate the ideal pace (linear growth) from effectiveStart -> deadline.
        // The ideal line starts at 0 on the chart's leftmost day and rises
        // linearly to targetValue on the deadline.
        const totalDuration = allDays.length;
        const dailyPace = totalDuration > 1 ? targetValue / (totalDuration - 1) : targetValue;

        // Create a map of actual data for O(1) lookup
        const dataMap = new Map(data.map(d => [d.date, d.value]));

        // Fill data points. The passed 'data' prop is already cumulative.
        // Carry forward the last known actual value to fill gaps on days
        // with no log, up to today. Future days keep actual = null.
        let lastKnownActual = 0;

        return allDays.map((dateObj, index) => {
            const dateStr = format(dateObj, 'yyyy-MM-dd');

            const idealValue = Math.min(targetValue, index * dailyPace);

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
    }, [data, startDate, deadline, targetValue, firstEntryDate]);

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
