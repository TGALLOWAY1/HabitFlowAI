import React, { useMemo, useState } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { format, parseISO, isValid, eachDayOfInterval, isAfter, subDays, addDays, differenceInDays } from 'date-fns';

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
    // User-adjustable left edge of the trend window (YYYY-MM-DD). null = the
    // default start (first entry minus a buffer). Narrowing the window lets
    // users exclude a long inactivity gap (e.g. an injury break) so it doesn't
    // dominate the chart or drag the run-rate down. Cumulative y-values are
    // unaffected — the actual line is seeded with the running total carried in
    // from before the window, so progress from the start is never lost.
    const [windowStart, setWindowStart] = useState<string | null>(null);

    const { chartData, currentActual, forecastDateStr, defaultStartStr } = useMemo(() => {
        // 1. Determine the effective chart start. A valid user-chosen
        // windowStart wins; otherwise it's the first entry minus a 2-day
        // buffer, falling back to the goal's startDate.
        const today = new Date();
        const fallbackStart = parseISO(startDate);
        const firstEntry = firstEntryDate ? parseISO(firstEntryDate) : null;
        const defaultStart = (firstEntry && isValid(firstEntry))
            ? subDays(firstEntry, 2)
            : fallbackStart;
        const customStart = windowStart ? parseISO(windowStart) : null;
        const effectiveStart = (customStart && isValid(customStart)) ? customStart : defaultStart;
        const end = parseISO(deadline);

        const defaultStartStr = isValid(defaultStart) ? format(defaultStart, 'yyyy-MM-dd') : '';

        if (!isValid(effectiveStart) || !isValid(end)) {
            return { chartData: [], currentActual: 0, forecastDateStr: null, defaultStartStr };
        }

        const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const latestActual = sortedData.length > 0 ? sortedData[sortedData.length - 1].value : 0;
        const effectiveStartStr = format(effectiveStart, 'yyyy-MM-dd');

        // Cumulative value carried in from before the window. The actual line
        // and the run-rate baseline both start from here, so windowing never
        // discards earlier progress.
        let carryIn = 0;
        for (const d of sortedData) {
            if (d.date < effectiveStartStr) carryIn = d.value;
            else break;
        }

        // 2. Forecast the finish date from the run-rate measured over the
        // window only. Rate = progress made within the window / days since the
        // window start. Projecting the remaining work forward from today gives
        // the same result as the old whole-history formula when no window is
        // set (carryIn = 0, effectiveStart anchored at the first entry).
        const entriesInWindow = sortedData.filter(d => d.date >= effectiveStartStr).length;
        let forecastDate: Date | null = null;
        if (entriesInWindow >= 3) {
            const daysInWindow = Math.max(1, differenceInDays(today, effectiveStart));
            const dailyRate = (latestActual - carryIn) / daysInWindow;
            const remaining = targetValue - latestActual;
            if (dailyRate > 0 && remaining > 0) {
                forecastDate = addDays(today, Math.ceil(remaining / dailyRate));
            } else if (dailyRate > 0) {
                forecastDate = today;
            }
        }

        // 3. Determine the chart's right edge. Normally it's the deadline, but
        // if the forecast is past the deadline we extend the x-axis out so
        // both vertical markers stay visible.
        const chartEnd = (forecastDate && isAfter(forecastDate, end)) ? forecastDate : end;

        // If the window starts after the chart's right edge there's nothing to
        // draw — bail out rather than letting eachDayOfInterval throw.
        if (isAfter(effectiveStart, chartEnd)) {
            return { chartData: [], currentActual: latestActual, forecastDateStr: null, defaultStartStr };
        }

        const allDays = eachDayOfInterval({ start: effectiveStart, end: chartEnd });

        // Ideal pace: a straight line from the window's left edge (at the
        // carried-in total) up to targetValue on the deadline, then flat. When
        // no window is set carryIn is 0, so this reduces to the original
        // 0 -> target line.
        const idealSpanDays = differenceInDays(end, effectiveStart);
        const idealDailyPace = idealSpanDays > 0 ? (targetValue - carryIn) / idealSpanDays : (targetValue - carryIn);

        // Create a map of actual data for O(1) lookup
        const dataMap = new Map(sortedData.map(d => [d.date, d.value]));

        // Fill data points. The passed 'data' prop is already cumulative.
        // Seed with the carried-in total and carry forward the last known
        // value to fill gaps up to today. Future days keep actual = null.
        let lastKnownActual = carryIn;

        const points = allDays.map((dateObj, index) => {
            const dateStr = format(dateObj, 'yyyy-MM-dd');

            // Ideal caps at targetValue once we pass the deadline.
            const idealValue = Math.min(targetValue, carryIn + index * idealDailyPace);

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

        return {
            chartData: points,
            currentActual: lastKnownActual,
            forecastDateStr: forecastDate ? format(forecastDate, 'yyyy-MM-dd') : null,
            defaultStartStr,
        };
    }, [data, startDate, deadline, targetValue, firstEntryDate, windowStart]);

    // Required pace: how much per week do they still need to average to hit
    // the target by the deadline? Only shown if there's remaining progress
    // and the deadline is still in the future.
    const requiredPace = useMemo(() => {
        const end = parseISO(deadline);
        if (!isValid(end)) return null;
        const remaining = Math.max(0, targetValue - currentActual);
        if (remaining <= 0) return null;
        const daysRemaining = differenceInDays(end, new Date());
        if (daysRemaining <= 0) return null;
        const weekly = (remaining / daysRemaining) * 7;
        return weekly;
    }, [deadline, targetValue, currentActual]);

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

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    return (
        <div className="w-full space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                {requiredPace !== null ? (
                    <div className="text-sm text-neutral-400">
                        Required pace:{' '}
                        <span className="text-white font-medium">
                            {requiredPace.toFixed(1)} {unit}
                        </span>{' '}
                        / week
                    </div>
                ) : <span />}
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <label htmlFor="trend-window-start">Start from</label>
                    <input
                        id="trend-window-start"
                        type="date"
                        value={windowStart ?? ''}
                        min={defaultStartStr || undefined}
                        max={todayStr}
                        onChange={(e) => setWindowStart(e.target.value || null)}
                        className="bg-neutral-800 border border-white/10 rounded px-2 py-1 text-white text-xs [color-scheme:dark]"
                    />
                    {windowStart && (
                        <button
                            type="button"
                            onClick={() => setWindowStart(null)}
                            className="text-emerald-400 hover:text-emerald-300"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                    <span className="inline-block w-4 border-t border-neutral-500" />
                    <span className="text-neutral-400">Deadline {format(parseISO(deadline), 'MMM d')}</span>
                </div>
                {forecastDateStr && (
                    <div className="flex items-center gap-1.5">
                        <span className="inline-block w-4 border-t border-dashed border-emerald-500" />
                        <span className="text-emerald-500">Forecast {format(parseISO(forecastDateStr), 'MMM d')}</span>
                    </div>
                )}
            </div>
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

                    {/* Deadline vertical marker */}
                    <ReferenceLine
                        x={deadline}
                        stroke="#737373" // neutral-500
                        strokeWidth={1}
                    />

                    {/* Forecasted finish vertical marker */}
                    {forecastDateStr && (
                        <ReferenceLine
                            x={forecastDateStr}
                            stroke="#10b981" // emerald-500
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                        />
                    )}
                </ComposedChart>
            </ResponsiveContainer>
            </div>
        </div>
    );
};
