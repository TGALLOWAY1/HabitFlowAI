import React from 'react';
import { ClipboardList, Clock, CheckCircle2, BarChart3 } from 'lucide-react';
import type { RoutineAnalyticsSummary } from '../../lib/analyticsClient';

interface RoutineAnalyticsProps {
  data: RoutineAnalyticsSummary | null;
  loading: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `${mins}m`;
}

export const RoutineAnalytics: React.FC<RoutineAnalyticsProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
              <div className="h-12 bg-neutral-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-neutral-500 text-sm">No routine data available</p>;
  }

  const summaryCards = [
    { label: 'Completed', value: `${data.totalCompleted}`, icon: CheckCircle2 },
    { label: 'Reliability', value: `${Math.round(data.reliabilityRate * 100)}%`, icon: BarChart3 },
    { label: 'Avg Duration', value: formatDuration(data.averageDurationSeconds), icon: Clock },
    { label: 'Total Started', value: `${data.totalStarted}`, icon: ClipboardList },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className="text-emerald-400" />
              <span className="text-xs text-neutral-400 font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Per-Routine Breakdown */}
      {data.routineBreakdown.length > 0 && (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-neutral-400 mb-3">Routine Breakdown</h3>
          <div className="space-y-3">
            {data.routineBreakdown.map(routine => (
              <div key={routine.routineId} className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white font-medium">{routine.routineTitle}</div>
                  <div className="text-[10px] text-neutral-500">
                    {routine.completedCount} completed
                    {routine.averageDurationSeconds > 0 && ` · avg ${formatDuration(routine.averageDurationSeconds)}`}
                  </div>
                </div>
                <div className="text-lg font-bold text-emerald-400">{routine.completedCount}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
