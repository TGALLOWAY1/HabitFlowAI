import React from 'react';
import { Target, CheckCircle2, AlertTriangle, TrendingUp, Clock, Zap, Award, XCircle } from 'lucide-react';
import type { GoalAnalyticsSummary, GoalBreakdownItem } from '../../lib/analyticsClient';

interface GoalAnalyticsProps {
  data: GoalAnalyticsSummary | null;
  loading: boolean;
}

const statusConfig: Record<string, { color: string; bg: string; border: string }> = {
  'Completed': { color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/20' },
  'On Track': { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/20' },
  'At Risk': { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/20' },
  'Behind': { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/20' },
  'Not Started': { color: 'text-neutral-400', bg: 'bg-neutral-500/15', border: 'border-white/5' },
};

const statusIcons: Record<string, React.ElementType> = {
  'Completed': Award,
  'On Track': CheckCircle2,
  'At Risk': AlertTriangle,
  'Behind': XCircle,
  'Not Started': Target,
};

function GoalCard({ goal }: { goal: GoalBreakdownItem }) {
  const config = statusConfig[goal.status] ?? statusConfig['Not Started'];
  const StatusIcon = statusIcons[goal.status] ?? Target;
  const progressBarColor = goal.status === 'Completed' ? 'bg-purple-400'
    : goal.status === 'On Track' ? 'bg-emerald-500'
    : goal.status === 'At Risk' ? 'bg-amber-400'
    : goal.status === 'Behind' ? 'bg-red-500'
    : 'bg-neutral-600';

  return (
    <div className={`bg-neutral-900/50 rounded-2xl border ${config.border} p-4 backdrop-blur-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusIcon size={16} className={config.color} />
          <span className="text-sm text-white font-medium truncate">{goal.goalTitle}</span>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ml-2 ${config.bg} ${config.color}`}>
          {goal.status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
          style={{ width: `${goal.progressPercent}%` }}
        />
        {/* Expected progress marker */}
        {goal.timeElapsedPercent != null && goal.timeElapsedPercent > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white/30"
            style={{ left: `${Math.min(100, goal.timeElapsedPercent)}%` }}
            title={`Expected: ${goal.timeElapsedPercent}%`}
          />
        )}
      </div>

      {/* Progress info */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400">
          {goal.currentValue}{goal.unit ? ` ${goal.unit}` : ''}
          {goal.targetValue != null && ` / ${goal.targetValue}`}
        </span>
        <span className="text-white font-medium">{goal.progressPercent}%</span>
      </div>

      {/* Pace info */}
      {!goal.isCompleted && goal.requiredPacePerWeek != null && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Zap size={10} className="text-amber-400" />
            <span className="text-neutral-400">
              Required: <span className="text-white font-medium">{goal.requiredPacePerWeek}{goal.unit ? ` ${goal.unit}` : ''}/week</span>
            </span>
          </div>
          {goal.currentPacePerWeek != null && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <TrendingUp size={10} className="text-blue-400" />
              <span className="text-neutral-400">
                Current: <span className="text-white font-medium">{goal.currentPacePerWeek}{goal.unit ? ` ${goal.unit}` : ''}/week</span>
              </span>
            </div>
          )}
          {goal.estimatedCompletionWeeks != null && goal.estimatedCompletionWeeks > 0 && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Clock size={10} className="text-teal-400" />
              <span className="text-neutral-400">
                Est. <span className="text-white font-medium">
                  {goal.estimatedCompletionWeeks <= 4
                    ? `${goal.estimatedCompletionWeeks} weeks`
                    : `${Math.round(goal.estimatedCompletionWeeks / 4)} months`
                  }
                </span> remaining
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompletedGoalCard({ goal }: { goal: GoalBreakdownItem }) {
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-emerald-500/5 rounded-2xl border border-purple-500/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Award size={16} className="text-purple-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-white font-medium truncate">{goal.goalTitle}</div>
          {goal.completionDate && (
            <div className="text-[10px] text-neutral-400">
              Completed {new Date(goal.completionDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {goal.timeTakenDays != null && (
          <div className="text-center">
            <div className="text-sm font-bold text-white">{goal.timeTakenDays}d</div>
            <div className="text-[9px] text-neutral-500">Time Taken</div>
          </div>
        )}
        {goal.currentValue > 0 && (
          <div className="text-center">
            <div className="text-sm font-bold text-white">{goal.currentValue}</div>
            <div className="text-[9px] text-neutral-500">Total Work</div>
          </div>
        )}
        {goal.avgPerWeek != null && (
          <div className="text-center">
            <div className="text-sm font-bold text-white">{goal.avgPerWeek}</div>
            <div className="text-[9px] text-neutral-500">Avg/Week</div>
          </div>
        )}
      </div>
    </div>
  );
}

export const GoalAnalytics: React.FC<GoalAnalyticsProps> = ({ data, loading }) => {
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
    return <p className="text-neutral-500 text-sm">No goal data available</p>;
  }

  const atRiskGoals = data.goalBreakdown.filter(g => g.status === 'At Risk' || g.status === 'Behind');
  const activeGoals = data.goalBreakdown.filter(g => !g.isCompleted && g.status !== 'At Risk' && g.status !== 'Behind');
  const completedGoals = data.goalBreakdown.filter(g => g.isCompleted);

  return (
    <div className="space-y-4">
      {/* Health Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-neutral-900/50 rounded-2xl border border-emerald-500/20 p-4 backdrop-blur-sm text-center">
          <CheckCircle2 size={16} className="text-emerald-400 mx-auto mb-1" />
          <div className="text-2xl font-bold text-white">{data.goalsOnTrack}</div>
          <div className="text-[10px] text-neutral-400">On Track</div>
        </div>
        <div className="bg-neutral-900/50 rounded-2xl border border-amber-500/20 p-4 backdrop-blur-sm text-center">
          <AlertTriangle size={16} className="text-amber-400 mx-auto mb-1" />
          <div className="text-2xl font-bold text-white">{data.goalsAtRisk}</div>
          <div className="text-[10px] text-neutral-400">At Risk</div>
        </div>
        <div className="bg-neutral-900/50 rounded-2xl border border-purple-500/20 p-4 backdrop-blur-sm text-center">
          <Award size={16} className="text-purple-400 mx-auto mb-1" />
          <div className="text-2xl font-bold text-white">{data.completedGoals}</div>
          <div className="text-[10px] text-neutral-400">Completed</div>
        </div>
        <div className="bg-neutral-900/50 rounded-2xl border border-blue-500/20 p-4 backdrop-blur-sm text-center">
          <TrendingUp size={16} className="text-blue-400 mx-auto mb-1" />
          <div className="text-2xl font-bold text-white">{data.averageProgressPercent}%</div>
          <div className="text-[10px] text-neutral-400">Avg Progress</div>
        </div>
      </div>

      {/* At Risk / Behind Goals — Warning Section */}
      {atRiskGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> Needs Attention
          </h3>
          <div className="space-y-3">
            {atRiskGoals.map(goal => (
              <GoalCard key={goal.goalId} goal={goal} />
            ))}
          </div>
        </div>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-3">Active Goals</h3>
          <div className="space-y-3">
            {activeGoals.map(goal => (
              <GoalCard key={goal.goalId} goal={goal} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Goals — Celebration Section */}
      {completedGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-purple-400 mb-3 flex items-center gap-2">
            <Award size={14} /> Completed Goals
          </h3>
          <div className="space-y-3">
            {completedGoals.map(goal => (
              <CompletedGoalCard key={goal.goalId} goal={goal} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
