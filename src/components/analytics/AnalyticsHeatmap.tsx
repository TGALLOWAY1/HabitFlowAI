import React, { useMemo } from 'react';
import { parseISO, format, subDays, startOfWeek } from 'date-fns';
import type { HeatmapDataPoint } from '../../lib/analyticsClient';

interface AnalyticsHeatmapProps {
  data: HeatmapDataPoint[] | null;
  loading: boolean;
}

function getHeatmapColor(percent: number): string {
  if (percent === 0) return 'bg-neutral-800/50';
  if (percent < 0.25) return 'bg-emerald-900/80';
  if (percent < 0.5) return 'bg-emerald-700';
  if (percent < 0.75) return 'bg-emerald-500';
  return 'bg-emerald-400';
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const AnalyticsHeatmap: React.FC<AnalyticsHeatmapProps> = ({ data, loading }) => {
  const grid = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Build a lookup map
    const lookup = new Map(data.map(d => [d.dayKey, d]));

    // Build weeks grid (columns = weeks, rows = days of week)
    const endDate = parseISO(data[data.length - 1].dayKey);
    const startDate = startOfWeek(parseISO(data[0].dayKey), { weekStartsOn: 0 });

    const weeks: { dayKey: string; percent: number }[][] = [];
    let current = new Date(startDate);

    while (current <= endDate) {
      const week: { dayKey: string; percent: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const dk = format(current, 'yyyy-MM-dd');
        const point = lookup.get(dk);
        week.push({ dayKey: dk, percent: point?.completionPercent ?? -1 });
        current = new Date(current);
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }

    // Month labels
    const monthLabels: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      const firstDay = parseISO(week[0].dayKey);
      const month = firstDay.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ label: MONTH_LABELS[month], weekIndex: i });
        lastMonth = month;
      }
    });

    return { weeks, monthLabels };
  }, [data]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Activity Heatmap</h3>
        <div className="h-28 bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!grid) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Activity Heatmap</h3>
        <p className="text-neutral-500 text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-3">Activity Heatmap</h3>

      {/* Month labels */}
      <div className="flex gap-[2px] mb-1 ml-8">
        {grid.monthLabels.map((m, i) => (
          <div
            key={i}
            className="text-[10px] text-neutral-500"
            style={{ marginLeft: i === 0 ? 0 : `${(m.weekIndex - (grid.monthLabels[i - 1]?.weekIndex ?? 0) - 1) * 13}px` }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex gap-[2px] overflow-x-auto">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] mr-1 shrink-0">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="w-5 h-[11px] text-[9px] text-neutral-500 flex items-center">
              {i % 2 === 1 ? d : ''}
            </div>
          ))}
        </div>

        {grid.weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[2px]">
            {week.map((day, di) => (
              <div
                key={di}
                className={`w-[11px] h-[11px] rounded-[2px] ${
                  day.percent < 0 ? 'bg-transparent' : getHeatmapColor(day.percent)
                }`}
                title={day.percent >= 0 ? `${day.dayKey}: ${Math.round(day.percent * 100)}%` : ''}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-3 text-[10px] text-neutral-500">
        <span>Less</span>
        <div className="w-[11px] h-[11px] rounded-[2px] bg-neutral-800/50" />
        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-900/80" />
        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-700" />
        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-500" />
        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-400" />
        <span>More</span>
      </div>
    </div>
  );
};
