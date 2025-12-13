import React, { useMemo } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { getHeatmapColor } from '../utils/analytics';
import { eachDayOfInterval, subDays, format, getDay, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { Tooltip } from 'react-tooltip';
import { HeatmapLegend } from './HeatmapLegend';

interface YearHeatmapGridProps {
    habits: any[];
}

export const YearHeatmapGrid: React.FC<YearHeatmapGridProps> = React.memo(({ habits }) => {
    const { logs } = useHabitStore();

    const { weeks, monthLabels } = useMemo(() => {
        const today = new Date();
        const endDate = endOfWeek(today); // Always end at end of current week
        const startDate = startOfWeek(subDays(endDate, 364)); // Default year

        const days = eachDayOfInterval({ start: startDate, end: endDate });

        // First pass: Calculate activity counts and find max
        let maxCount = 0;
        const processedDays = days.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const activeHabits = habits.filter(h => new Date(h.createdAt) <= date && !h.archived);

            let activityCount = 0;
            const categoryIds = new Set<string>();

            if (activeHabits.length > 0) {
                activeHabits.forEach(habit => {
                    const log = logs[`${habit.id}-${dateStr}`];
                    if (log?.completed) {
                        activityCount++;
                        categoryIds.add(habit.categoryId);
                    }
                });
            }

            if (activityCount > maxCount) maxCount = activityCount;

            return {
                date,
                count: activityCount,
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
                <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2"></div> {/* Sun */}
                <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2">Mon</div>
                <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2"></div> {/* Tue */}
                <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2">Wed</div>
                <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2"></div> {/* Thu */}
                <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2">Fri</div>
                <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2"></div> {/* Sat */}

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
                                    <span className="absolute bottom-1 left-0 text-[10px] text-neutral-500 font-medium whitespace-nowrap z-10">
                                        {label.text}
                                    </span>
                                )}
                            </div>

                            {/* Rows 1-7: Days */}
                            {week.map((day) => (
                                <div
                                    key={day.date.toISOString()}
                                    data-tooltip-id="heatmap-tooltip"
                                    data-tooltip-content={`${format(day.date, 'MMM d, yyyy')}: ${day.count} activities across ${day.categoryCount} categories`}
                                    className={`aspect-square w-full rounded-sm ${getHeatmapColor(day.intensity)} transition-all hover:ring-1 hover:ring-white/50`}
                                />
                            ))}
                        </React.Fragment>
                    );
                })}
            </div>

            <div className="mt-4">
                <HeatmapLegend />
            </div>
            <Tooltip id="heatmap-tooltip" className="z-50 !bg-neutral-800 !text-white !opacity-100 !rounded-lg !px-3 !py-1 !text-xs" />
        </div>
    );
});
