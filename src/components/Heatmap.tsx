import React, { useMemo } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { eachDayOfInterval, subDays, format, getDay, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { Tooltip } from 'react-tooltip';

export const Heatmap: React.FC = () => {
    const { habits, logs } = useHabitStore();

    const { weeks, monthLabels } = useMemo(() => {
        const today = new Date();
        const endDate = endOfWeek(today);
        const startDate = startOfWeek(subDays(endDate, 364));

        const days = eachDayOfInterval({ start: startDate, end: endDate });

        const processedDays = days.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const activeHabits = habits.filter(h => new Date(h.createdAt) <= date && !h.archived);

            let completedCount = 0;
            if (activeHabits.length > 0) {
                activeHabits.forEach(habit => {
                    const log = logs[`${habit.id}-${dateStr}`];
                    if (log?.completed) completedCount++;
                });
            }

            return {
                date,
                percentage: activeHabits.length > 0 ? completedCount / activeHabits.length : 0
            };
        });

        const weeksArray: typeof processedDays[] = [];
        let currentWeek: typeof processedDays = [];

        processedDays.forEach((day) => {
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
            // Check if month changed
            const prevWeekFirstDay = index > 0 ? weeksArray[index - 1][0].date : null;
            const isNewMonth = index === 0 || (prevWeekFirstDay && !isSameMonth(firstDay, prevWeekFirstDay));

            if (isNewMonth) {
                // Ensure enough space (at least 2 weeks / ~32px)
                if (index - lastLabelWeekIndex > 2) {
                    labels.push({ text: format(firstDay, 'MMM'), weekIndex: index });
                    lastLabelWeekIndex = index;
                }
            }
        });

        return { weeks: weeksArray, monthLabels: labels };
    }, [habits, logs]);

    const getColor = (percentage: number) => {
        if (percentage === 0) return 'bg-neutral-800/50';
        if (percentage <= 0.25) return 'bg-emerald-900/80';
        if (percentage <= 0.50) return 'bg-emerald-700';
        if (percentage <= 0.75) return 'bg-emerald-500';
        return 'bg-emerald-400';
    };

    return (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm overflow-x-auto">
            <h3 className="text-xl font-bold text-white mb-6">Activity Heatmap</h3>

            <div className="flex gap-2">
                {/* Left Column: Day Labels */}
                {/* pt-6 to align with the grid which is pushed down by month labels (h-4 + mb-2) */}
                <div className="flex flex-col gap-1 pt-6 text-xs text-neutral-500 font-medium pb-1">
                    <div className="h-3 w-6" /> {/* Sun */}
                    <div className="h-3 w-6 flex items-center">Mon</div>
                    <div className="h-3 w-6" /> {/* Tue */}
                    <div className="h-3 w-6 flex items-center">Wed</div>
                    <div className="h-3 w-6" /> {/* Thu */}
                    <div className="h-3 w-6 flex items-center">Fri</div>
                    <div className="h-3 w-6" /> {/* Sat */}
                </div>

                <div className="flex flex-col">
                    {/* Top Row: Month Labels */}
                    <div className="relative h-4 mb-2 w-full">
                        {monthLabels.map((label, i) => (
                            <span
                                key={i}
                                className="absolute text-xs text-neutral-500 font-medium whitespace-nowrap"
                                style={{ left: `${label.weekIndex * 16}px` }} // 12px width + 4px gap = 16px per week
                            >
                                {label.text}
                            </span>
                        ))}
                    </div>

                    {/* The Grid */}
                    <div className="flex gap-1">
                        {weeks.map((week, wIndex) => (
                            <div key={wIndex} className="flex flex-col gap-1">
                                {week.map((day) => (
                                    <div
                                        key={day.date.toISOString()}
                                        data-tooltip-id="heatmap-tooltip"
                                        data-tooltip-content={`${format(day.date, 'MMM d, yyyy')}: ${Math.round(day.percentage * 100)}% completed`}
                                        className={`w-3 h-3 rounded-sm ${getColor(day.percentage)} transition-colors hover:border hover:border-white/50`}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-4 text-xs text-neutral-500 justify-end">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-neutral-800/50" />
                <div className="w-3 h-3 rounded-sm bg-emerald-900/80" />
                <div className="w-3 h-3 rounded-sm bg-emerald-700" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                <span>More</span>
            </div>
            <Tooltip id="heatmap-tooltip" className="z-50 !bg-neutral-800 !text-white !opacity-100 !rounded-lg !px-3 !py-1 !text-xs" />
        </div>
    );
};
