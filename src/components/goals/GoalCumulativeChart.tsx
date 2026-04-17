import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, isValid, subDays } from 'date-fns';
import { useThemeColors } from '../../theme/useThemeColors';

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
    synthetic?: boolean;
}

export const GoalCumulativeChart: React.FC<GoalCumulativeChartProps> = ({
    data,
    color,
    unit = ""
}) => {
    const themeColors = useThemeColors();
    const lineColor = color ?? themeColors.accent;
    const chartData = useMemo<ChartPoint[]>(() => {
        // Sort by date ascending to ensure proper line graph
        const sorted: ChartPoint[] = [...data]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(d => ({ date: d.date, value: d.value }));

        if (sorted.length === 0) return sorted;

        // Prepend a synthetic zero point 2 days before the first entry so the
        // chart visibly starts near the first real datapoint with a small buffer.
        const firstEntry = parseISO(sorted[0].date);
        if (isValid(firstEntry)) {
            const bufferStart = format(subDays(firstEntry, 2), 'yyyy-MM-dd');
            return [{ date: bufferStart, value: 0, synthetic: true }, ...sorted];
        }
        return sorted;
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
            <div className="flex items-center justify-center h-64 bg-surface-1/60 rounded-lg border border-line-subtle">
                <p className="text-content-muted text-sm">No progress data available yet.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-64 bg-surface-1/60 rounded-lg border border-line-subtle p-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorValueCumulative" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={themeColors.chartGrid} vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatXAxis}
                        stroke={themeColors.chartAxis}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        stroke={themeColors.chartAxis}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 'auto']}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: themeColors.chartTooltipBg,
                            borderColor: themeColors.lineSubtle,
                            color: themeColors.contentPrimary,
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}
                        itemStyle={{ color: lineColor }}
                        formatter={(value: number, _name, item) => {
                            // Suppress tooltip content for the synthetic leading buffer point
                            if (item && (item.payload as ChartPoint)?.synthetic) {
                                return [null, null] as unknown as [string, string];
                            }
                            return [`${value} ${unit}`, 'Total Progress'];
                        }}
                        labelFormatter={(label: string) => formatXAxis(label)}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={lineColor}
                        fillOpacity={1}
                        fill="url(#colorValueCumulative)"
                        strokeWidth={2}
                        dot={(props: { cx?: number; cy?: number; payload?: ChartPoint; index?: number }) => {
                            const { cx, cy, payload, index } = props;
                            if (!payload || payload.synthetic || cx == null || cy == null) {
                                // Recharts requires an SVG element return; render an invisible marker
                                return <circle key={`dot-hidden-${index ?? 'x'}`} cx={0} cy={0} r={0} fill="none" />;
                            }
                            return (
                                <circle
                                    key={`dot-${index ?? payload.date}`}
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={lineColor}
                                    stroke={themeColors.surface1}
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
