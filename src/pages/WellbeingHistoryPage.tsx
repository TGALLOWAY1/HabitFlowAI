import React, { useMemo, useState } from 'react';
import { ArrowLeft, Activity, Battery, Target, Brain, Wind } from 'lucide-react';
import type { WellbeingMetricKey } from '../models/persistenceTypes';
import { useWellbeingEntriesRange } from '../hooks/useWellbeingEntriesRange';

type Props = {
  onBack: () => void;
};

type SelectableMetric = Extract<WellbeingMetricKey, 'anxiety' | 'lowMood' | 'calm' | 'energy' | 'stress'>;
type HistoryView = 'heatmap' | 'weekly' | 'multiples';

const METRICS: Array<{ key: SelectableMetric; label: string; icon: React.ReactNode }> = [
  { key: 'anxiety', label: 'Anxiety', icon: <Activity size={14} className="text-purple-400" /> },
  { key: 'lowMood', label: 'Low Mood', icon: <Brain size={14} className="text-blue-400" /> },
  { key: 'calm', label: 'Calm', icon: <Wind size={14} className="text-emerald-400" /> },
  { key: 'energy', label: 'Energy', icon: <Battery size={14} className="text-emerald-400" /> },
  { key: 'stress', label: 'Stress', icon: <Target size={14} className="text-orange-400" /> },
];

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function intensityFromValue(metric: SelectableMetric, value: number): number {
  // Heatmap scale is always 0..4 intensity.
  // Map legacy 1..5 metrics down to 0..4 by subtracting 1.
  if (metric === 'anxiety' || metric === 'energy') {
    return clampInt(value - 1, 0, 4);
  }
  // New subjective superset is already 0..4.
  return clampInt(value, 0, 4);
}

function heatClass(intensity: number | null): string {
  // Missing -> neutral gray
  if (intensity === null) return 'bg-neutral-800/60 border-white/5';
  // 0..4 -> increasing intensity
  switch (intensity) {
    case 0:
      return 'bg-sky-900/20 border-white/5';
    case 1:
      return 'bg-sky-800/30 border-sky-500/10';
    case 2:
      return 'bg-sky-700/40 border-sky-500/15';
    case 3:
      return 'bg-sky-600/55 border-sky-400/20';
    default:
      return 'bg-sky-500/70 border-sky-300/25';
  }
}

function formatWeekLabel(weekStartDayKey: string): string {
  // Render compact label like "Jan 06"
  const d = new Date(`${weekStartDayKey}T00:00:00.000Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

export const WellbeingHistoryPage: React.FC<Props> = ({ onBack }) => {
  const [windowDays, setWindowDays] = useState<30 | 90 | 180>(90);
  const [view, setView] = useState<HistoryView>('heatmap');
  const [metric, setMetric] = useState<SelectableMetric>('anxiety');
  const [hover, setHover] = useState<{ dayKey: string; value: number | null } | null>(null);

  const { loading, error, getDailyAverage, startDayKey, endDayKey } = useWellbeingEntriesRange(windowDays);

  const cellsForMetric = useMemo(() => {
    // Calendar-style grid: 7 columns (Sun..Sat), rows are weeks.
    // We align the start to the previous Sunday to make a clean grid.
    const start = new Date(`${startDayKey}T00:00:00.000Z`);
    const end = new Date(`${endDayKey}T00:00:00.000Z`);

    const startDow = start.getUTCDay(); // 0=Sun
    const gridStart = new Date(start);
    gridStart.setUTCDate(gridStart.getUTCDate() - startDow);

    const days: Array<{ dayKey: string; value: number | null; intensity: number | null }> = [];
    for (let d = new Date(gridStart); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dayKey = d.toISOString().slice(0, 10);
      // only compute values inside requested window (start..end); outside is null/neutral
      const inRange = d >= start && d <= end;
      const raw = inRange ? getDailyAverage(dayKey, metric as any) : null;
      const value = typeof raw === 'number' ? raw : null;
      const intensity = value === null ? null : intensityFromValue(metric, value);
      days.push({ dayKey, value, intensity });
    }
    return days;
  }, [startDayKey, endDayKey, getDailyAverage, metric]);

  const weeksForMetric = useMemo(() => {
    const rows: Array<Array<{ dayKey: string; value: number | null; intensity: number | null }>> = [];
    for (let i = 0; i < cellsForMetric.length; i += 7) {
      rows.push(cellsForMetric.slice(i, i + 7));
    }
    return rows;
  }, [cellsForMetric]);

  const weeklySummary = useMemo(() => {
    // Each week is a stacked band of calm/anxiety/lowMood (relative proportions).
    // Uses 0..4 intensities (anxiety mapped down from 1..5).
    const start = new Date(`${startDayKey}T00:00:00.000Z`);
    const end = new Date(`${endDayKey}T00:00:00.000Z`);

    // Align to Monday for week bands (Mon-based)
    const startDow = start.getUTCDay(); // Sun=0
    const diffToMonday = (startDow + 6) % 7;
    const weekStart = new Date(start);
    weekStart.setUTCDate(weekStart.getUTCDate() - diffToMonday);

    const rows: Array<{
      weekStartDayKey: string;
      calm: number;
      anxiety: number;
      lowMood: number;
      total: number;
      calmPct: number;
      anxietyPct: number;
      lowMoodPct: number;
    }> = [];

    for (let w = new Date(weekStart); w <= end; w.setUTCDate(w.getUTCDate() + 7)) {
      const weekStartDayKey = w.toISOString().slice(0, 10);
      let calmSum = 0;
      let anxietySum = 0;
      let lowMoodSum = 0;

      for (let i = 0; i < 7; i++) {
        const d = new Date(w);
        d.setUTCDate(w.getUTCDate() + i);
        if (d < start || d > end) continue;
        const dayKey = d.toISOString().slice(0, 10);

        const calmRaw = getDailyAverage(dayKey, 'calm' as any);
        const anxietyRaw = getDailyAverage(dayKey, 'anxiety' as any);
        const lowMoodRaw = getDailyAverage(dayKey, 'lowMood' as any);

        if (typeof calmRaw === 'number') calmSum += intensityFromValue('calm', calmRaw);
        if (typeof anxietyRaw === 'number') anxietySum += intensityFromValue('anxiety', anxietyRaw);
        if (typeof lowMoodRaw === 'number') lowMoodSum += intensityFromValue('lowMood', lowMoodRaw);
      }

      const total = calmSum + anxietySum + lowMoodSum;
      rows.push({
        weekStartDayKey,
        calm: calmSum,
        anxiety: anxietySum,
        lowMood: lowMoodSum,
        total,
        calmPct: total === 0 ? 0 : calmSum / total,
        anxietyPct: total === 0 ? 0 : anxietySum / total,
        lowMoodPct: total === 0 ? 0 : lowMoodSum / total,
      });
    }

    return rows.slice(-Math.ceil(windowDays / 7) - 1);
  }, [startDayKey, endDayKey, getDailyAverage, windowDays]);

  const miniHeatmaps = useMemo(() => {
    // One mini heatmap per metric (no combined lines).
    return METRICS.map((m) => {
      const start = new Date(`${startDayKey}T00:00:00.000Z`);
      const end = new Date(`${endDayKey}T00:00:00.000Z`);
      const startDow = start.getUTCDay();
      const gridStart = new Date(start);
      gridStart.setUTCDate(gridStart.getUTCDate() - startDow);

      const days: Array<{ dayKey: string; value: number | null; intensity: number | null }> = [];
      for (let d = new Date(gridStart); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dayKey = d.toISOString().slice(0, 10);
        const inRange = d >= start && d <= end;
        const raw = inRange ? getDailyAverage(dayKey, m.key as any) : null;
        const value = typeof raw === 'number' ? raw : null;
        const intensity = value === null ? null : intensityFromValue(m.key, value);
        days.push({ dayKey, value, intensity });
      }

      const weeks: Array<typeof days> = [];
      for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

      return { metric: m, weeks };
    });
  }, [startDayKey, endDayKey, getDailyAverage]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-white/5 text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex bg-neutral-800 rounded-md p-0.5 border border-white/5">
          {([30, 90, 180] as const).map((d) => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                windowDays === d ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Wellbeing History</h2>
            <div className="text-xs text-neutral-500 mt-1">
              Universal view (persona-agnostic). Powered by <code className="text-neutral-400">/api/wellbeingEntries</code>.
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex bg-neutral-800 rounded-md p-0.5 border border-white/5 mr-2">
              {(['heatmap', 'weekly', 'multiples'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                    view === v ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {v === 'heatmap' ? 'Heat Map' : v === 'weekly' ? 'Weekly Summary' : 'Small Multiples'}
                </button>
              ))}
            </div>

            {view === 'heatmap' && (
              <>
                <div className="text-[11px] text-neutral-500 font-semibold mr-2">Metric:</div>
                {METRICS.map((m) => {
                  const active = metric === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setMetric(m.key)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        active ? 'bg-white/10 text-white border-white/20' : 'bg-neutral-800/60 text-neutral-300 border-white/10 hover:text-white'
                      }`}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-neutral-400">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-300">{error}</div>
        ) : (
          <>
            {view === 'heatmap' ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-neutral-500">Color shows intensity (0–4). Missing days are neutral.</div>
                  {hover ? (
                    <div className="text-xs text-neutral-300">
                      <span className="text-neutral-500 mr-2">{hover.dayKey}</span>
                      <span className="font-semibold text-white">{hover.value === null ? '—' : hover.value}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500">Hover a day to see details</div>
                  )}
                </div>

                <div className="inline-flex gap-3">
                  {/* Day labels */}
                  <div className="flex flex-col gap-1">
                    <div className="h-5" />
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                      <div key={`${d}-${idx}`} className="h-4 text-[10px] text-neutral-600 flex items-center">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Grid */}
                  <div className="flex flex-col gap-1">
                    <div className="h-5" />
                    {/* weeks as columns (horizontal), days stacked vertically */}
                    <div className="flex gap-1 overflow-x-auto">
                      {weeksForMetric.map((week, i) => (
                        <div key={week[0]?.dayKey ?? i} className="flex flex-col gap-1">
                          {week.map((cell) => (
                            <button
                              key={cell.dayKey}
                              type="button"
                              className={`w-4 h-4 rounded border ${heatClass(cell.intensity)} hover:border-white/20 transition-colors`}
                              onMouseEnter={() => setHover({ dayKey: cell.dayKey, value: cell.value })}
                              onMouseLeave={() => setHover(null)}
                              title={`${cell.dayKey}: ${cell.value === null ? '—' : cell.value}`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : view === 'weekly' ? (
              <div className="space-y-3">
                <div className="text-xs text-neutral-500">
                  Each week is a simple mix of <span className="text-emerald-300">Calm</span>,{' '}
                  <span className="text-purple-300">Anxiety</span>, and <span className="text-sky-300">Low Mood</span>.
                </div>
                <div className="space-y-2">
                  {weeklySummary.map((w) => {
                    const calmW = `${Math.round(w.calmPct * 100)}%`;
                    const anxietyW = `${Math.round(w.anxietyPct * 100)}%`;
                    const lowMoodW = `${Math.round(w.lowMoodPct * 100)}%`;
                    const title = `${w.weekStartDayKey}: Calm ${calmW}, Anxiety ${anxietyW}, Low Mood ${lowMoodW}`;
                    return (
                      <div key={w.weekStartDayKey} className="flex items-center gap-3">
                        <div className="w-14 text-[11px] text-neutral-500">{formatWeekLabel(w.weekStartDayKey)}</div>
                        <div className="flex-1 h-3 rounded-full overflow-hidden border border-white/5 bg-neutral-800/60" title={title}>
                          <div className="h-full flex">
                            <div className="h-full bg-emerald-400/70" style={{ width: `${w.calmPct * 100}%` }} />
                            <div className="h-full bg-purple-400/70" style={{ width: `${w.anxietyPct * 100}%` }} />
                            <div className="h-full bg-sky-400/70" style={{ width: `${w.lowMoodPct * 100}%` }} />
                          </div>
                        </div>
                        <div className="hidden md:flex items-center gap-3 text-[11px] text-neutral-500">
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400/70" /> Calm</span>
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400/70" /> Anxiety</span>
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400/70" /> Low Mood</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {miniHeatmaps.map(({ metric: m, weeks }) => (
                  <div key={m.key} className="p-4 rounded-xl bg-neutral-900/40 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                        {m.icon}
                        {m.label}
                      </div>
                      <div className="text-[11px] text-neutral-500">{windowDays}d</div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex flex-col gap-1 pt-5">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                          <div key={`${d}-${idx}`} className="h-3 text-[9px] text-neutral-700 flex items-center">
                            {d}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="h-5" />
                        {/* weeks as columns (horizontal), days stacked vertically */}
                        <div className="flex gap-1 overflow-x-auto">
                          {weeks.map((week, i) => (
                            <div key={week[0]?.dayKey ?? i} className="flex flex-col gap-1">
                              {week.map((cell) => (
                                <div
                                  key={cell.dayKey}
                                  className={`w-3 h-3 rounded border ${heatClass(cell.intensity)} border-white/5`}
                                  title={`${cell.dayKey}: ${cell.value === null ? '—' : cell.value}`}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};


