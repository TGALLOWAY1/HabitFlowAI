import React from 'react';

interface MiniHeatmapProps {
    data: Array<{
        date: string;
        value: number;
        hasProgress: boolean;
    }>;
    goalType: 'cumulative' | 'frequency';
    targetValue: number;
}

export const MiniHeatmap: React.FC<MiniHeatmapProps> = ({ data }) => {
    // We want to display exactly 4 rows (weeks) x 7 columns (days)
    // using the last 28 days of data.
    // Data comes in "most recent first" order from the backend usually, but let's sort to be safe if needed,
    // or assume chronological if we reversed it elsewhere. 
    // Wait, the data usually comes most recent first in 'lastThirtyDays', so index 0 is today.

    // Let's grab the last 28 days (0 to 27) and REVERSE them so index 0 is 28 days ago (top left)
    // and index 27 is today (bottom right).

    const relevantData = data.slice(0, 28).reverse();

    // Map data to a grid of 4 weeks
    // If we have less than 28 days of data (e.g. new goal), we pad with empty days at the start?
    // Or just show what we have. 
    // Ideally we want a fixed 28-cell grid.

    const paddedData = [...relevantData];
    while (paddedData.length < 28) {
        paddedData.unshift({ date: `empty-${paddedData.length}`, value: 0, hasProgress: false });
    }

    return (
        <div className="flex flex-col gap-1 w-full">
            {/* 7 cols grid (4 rows implied by 28 items) */}
            <div className="grid grid-cols-7 gap-1 w-full relative">
                {paddedData.map((day) => {
                    // Default to visible "empty" slot for ALL cells, including padding
                    let bgClass = "bg-white/5";

                    if (day.hasProgress) {
                        bgClass = "bg-emerald-500";
                    }
                    // REMOVED: explicit check making 'empty' dates transparent. 
                    // We want them visible as placeholders.

                    // Simple formatting for the native title tooltip
                    // If it's a real date, format it nicely
                    let tooltipText = "";
                    if (!String(day.date).startsWith('empty')) {
                        // Use basic toLocaleDateString for now to avoid date-fns import if we want to keep it simple
                        // Or just use the raw string if it is YYYY-MM-DD
                        tooltipText = `${day.date}: ${day.value}`;
                    }

                    return (
                        <div
                            key={day.date}
                            className={`w-full aspect-square rounded-[1px] ${bgClass} relative group/cell`}
                            title={tooltipText}
                        >
                            {/* Custom CSS Tooltip on hover */}
                            {!String(day.date).startsWith('empty') && (
                                <div className="hidden group-hover/cell:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-neutral-900 border border-white/10 text-[10px] text-white rounded whitespace-nowrap z-10 pointer-events-none shadow-xl">
                                    {day.date} • {day.value}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
