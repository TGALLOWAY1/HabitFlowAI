import React from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Flame, Loader2, RefreshCw } from 'lucide-react';
import { useDashboardStreaks } from '../lib/useDashboardStreaks';

function formatDayLabel(dayKey: string): string {
  return format(parseISO(dayKey), 'EEE');
}

function formatShortDate(dayKey: string): string {
  return format(parseISO(dayKey), 'MM/dd');
}

export const StreakDashboardV1: React.FC = () => {
  const { data, loading, error, refresh } = useDashboardStreaks();

  return (
    <div className="space-y-6 overflow-y-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Streak Dashboard v1</h3>
          <p className="text-sm text-neutral-400">
            Entry-derived streaks, risk signals, and weekly consistency.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors border border-white/10"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-8 flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-400" size={20} />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-200">
          {error.message}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-neutral-900/50 rounded-xl border border-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-400">Today</p>
              <p className="text-lg font-semibold text-white">{data.todayStrip.todayDayKey}</p>
            </div>
            <div className="bg-neutral-900/50 rounded-xl border border-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-400">Total Habits</p>
              <p className="text-2xl font-bold text-white">{data.todayStrip.totalHabits}</p>
            </div>
            <div className="bg-neutral-900/50 rounded-xl border border-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-400">Completed Today</p>
              <p className="text-2xl font-bold text-emerald-300">{data.todayStrip.completedToday}</p>
            </div>
            <div className="bg-neutral-900/50 rounded-xl border border-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-400">At Risk</p>
              <p className="text-2xl font-bold text-amber-300">{data.todayStrip.atRiskCount}</p>
            </div>
            <div className="bg-neutral-900/50 rounded-xl border border-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-400">Weekly Satisfied</p>
              <p className="text-2xl font-bold text-cyan-300">{data.todayStrip.completedWeekly}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-300 mb-3">
                Top Streaks
              </h4>
              <div className="space-y-2">
                {data.topStreaks.length === 0 && (
                  <p className="text-sm text-neutral-500">No streaks yet.</p>
                )}
                {data.topStreaks.map(item => (
                  <div key={item.habitId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
                    <div>
                      <p className="text-sm font-medium text-white">{item.habitName}</p>
                      <p className="text-xs text-neutral-400">
                        best {item.bestStreak} • last {item.lastCompletedDayKey ?? 'n/a'}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                      <Flame size={14} />
                      {item.currentStreak}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-300 mb-3">
                At-Risk Streaks
              </h4>
              <div className="space-y-2">
                {data.atRiskHabits.length === 0 && (
                  <p className="text-sm text-neutral-500">No at-risk streaks.</p>
                )}
                {data.atRiskHabits.map(item => (
                  <div key={item.habitId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
                    <div>
                      <p className="text-sm font-medium text-white">{item.habitName}</p>
                      <p className="text-xs text-neutral-400">
                        streak {item.currentStreak}
                        {typeof item.weekProgress === 'number' && typeof item.weekTarget === 'number'
                          ? ` • week ${item.weekProgress}/${item.weekTarget}`
                          : ''}
                      </p>
                    </div>
                    <AlertTriangle size={14} className="text-amber-300" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-300 mb-4">
              7-Day Completion Heatmap
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-neutral-500 font-medium pb-2 pr-4">Habit</th>
                    {data.heatmap.dayKeys.map(dayKey => (
                      <th key={dayKey} className="text-center text-neutral-500 font-medium pb-2 px-1">
                        <div>{formatDayLabel(dayKey)}</div>
                        <div className="text-[10px]">{formatShortDate(dayKey)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.heatmap.habits.map(habit => (
                    <tr key={habit.habitId} className="border-t border-white/5">
                      <td className="py-2 pr-4 text-neutral-200 whitespace-nowrap">{habit.habitName}</td>
                      {habit.cells.map(cell => (
                        <td key={`${habit.habitId}-${cell.dayKey}`} className="text-center px-1 py-2">
                          <div
                            className={`mx-auto h-5 w-5 rounded ${cell.completed ? 'bg-emerald-400/80' : 'bg-neutral-700'}`}
                            title={`${habit.habitName} • ${cell.dayKey} • ${cell.completed ? 'complete' : 'missed'}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-300 mb-4">
              Weekly Progress
            </h4>
            <div className="space-y-3">
              {data.weeklyProgress.length === 0 && (
                <p className="text-sm text-neutral-500">No weekly habits configured.</p>
              )}
              {data.weeklyProgress.map(item => {
                const percent = item.target > 0 ? Math.min(100, Math.round((item.current / item.target) * 100)) : 0;
                return (
                  <div key={item.habitId}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-white">{item.habitName}</span>
                      <span className="text-neutral-400">{item.current}/{item.target}</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${item.satisfied ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

