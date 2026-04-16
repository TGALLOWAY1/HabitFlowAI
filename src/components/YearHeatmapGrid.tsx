import React, { useEffect, useMemo, useRef } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { getHeatmapColor } from '../theme/heatmap';
import { useTheme } from '../theme/ThemeContext';
import { useThemeColors } from '../theme/useThemeColors';
import { getBundleChildIds, isHabitComplete } from '../utils/habitUtils';
import { eachDayOfInterval, subDays, format, getDay, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { Tooltip } from 'react-tooltip';
import { HeatmapLegend } from './HeatmapLegend';

interface YearHeatmapGridProps {
    habits: any[];
}

export const YearHeatmapGrid: React.FC<YearHeatmapGridProps> = React.memo(({ habits }) => {
    const { logs, extendLogWindow } = useHabitStore();
    const { resolvedMode } = useTheme();
    const themeColors = useThemeColors();

    // On mount, extend the log window to cover a full year if needed.
    // The initial load only fetches 90 days; the year heatmap needs 365.
    const hasExtended = useRef(false);
    useEffect(() => {
        if (hasExtended.current) return;
        hasExtended.current = true;
        const today = new Date();
        const yearAgo = subDays(today, 365);
        const startDayKey = format(yearAgo, 'yyyy-MM-dd');
        const endDayKey = format(subDays(today, 91), 'yyyy-MM-dd'); // Only fetch the gap (day 91-365)
        extendLogWindow(startDayKey, endDayKey);
    }, [extendLogWindow]);

    const { weeks, monthLabels } = useMemo(() => {
        const today = new Date();
        const endDate = endOfWeek(today); // Always end at end of current week
        const startDate = startOfWeek(subDays(endDate, 364)); // Default year

        const days = eachDayOfInterval({ start: startDate, end: endDate });

        // Exclude bundle sub-habits from counting
        const childIds = getBundleChildIds(habits);

        // First pass: Calculate activity counts and find max
        let maxCount = 0;
        const processedDays = days.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const activeHabits = habits.filter(h => new Date(h.createdAt) <= date && !h.archived && !childIds.has(h.id));

            let completionCount = 0;
            const categoryIds = new Set<string>();

            if (activeHabits.length > 0) {
                activeHabits.forEach(habit => {
                    if (isHabitComplete(habit, logs, dateStr)) {
                        completionCount++;
                        categoryIds.add(habit.categoryId);
                    }
                });
            }

            if (completionCount > maxCount) maxCount = completionCount;

            return {
                date,
                count: completionCount,
                categoryCount: categoryIds.size
            };
        });

        const getIntensity = (count: number) => {
            if (count === 0) return 0;
            if (maxCount <= 4) return Math.min(count, 4);

            const step = maxCount / 4;
            if (count <= step) return 1;
            if (count <= step * 2) return 2;
            if (count <= step * 3) return 3;
            return 4;
        };

        const finalDays = processedDays.map(d => ({
            ...d,
            intensity: getIntensity(d.count)
        }));

        const weeksArray: typeof finalDays[] = [];
        let currentWeek: typeof finalDays = [];

        finalDays.forEach((day) => {
            if (getDay(day.date) === 0 && currentWeek.length > 0) {
                weeksArray.push(currentWeek);
                currentWeek = [];
            }
            currentWeek.push(day);
        });
        if (currentWeek.length > 0) weeksArray.push(currentWeek);

        // Month Labels Logic
        const labels: { text: string; weekIndex: number }[] = [];
        let lastLabelWeekIndex = -10;

        weeksArray.forEach((week, index) => {
            const firstDay = week[0].date;
            const prevWeekFirstDay = index > 0 ? weeksArray[index - 1][0].date : null;
            const isNewMonth = index === 0 || (prevWeekFirstDay && !isSameMonth(firstDay, prevWeekFirstDay));

            if (isNewMonth) {
                if (index - lastLabelWeekIndex > 2) {
                    labels.push({ text: format(firstDay, 'MMM'), weekIndex: index });
                    lastLabelWeekIndex = index;
                }
            }
        });

        return { weeks: weeksArray, monthLabels: labels, maxCount };
    }, [habits, logs]);

    // CSS Grid Refactor
    // We rely on CSS Grid to handle all sizing.
    // Rows: 1 header row (month labels) + 7 day rows
    // Cols: 1 label col + N week cols

    const numWeeks = weeks.length;

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridAutoFlow: 'column',
        gridTemplateRows: 'min-content repeat(7, 1fr)', // Header + 7 days
        gridTemplateColumns: `auto repeat(${numWeeks}, minmax(0, 1fr))`,
        gap: '2px', // Tight gap
        width: '100%'
    };

    return (
        <div className="w-full">
            <div className="w-full" style={gridStyle}>
                {/* Column 0: Day Labels */}
                {/* Header Cell (Empty corner) */}
                <div className="h-6" />

                {/* Day Labels (Sun-Sat) */}
                <div className="text-[10px] text-content-muted font-medium flex items-center justify-end pr-2">S</div>
                <div className="text-[10px] text-content-muted font-medium flex items-center justify-end pr-2">M</div>
                <div className="text-[10px] text-content-muted font-medium flex items-center justify-end pr-2">T</div>
                <div className="text-[10px] text-content-muted font-medium flex items-center justify-end pr-2">W</div>
                <div className="text-[10px] text-content-muted font-medium flex items-center justify-end pr-2">T</div>
                <div className="text-[10px] text-content-muted font-medium flex items-center justify-end pr-2">F</div>
                <div className="text-[10px] text-content-muted font-medium flex items-center justify-end pr-2">S</div>

                {/* Data Columns */}
                {weeks.map((week, wIndex) => {
                    // Check if we need a month label for this column
                    // Only show label if it's in our `monthLabels` list for this index
                    const label = monthLabels.find(l => l.weekIndex === wIndex);

                    return (
                        <React.Fragment key={wIndex}>
                            {/* Row 0: Month Label Slot */}
                            <div className="h-6 relative">
                                {label && (
                                    <span className="absolute bottom-1 left-0 text-[10px] text-content-muted font-medium whitespace-nowrap z-10">
                                        {label.text}
                                    </span>
                                )}
                            </div>

                            {/* Rows 1-7: Days */}
                            {week.map((day) => (
                                <div
                                    key={day.date.toISOString()}
                                    data-tooltip-id="heatmap-tooltip"
                                    data-tooltip-content={`${format(day.date, 'MMM d, yyyy')}: ${day.count} completions across ${day.categoryCount} categories`}
                                    className="aspect-square w-full rounded-sm transition-all hover:ring-1 hover:ring-focus/50"
                                    style={{ background: getHeatmapColor(day.intensity, resolvedMode) }}
                                />
                            ))}
                        </React.Fragment>
                    );
                })}
            </div>

            <div className="mt-4">
                <HeatmapLegend />
            </div>
            <Tooltip
                id="heatmap-tooltip"
                className="z-50 !opacity-100 !rounded-lg !px-3 !py-1 !text-xs"
                style={{ background: themeColors.chartTooltipBg, color: themeColors.contentPrimary, border: `1px solid ${themeColors.lineSubtle}` }}
            />
        </div>
    );
});
