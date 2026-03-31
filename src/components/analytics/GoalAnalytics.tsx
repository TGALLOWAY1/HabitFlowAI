import React from 'react';
import { Target, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import type { GoalAnalyticsSummary } from '../../lib/analyticsClient';

interface GoalAnalyticsProps {
  data: GoalAnalyticsSummary | null;
  loading: boolean;
}

export const GoalAnalytics: React.FC<GoalAnalyticsProps> = ({ data, loading }) => {
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
    return <p className="text-neutral-500 text-sm">No goal data available</p>;
  }

  const summaryCards = [
    { label: 'Active Goals', value: `${data.activeGoals}`, icon: Target },
    { label: 'Completed', value: `${data.completedGoals}`, icon: CheckCircle2 },
    { label: 'Avg Progress', value: `${data.averageProgressPercent}%`, icon: TrendingUp },
    { label: 'At Risk', value: `${data.goalsAtRisk}`, icon: AlertTriangle },
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

      {/* Goal Breakdown */}
      {data.goalBreakdown.length > 0 && (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-neutral-400 mb-3">Goal Progress</h3>
          <div className="space-y-3">
            {data.goalBreakdown.map(goal => (
              <div key={goal.goalId}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{goal.goalTitle}</span>
                    {goal.isCompleted && (
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    )}
                    {goal.isAtRisk && (
                      <AlertTriangle size={12} className="text-amber-400" />
                    )}
                  </div>
                  <span className="text-xs text-neutral-400">{goal.progressPercent}%</span>
                </div>
                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      goal.isCompleted
                        ? 'bg-emerald-400'
                        : goal.isAtRisk
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${goal.progressPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
