import React, { useMemo, useState } from 'react';
import { ArrowLeft, Brain, Activity, Battery, Moon, Target, Crosshair, Heart, Wind } from 'lucide-react';
import type { WellbeingMetricKey } from '../models/persistenceTypes';
import { useWellbeingEntriesRange } from '../hooks/useWellbeingEntriesRange';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

type Props = {
  onBack: () => void;
};

const METRICS: Array<{ key: WellbeingMetricKey; label: string; color: string; icon: React.ReactNode }> = [
  { key: 'anxiety', label: 'Anxiety', color: '#a855f7', icon: <Activity size={14} className="text-purple-400" /> },
  { key: 'lowMood', label: 'Low Mood', color: '#60a5fa', icon: <Brain size={14} className="text-blue-400" /> },
  { key: 'calm', label: 'Calm', color: '#34d399', icon: <Wind size={14} className="text-emerald-400" /> },
  { key: 'energy', label: 'Energy', color: '#10b981', icon: <Battery size={14} className="text-emerald-400" /> },
  { key: 'stress', label: 'Stress', color: '#f97316', icon: <Target size={14} className="text-orange-400" /> },
  { key: 'focus', label: 'Focus', color: '#fbbf24', icon: <Crosshair size={14} className="text-amber-300" /> },
  { key: 'sleepQuality', label: 'Sleep quality (subjective)', color: '#c084fc', icon: <Heart size={14} className="text-fuchsia-300" /> },
  // Legacy/optional
  { key: 'sleepScore', label: 'Sleep score', color: '#818cf8', icon: <Moon size={14} className="text-indigo-400" /> },
  { key: 'depression', label: 'Depression (legacy)', color: '#3b82f6', icon: <Brain size={14} className="text-blue-400" /> },
];

export const WellbeingHistoryPage: React.FC<Props> = ({ onBack }) => {
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(14);
  const [activeMetrics, setActiveMetrics] = useState<WellbeingMetricKey[]>(['anxiety', 'lowMood', 'calm', 'energy']);

  const { loading, error, getDailyAverage, startDayKey, endDayKey } = useWellbeingEntriesRange(windowDays);

  const data = useMemo(() => {
    // Build contiguous dayKey rows using the already-derived dayKeys from the hook range.
    // We use dayKey strings on x-axis for simplicity.
    const rows: any[] = [];
    const start = new Date(`${startDayKey}T00:00:00.000Z`);
    const end = new Date(`${endDayKey}T00:00:00.000Z`);

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dayKey = d.toISOString().slice(0, 10);
      const row: any = { dayKey };
      for (const m of activeMetrics) {
        row[m] = getDailyAverage(dayKey, m);
      }
      rows.push(row);
    }
    return rows;
  }, [activeMetrics, getDailyAverage, startDayKey, endDayKey]);

  const toggleMetric = (key: WellbeingMetricKey) => {
    setActiveMetrics((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const yDomain = useMemo(() => {
    if (activeMetrics.includes('sleepScore')) return [0, 100] as const;
    // Legacy 1-5 metrics
    if (activeMetrics.some((m) => m === 'depression' || m === 'anxiety' || m === 'energy')) return [0, 5] as const;
    // New subjective superset 0-4
    return [0, 4] as const;
  }, [activeMetrics]);

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
          {([7, 14, 30] as const).map((d) => (
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

          <div className="flex flex-wrap gap-2">
            {METRICS.map((m) => {
              const active = activeMetrics.includes(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
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
        ) : activeMetrics.length === 0 ? (
          <div className="text-sm text-neutral-400">Select at least one metric.</div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <XAxis dataKey="dayKey" tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  domain={yDomain as any}
                  tick={{ fill: '#a3a3a3', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Legend />
                {METRICS.filter((m) => activeMetrics.includes(m.key)).map((m) => (
                  <Line key={m.key} name={m.label} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};


