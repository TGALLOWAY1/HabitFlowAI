import React from 'react';

interface MiniHeatmapProps {
    data: Array<{
        date: string;
        value: number;
        hasProgress: boolean;
    }>;
    goalType: 'cumulative';
    targetValue: number;
}

export const MiniHeatmap: React.FC<MiniHeatmapProps> = ({ data }) => {
    // Data comes most recent first. Keep that order so today is top-left.
    const allData = data.slice(0, 28);

    // Group into weeks of 7 (week 0 = most recent)
    const weeks: (typeof allData)[] = [];
    for (let i = 0; i < allData.length; i += 7) {
        weeks.push(allData.slice(i, i + 7));
    }

    // Show consecutive weeks with progress (from most recent), up to 4.
    // Always show at least 1 week.
    let weekCount = 0;
    for (let i = 0; i < weeks.length && i < 4; i++) {
        if (weeks[i].some(d => d.hasProgress)) {
            weekCount = i + 1;
        } else {
            break;
        }
    }
    weekCount = Math.max(weekCount, 1);

    // Build display data from selected weeks
    const displayData = allData.slice(0, weekCount * 7);

    // Pad last row if data doesn't fill it
    while (displayData.length % 7 !== 0) {
        displayData.push({ date: `empty-${displayData.length}`, value: 0, hasProgress: false });
    }

    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="grid grid-cols-7 gap-1 w-full relative">
                {displayData.map((day, idx) => {
                    let bgClass = "bg-surface-1";
                    if (day.hasProgress) {
                        bgClass = "bg-emerald-500";
                    }

                    const isToday = idx === 0 && !String(day.date).startsWith('empty');

                    let tooltipText = "";
                    if (!String(day.date).startsWith('empty')) {
                        tooltipText = `${day.date}: ${day.value}`;
                    }

                    return (
                        <div
                            key={day.date}
                            className={`w-full aspect-square rounded-[1px] ${bgClass} relative group/cell ${
                                isToday ? 'ring-1.5 ring-white/50 rounded-sm' : ''
                            }`}
                            title={tooltipText}
                        >
                            {!String(day.date).startsWith('empty') && (
                                <div className="hidden group-hover/cell:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-surface-0 border border-line-subtle text-[10px] text-content-primary rounded whitespace-nowrap z-10 pointer-events-none shadow-xl">
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
