import React, { useMemo } from 'react';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, subWeeks } from 'date-fns';

interface GoalWeeklySummaryProps {
    entries: Array<{
        date: string;
        value: number;
    }>;
    unit?: string;
}

export const GoalWeeklySummary: React.FC<GoalWeeklySummaryProps> = ({ entries, unit = '' }) => {
    const weeklyData = useMemo(() => {
        // Generate last 4 weeks
        const weeks = [];
        const today = new Date();

        for (let i = 0; i < 4; i++) {
            const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 }); // Monday start
            const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });

            const weekEntries = entries.filter(entry => {
                const entryDate = parseISO(entry.date);
                return isWithinInterval(entryDate, { start: weekStart, end: weekEnd });
            });

            const total = weekEntries.reduce((sum, entry) => sum + entry.value, 0);

            weeks.push({
                label: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${format(weekStart, 'MMM d')}`,
                value: total,
                isCurrentWeek: i === 0
            });
        }
        return weeks; // Recent first
    }, [entries]);

    // Find max value for bar scaling
    const maxValue = Math.max(...weeklyData.map(w => w.value), 1);

    return (
        <div className="mt-6 space-y-3">
            <h3 className="text-neutral-400 text-xs font-medium uppercase tracking-wider">Weekly Contribution</h3>
            <div className="space-y-2">
                {weeklyData.map((week, index) => (
                    <div key={index} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-neutral-500 font-medium text-right shrink-0">
                            {week.label}
                        </div>
                        <div className="flex-1 h-6 bg-neutral-800/50 rounded-md overflow-hidden flex items-center p-0.5">
                            <div
                                className={`h-full rounded-sm transition-all duration-500 ${week.isCurrentWeek ? 'bg-emerald-500/80' : 'bg-neutral-600/50'}`}
                                style={{ width: `${(week.value / maxValue) * 100}%`, minWidth: week.value > 0 ? '4px' : '0' }}
                            />
                        </div>
                        <div className="w-16 text-xs text-neutral-300 font-medium shrink-0">
                            {Number.isInteger(week.value) ? week.value : week.value.toFixed(1)} {unit}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
