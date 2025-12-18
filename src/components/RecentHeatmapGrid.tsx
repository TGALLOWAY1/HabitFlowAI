import React, { useMemo, useRef } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { getHeatmapColor } from '../utils/analytics';
import { eachDayOfInterval, subDays, format, startOfDay } from 'date-fns';
import { Tooltip } from 'react-tooltip';
import { HeatmapLegend } from './HeatmapLegend';

interface RecentHeatmapGridProps {
    habits: any[];
    range: '90d' | '30d';
}

export const RecentHeatmapGrid: React.FC<RecentHeatmapGridProps> = React.memo(({ habits, range }) => {
    const { logs } = useHabitStore();
    const containerRef = useRef<HTMLDivElement>(null);
    // const [containerWidth, setContainerWidth] = useState(0);

    const { days } = useMemo(() => {
        const today = startOfDay(new Date());
        // For recent view, we might want to end on today or yesterday? Usually today.

        let startDate: Date;
        if (range === '30d') {
            startDate = subDays(today, 29); // 30 days total (0-29)
        } else {
            startDate = subDays(today, 89); // 90 days total (0-89)
        }

        const dateInterval = eachDayOfInterval({ start: startDate, end: today });

        // Calculate max daily count for normalization
        let maxDailyCount = 0;

        const processedDays = dateInterval.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const activeHabits = habits.filter(h => new Date(h.createdAt) <= date && !h.archived);

            let completionCount = 0;
            const categoryIds = new Set<string>();

            if (activeHabits.length > 0) {
                activeHabits.forEach(habit => {
                    const log = logs[`${habit.id}-${dateStr}`];
                    if (log?.completed) {
                        completionCount++;
                        categoryIds.add(habit.categoryId);
                    }
                });
            }

            if (completionCount > maxDailyCount) maxDailyCount = completionCount;

            return {
                date,
                count: completionCount,
                categoryCount: categoryIds.size
            };
        });

        // Compute intensity locally for this range
        const getIntensity = (count: number) => {
            if (count === 0) return 0;
            if (maxDailyCount <= 4) return Math.min(count, 4);

            const step = maxDailyCount / 4;
            if (count <= step) return 1;
            if (count <= step * 2) return 2;
            if (count <= step * 3) return 3;
            return 4;
        };

        const finalDays = processedDays.map(d => ({
            ...d,
            intensity: getIntensity(d.count)
        }));

        return { days: finalDays };
    }, [habits, logs, range]);

    // Responsive Logic - Currently relying on CSS Grid auto-size
    /*
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);
    */

    // Layout Calculations
    const GAP = 3; // minimal gap

    // If cells are at min size (8px) and still don't fit 30 cols, 
    // it means container is very narrow (< (30*8 + 29*3) = ~327px).
    // In that case, we might switch to fewer columns or just let grid handle it?
    // User specifically asked "rows of 30". So we should enforce 30 if possible.
    // If we use grid-template-columns with `repeat(30, 1fr)`, it forces 30.

    const gridStyle = {
        gridTemplateColumns: `repeat(30, minmax(0, 1fr))`,
        gap: `${GAP}px`
    };

    const cellSizeClasses = "aspect-square w-full rounded-sm";

    return (
        <div className="w-full" ref={containerRef}>
            <div className="grid" style={gridStyle}>
                {days.map((day) => (
                    <div
                        key={day.date.toISOString()}
                        data-tooltip-id="recent-heatmap-tooltip"
                        data-tooltip-content={`${format(day.date, 'MMM d, yyyy')}: ${day.count} completions across ${day.categoryCount} categories`}
                        className={`${cellSizeClasses} ${getHeatmapColor(day.intensity)} transition-all hover:scale-105 hover:ring-2 hover:ring-white/20`}
                    />
                ))}
            </div>

            <HeatmapLegend />

            <Tooltip id="recent-heatmap-tooltip" className="z-50 !bg-neutral-800 !text-white !opacity-100 !rounded-lg !px-3 !py-1 !text-xs" />
        </div>
    );
});
