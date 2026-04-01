import React from 'react';
import { ClipboardList, Clock, CheckCircle2, BarChart3, TrendingUp, Lightbulb, AlertTriangle, Trophy } from 'lucide-react';
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

const effectivenessColors: Record<string, string> = {
  'Very High': 'bg-emerald-500/15 text-emerald-400',
  'High': 'bg-blue-500/15 text-blue-400',
  'Medium': 'bg-neutral-500/15 text-neutral-400',
  'Low': 'bg-red-500/15 text-red-400',
};

const insightIcons = {
  info: Lightbulb,
  success: Trophy,
  warning: AlertTriangle,
};

const insightColors = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
};

export const RoutineAnalytics: React.FC<RoutineAnalyticsProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
              <div className="h-14 bg-neutral-800 rounded animate-pulse" />
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
    { label: 'Completed', value: `${data.totalCompleted}`, icon: CheckCircle2, color: 'border-emerald-500/20', iconColor: 'text-emerald-400' },
    { label: 'Reliability', value: `${Math.round(data.reliabilityRate * 100)}%`, icon: BarChart3, color: 'border-blue-500/20', iconColor: 'text-blue-400' },
    { label: 'Avg Duration', value: formatDuration(data.averageDurationSeconds), icon: Clock, color: 'border-white/5', iconColor: 'text-teal-400' },
    { label: 'Total Started', value: `${data.totalStarted}`, icon: ClipboardList, color: 'border-white/5', iconColor: 'text-teal-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color, iconColor }) => (
          <div key={label} className={`bg-neutral-900/50 rounded-2xl border ${color} p-4 backdrop-blur-sm`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg bg-neutral-800/80 flex items-center justify-center`}>
                <Icon size={14} className={iconColor} />
              </div>
              <span className="text-xs text-neutral-400 font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Routine Effectiveness Section */}
      {data.effectiveness.length > 0 && (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-neutral-400 mb-4">Routine Effectiveness</h3>
          <div className="space-y-4">
            {data.effectiveness.map(item => {
              const rateWith = Math.round(item.habitCompletionRateWithRoutine * 100);
              const rateWithout = Math.round(item.habitCompletionRateWithoutRoutine * 100);
              const delta = rateWith - rateWithout;
              const effectStyle = effectivenessColors[item.effectivenessLevel] ?? effectivenessColors['Medium'];

              return (
                <div key={item.routineId} className="bg-neutral-800/40 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-emerald-400" />
                      <span className="text-sm text-white font-medium">{item.routineTitle}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${effectStyle}`}>
                      {item.effectivenessLevel}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-white">{item.timesUsed}</div>
                      <div className="text-[10px] text-neutral-500">Times Used</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-emerald-400">{rateWith}%</div>
                      <div className="text-[10px] text-neutral-500">With Routine</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-neutral-400">{rateWithout}%</div>
                      <div className="text-[10px] text-neutral-500">Without</div>
                    </div>
                  </div>

                  {/* Effectiveness bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-1">
                      <span>Habit completion impact</span>
                      <span className={delta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {delta > 0 ? '+' : ''}{delta}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          delta > 0 ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, rateWith))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Routine Insights */}
      {data.routineInsights.length > 0 && (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-neutral-400 mb-3">Routine Insights</h3>
          <div className="space-y-2">
            {data.routineInsights.map((insight, i) => {
              const Icon = insightIcons[insight.type];
              const color = insightColors[insight.type];
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-xl">
                  <Icon size={14} className={`${color} shrink-0 mt-0.5`} />
                  <span className="text-xs text-neutral-200">{insight.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Routine Duration Breakdown */}
      {data.routineBreakdown.length > 0 && (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-neutral-400 mb-3">Routine Breakdown</h3>
          <div className="space-y-3">
            {data.routineBreakdown.map(routine => {
              const completionRate = routine.timesStarted > 0
                ? Math.round((routine.completedCount / routine.timesStarted) * 100) : 0;
              return (
                <div key={routine.routineId} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-medium truncate">{routine.routineTitle}</div>
                    <div className="text-[10px] text-neutral-500">
                      {routine.completedCount}/{routine.timesStarted} completed ({completionRate}%)
                      {routine.averageDurationSeconds > 0 && ` · avg ${formatDuration(routine.averageDurationSeconds)}`}
                    </div>
                  </div>
                  {routine.averageDurationSeconds > 0 && (
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-sm font-bold text-white">{formatDuration(routine.averageDurationSeconds)}</div>
                      <div className="text-[10px] text-neutral-500">avg time</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
