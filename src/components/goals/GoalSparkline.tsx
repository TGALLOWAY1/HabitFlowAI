import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

interface GoalSparklineProps {
    data: Array<{
        date: string;
        value: number;
    }>;
    color?: string;
    height?: number;
}

export const GoalSparkline: React.FC<GoalSparklineProps> = ({
    data,
    color = "#10b981", // emerald-500
    height = 40
}) => {
    // Reverse data if it comes in descending order (most recent first)
    // We want chronological order for the chart
    const chartData = useMemo(() => {
        return [...data].reverse();
    }, [data]);

    if (data.length === 0) return null;

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {/* Minimal Y-Axis to set domain but hide labels */}
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                        strokeWidth={1.5}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
