import React, { useMemo } from 'react';
import { parseISO, format, startOfWeek, isSameMonth } from 'date-fns';
import { Calendar, Sun, Moon } from 'lucide-react';
import { getHeatmapColor } from '../../utils/analytics';
import type { HeatmapResponse } from '../../lib/analyticsClient';

interface AnalyticsHeatmapProps {
  data: HeatmapResponse | null;
  loading: boolean;
}

function getIntensity(percent: number): number {
  if (percent <= 0) return 0;
  if (percent < 0.25) return 1;
  if (percent < 0.5) return 2;
  if (percent < 0.75) return 3;
  return 4;
}

export const AnalyticsHeatmap: React.FC<AnalyticsHeatmapProps> = ({ data, loading }) => {
  const grid = useMemo(() => {
    if (!data || data.dataPoints.length === 0) return null;

    const points = data.dataPoints;
    const lookup = new Map(points.map(d => [d.dayKey, d]));

    const endDate = parseISO(points[points.length - 1].dayKey);
    const startDate = startOfWeek(parseISO(points[0].dayKey), { weekStartsOn: 0 });

    const weeks: { dayKey: string; percent: number; intensity: number }[][] = [];
    let current = new Date(startDate);

    while (current <= endDate) {
      const week: { dayKey: string; percent: number; intensity: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const dk = format(current, 'yyyy-MM-dd');
        const point = lookup.get(dk);
        const percent = point?.completionPercent ?? -1;
        week.push({ dayKey: dk, percent, intensity: percent < 0 ? -1 : getIntensity(percent) });
        current = new Date(current);
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }

    // Month labels with minimum gap check (matches dashboard logic)
    const monthLabels: { label: string; weekIndex: number }[] = [];
    let lastLabelWeekIndex = -10;
    weeks.forEach((week, index) => {
      const firstDay = parseISO(week[0].dayKey);
      const prevFirstDay = index > 0 ? parseISO(weeks[index - 1][0].dayKey) : null;
      const isNewMonth = index === 0 || (prevFirstDay && !isSameMonth(firstDay, prevFirstDay));
      if (isNewMonth && index - lastLabelWeekIndex > 2) {
        monthLabels.push({ label: format(firstDay, 'MMM'), weekIndex: index });
        lastLabelWeekIndex = index;
      }
    });

    return { weeks, monthLabels };
  }, [data]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Activity Heatmap</h3>
        <div className="h-32 bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!grid || !data) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Activity Heatmap</h3>
        <p className="text-neutral-500 text-sm">No data available</p>
      </div>
    );
  }

  const insights = data.insights;
  const numWeeks = grid.weeks.length;

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridAutoFlow: 'column',
    gridTemplateRows: 'min-content repeat(7, 1fr)',
    gridTemplateColumns: `auto repeat(${numWeeks}, minmax(0, 1fr))`,
    gap: '2px',
    width: '100%'
  };

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-3">Activity Heatmap</h3>

      <div className="w-full" style={gridStyle}>
        {/* Column 0: Day Labels */}
        <div className="h-6" />
        <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2"></div>
        <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2">Mon</div>
        <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2"></div>
        <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2">Wed</div>
        <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2"></div>
        <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2">Fri</div>
        <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-end pr-2"></div>

        {/* Data Columns */}
        {grid.weeks.map((week, wIndex) => {
          const label = grid.monthLabels.find(l => l.weekIndex === wIndex);
          return (
            <React.Fragment key={wIndex}>
              <div className="h-6 relative">
                {label && (
                  <span className="absolute bottom-1 left-0 text-[10px] text-neutral-500 font-medium whitespace-nowrap z-10">
                    {label.label}
                  </span>
                )}
              </div>
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`aspect-square w-full rounded-sm ${
                    day.intensity < 0 ? 'bg-transparent' : getHeatmapColor(day.intensity)
                  } transition-all hover:ring-1 hover:ring-white/50`}
                  title={day.percent >= 0 ? `${day.dayKey}: ${Math.round(day.percent * 100)}%` : ''}
                />
              ))}
            </React.Fragment>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 text-xs text-neutral-500">
        <span>Low</span>
        <div className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(0)}`} />
          <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(1)}`} />
          <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(2)}`} />
          <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(3)}`} />
          <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(4)}`} />
        </div>
        <span>High</span>
      </div>

      {/* Heatmap Insights */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs">
          <Calendar size={12} className="text-emerald-400 shrink-0" />
          <span className="text-neutral-400">Most active: <span className="text-white font-medium">{insights.mostActiveDay}</span></span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Calendar size={12} className="text-red-400 shrink-0" />
          <span className="text-neutral-400">Least active: <span className="text-white font-medium">{insights.leastActiveDay}</span></span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Calendar size={12} className="text-purple-400 shrink-0" />
          <span className="text-neutral-400">Best month: <span className="text-white font-medium">{insights.mostActiveMonth}</span></span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {insights.weekdayAvgPercent >= insights.weekendAvgPercent ? (
            <>
              <Sun size={12} className="text-blue-400 shrink-0" />
              <span className="text-neutral-400">Stronger on <span className="text-white font-medium">weekdays</span></span>
            </>
          ) : (
            <>
              <Moon size={12} className="text-blue-400 shrink-0" />
              <span className="text-neutral-400">Stronger on <span className="text-white font-medium">weekends</span></span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
