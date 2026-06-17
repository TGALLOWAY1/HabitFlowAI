import React from 'react';
import type { SleepAnalyticsSummary } from '../../../lib/analyticsClient';
import { formatDurationMinutes } from './sleepFormat';

interface Props {
  data: SleepAnalyticsSummary | null;
  loading: boolean;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold text-white leading-tight">{value}</div>
      <div className="text-[10px] text-neutral-400 mt-0.5">{label}</div>
    </div>
  );
}

export const SleepWeeklySummary: React.FC<Props> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Weekly Sleep Summary</h3>
        <div className="h-20 bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }
  if (!data) return null;

  const weeks = [...data.weeklySummary].reverse(); // most recent first

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-3">Weekly Sleep Summary</h3>
      {weeks.length === 0 ? (
        <p className="text-neutral-500 text-sm">No nights logged yet.</p>
      ) : (
        <div className="space-y-3">
          {weeks.map((w) => (
            <div key={w.weekLabel} className="bg-neutral-800/40 rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 mb-2">{w.weekLabel}</div>
              <div className="grid grid-cols-3 gap-y-3">
                <Cell label="Avg duration" value={formatDurationMinutes(w.avgDurationMinutes)} />
                <Cell label="Avg latency" value={w.avgLatencyMinutes !== null ? `${w.avgLatencyMinutes}m` : '—'} />
                <Cell label="On target" value={`${w.nightsOnTarget}`} />
                <Cell label="Awakenings" value={w.avgAwakenings !== null ? `${w.avgAwakenings}` : '—'} />
                <Cell label="Aid-free" value={`${w.sleepAidFreeNights}`} />
                <Cell label="Morning energy" value={w.avgMorningEnergy !== null ? `${w.avgMorningEnergy}` : '—'} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
