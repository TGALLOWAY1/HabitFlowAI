import React, { useMemo } from 'react';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { useHabitStore } from '../store/HabitContext';
import { getHeatmapColor } from '../utils/analytics';
import { Tooltip } from 'react-tooltip';
import { ChevronRight } from 'lucide-react';
import { resolveTextColorClass } from '../utils/categoryColors';

interface CategoryCompletionRowProps {
    category: any;
    habits: any[];
    range: '7d' | '14d';
    onClick: () => void;
}

export const CategoryCompletionRow: React.FC<CategoryCompletionRowProps> = React.memo(({ category, habits, range, onClick }) => {
    const { logs } = useHabitStore();

    const { days, totalCompletions, gridCols } = useMemo(() => {
        const today = startOfDay(new Date());
        const daysToSubtract = range === '7d' ? 6 : 13;
        const cols = range === '7d' ? 10 : 7;

        const startDate = subDays(today, daysToSubtract);
        const dateRange = eachDayOfInterval({ start: startDate, end: today });

        let rangeTotal = 0;

        // Calculate max daily completions across this specific category and range to normalize intensity LOCALLY or GLOBALLY?
        // User asked for "consistent intensity scale across categories".
        // This implies we should probably use a fixed scale or a global max passed in.
        // For simplicity and effectiveness in small multiples, a fixed scale is often best:
        // 0, 1, 2, 3, 4+ completions.

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

        return { days: processedDays, totalCompletions: rangeTotal, gridCols: cols };
    }, [habits, logs, range]);

    const textColorClass = resolveTextColorClass(category.color);

    return (
        <button
            onClick={onClick}
            className="w-full group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900/30 border border-white/5 hover:bg-neutral-800/50 hover:border-emerald-500/30 transition-all duration-200"
        >
            <div className="flex items-center gap-3 sm:min-w-[160px] sm:flex-shrink-0">
                <div className={`w-1 h-8 rounded-full ${category.color} opacity-80`} />
                <div className="text-left">
                    <h4 className={`font-bold text-sm ${textColorClass} group-hover:text-white transition-colors`}>
                        {category.name}
                    </h4>
                    <div className="item-center flex gap-2 text-xs text-neutral-500">
                        <span>{habits.length} habits</span>
                        <span>•</span>
                        <span>{totalCompletions} completions</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-4">
                <div
                    className="flex-1 min-w-0 grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                >
                    {days.map((day) => (
                        <div
                            key={day.date.toISOString()}
                            data-tooltip-id={`cat-tooltip-${category.id}`}
                            data-tooltip-content={`${format(day.date, 'MMM d')}: ${day.count} completions`}
                            className={`aspect-square w-full rounded-sm ${getHeatmapColor(day.intensity)} transition-all hover:opacity-80`}
                        />
                    ))}
                </div>
                <ChevronRight size={16} className="text-neutral-600 group-hover:text-white transition-colors hidden sm:block flex-shrink-0" />
            </div>

            <Tooltip id={`cat-tooltip-${category.id}`} className="z-50 !bg-neutral-800 !text-white !opacity-100 !rounded-lg !px-3 !py-1 !text-xs" />
        </button>
    );
});
