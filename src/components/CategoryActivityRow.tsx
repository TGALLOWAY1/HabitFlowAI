import React, { useMemo } from 'react';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { useHabitStore } from '../store/HabitContext';
import { getHeatmapColor } from '../utils/analytics';
import { Tooltip } from 'react-tooltip';
import { ChevronRight } from 'lucide-react';

interface CategoryActivityRowProps {
    category: any;
    habits: any[];
    range: '7d' | '14d';
    onClick: () => void;
}

export const CategoryActivityRow: React.FC<CategoryActivityRowProps> = React.memo(({ category, habits, range, onClick }) => {
    const { logs } = useHabitStore();

    const { days, totalActivities } = useMemo(() => {
        const today = startOfDay(new Date());
        let daysToSubtract = 13; // default 14d (0-13)
        if (range === '7d') daysToSubtract = 6;

        const startDate = subDays(today, daysToSubtract);
        const dateRange = eachDayOfInterval({ start: startDate, end: today });

        let rangeTotal = 0;

        // Calculate max daily activites across this specific category and range to normalize intensity LOCALLY or GLOBALLY?
        // User asked for "consistent intensity scale across categories".
        // This implies we should probably use a fixed scale or a global max passed in.
        // For simplicity and effectiveness in small multiples, a fixed scale is often best:
        // 0, 1, 2, 3, 4+ activities.

        const processedDays = dateRange.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            let dailyCount = 0;

            habits.forEach(habit => {
                const log = logs[`${habit.id}-${dateStr}`];
                if (log?.completed) dailyCount++;
            });

            rangeTotal += dailyCount;

            // Simple fixed intensity buckets for now:
            // 0 -> 0
            // 1 -> 1
            // 2 -> 2
            // 3 -> 3
            // 4+ -> 4
            const intensity = Math.min(dailyCount, 4);

            return {
                date,
                count: dailyCount,
                intensity
            };
        });

        return { days: processedDays, totalActivities: rangeTotal };
    }, [habits, logs, range]);

    // Color helper for category text
    const colorMap: Record<string, string> = {
        'bg-emerald-500': 'text-emerald-500',
        'bg-violet-500': 'text-violet-500',
        'bg-rose-500': 'text-rose-500',
        'bg-amber-500': 'text-amber-500',
        'bg-blue-500': 'text-blue-500',
        'bg-fuchsia-500': 'text-fuchsia-500',
        'bg-cyan-500': 'text-cyan-500',
        'bg-green-500': 'text-green-500',
        'bg-purple-500': 'text-purple-500',
    };
    const textColorClass = colorMap[category.color] || 'text-white';

    return (
        <button
            onClick={onClick}
            className="w-full group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900/30 border border-white/5 hover:bg-neutral-800/50 hover:border-emerald-500/30 transition-all duration-200"
        >
            <div className="flex items-center gap-3">
                <div className={`w-1 h-8 rounded-full ${category.color} opacity-80`} />
                <div className="text-left">
                    <h4 className={`font-bold text-sm ${textColorClass} group-hover:text-white transition-colors`}>
                        {category.name}
                    </h4>
                    <div className="item-center flex gap-2 text-xs text-neutral-500">
                        <span>{habits.length} habits</span>
                        <span>•</span>
                        <span>{totalActivities} activities</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Mini Heatmap Grid */}
                <div className="flex gap-1">
                    {days.map((day) => (
                        <div
                            key={day.date.toISOString()}
                            data-tooltip-id={`cat-tooltip-${category.id}`}
                            data-tooltip-content={`${format(day.date, 'MMM d')}: ${day.count} activities`}
                            className={`w-3 h-8 rounded-sm ${getHeatmapColor(day.intensity)} transition-all hover:opacity-80`}
                        />
                    ))}
                </div>
                <ChevronRight size={16} className="text-neutral-600 group-hover:text-white transition-colors hidden sm:block" />
            </div>

            <Tooltip id={`cat-tooltip-${category.id}`} className="z-50 !bg-neutral-800 !text-white !opacity-100 !rounded-lg !px-3 !py-1 !text-xs" />
        </button>
    );
});
