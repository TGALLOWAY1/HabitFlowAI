import React, { useMemo, useState } from 'react';
import { ArrowLeft, Activity, Battery, Target, Brain, Wind } from 'lucide-react';
import type { WellbeingMetricKey } from '../models/persistenceTypes';
import { useWellbeingEntriesRange } from '../hooks/useWellbeingEntriesRange';

type Props = {
  onBack: () => void;
};

type SelectableMetric = Extract<WellbeingMetricKey, 'anxiety' | 'lowMood' | 'calm' | 'energy' | 'stress'>;

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

export const WellbeingHistoryPage: React.FC<Props> = ({ onBack }) => {
  const [windowDays, setWindowDays] = useState<30 | 90 | 180>(90);
  const [metric, setMetric] = useState<SelectableMetric>('anxiety');
  const [hover, setHover] = useState<{ dayKey: string; value: number | null } | null>(null);

  const { loading, error, getDailyAverage, startDayKey, endDayKey } = useWellbeingEntriesRange(windowDays);

  const cells = useMemo(() => {
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

  const weeks = useMemo(() => {
    const rows: Array<typeof cells> = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [cells]);

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
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-neutral-400">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-300">{error}</div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-neutral-500">
                Color shows intensity (0–4). Missing days are neutral.
              </div>
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
              <div className="flex flex-col gap-1 pt-5">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
                  <div key={d} className="h-4 text-[10px] text-neutral-600 flex items-center">
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="flex flex-col gap-1">
                {/* Spacer for alignment */}
                <div className="h-5" />
                <div className="flex flex-col gap-1">
                  {weeks.map((week, i) => (
                    <div key={i} className="flex gap-1">
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
        )}
      </div>
    </div>
  );
};


