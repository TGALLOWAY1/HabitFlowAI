import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { fetchMainDashboard } from '../lib/persistenceClient';
import type {
  DashboardCadenceFilter,
  MainDashboardResponse,
} from '../types/mainDashboard';

interface MainDashboardPageProps {
  className?: string;
}

function getCurrentMonthKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function formatTooltipDay(dayKey: string): string {
  const [year, month, day] = dayKey.split('-');
  return `${month}/${day}/${year}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function SummaryRing({
  title,
  completed,
  goal,
  percent,
  accent,
}: {
  title: string;
  completed: number;
  goal: number;
  percent: number;
  accent: string;
}): React.ReactElement {
  const radius = 54;
  const stroke = 11;
  const safePercent = Math.max(0, Math.min(100, percent));
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safePercent / 100) * circumference;

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-400">{title}</div>
      <div className="mt-3 flex items-center gap-4">
        <svg width="138" height="138" viewBox="0 0 138 138" className="shrink-0">
          <circle
            cx="69"
            cy="69"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <circle
            cx="69"
            cy="69"
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 69 69)"
          />
          <text x="69" y="66" textAnchor="middle" className="fill-white" fontSize="26" fontWeight="700">
            {Math.round(safePercent)}%
          </text>
          <text x="69" y="84" textAnchor="middle" className="fill-neutral-400" fontSize="11">
            completion
          </text>
        </svg>

        <div className="space-y-2 text-sm">
          <div className="text-neutral-400">Completed</div>
          <div className="text-2xl font-semibold text-white tabular-nums">{completed}</div>
          <div className="text-neutral-400">Goal</div>
          <div className="text-lg font-medium text-neutral-200 tabular-nums">{goal}</div>
        </div>
      </div>
    </div>
  );
}

export function MainDashboardPage({ className }: MainDashboardPageProps): React.ReactElement {
  const [month, setMonth] = useState<string>(getCurrentMonthKey());
  const [categoryId, setCategoryId] = useState<string>('all');
  const [cadence, setCadence] = useState<DashboardCadenceFilter>('all');
  const [includeWeekly, setIncludeWeekly] = useState<boolean>(true);
  const [metricMode, setMetricMode] = useState<'count' | 'percent'>('count');

  const [data, setData] = useState<MainDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const timeZone = useMemo(() => {
    if (typeof Intl === 'undefined') return 'UTC';
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchMainDashboard({
          month,
          categoryId: categoryId === 'all' ? undefined : categoryId,
          cadence,
          includeWeekly,
          timeZone,
        });

        if (cancelled) return;
        setData(response);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load dashboard';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [month, categoryId, cadence, includeWeekly, timeZone]);

  const dailyChartData = useMemo(() => {
    if (!data) return [];

    return data.days.map(dayKey => ({
      dayKey,
      count: data.dailyCounts[dayKey] || 0,
      percent: data.dailyPercent[dayKey] || 0,
    }));
  }, [data]);

  const categoryChartData = useMemo(() => {
    if (!data) return [];

    return data.categoryRollup.map(row => ({
      name: row.categoryName,
      completed: row.completed,
      percent: row.percent,
    }));
  }, [data]);

  const monthly = data?.monthlySummary;
  const weekly = data?.weeklySummary;

  return (
    <div className={className ? `${className} space-y-6` : 'space-y-6'}>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-cyan-300/80">Analytics</div>
            <h3 className="mt-1 text-2xl font-bold text-white">Main Dashboard</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Read-only insights derived from HabitEntry + DayKey for {formatMonthLabel(month)}.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-neutral-400">Month</span>
              <input
                type="month"
                value={month}
                onChange={event => setMonth(event.target.value)}
                className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-neutral-400">Category</span>
              <select
                value={categoryId}
                onChange={event => setCategoryId(event.target.value)}
                className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70"
              >
                <option value="all">All categories</option>
                {data?.categoryOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-neutral-400">Cadence</span>
              <div className="flex rounded-lg border border-white/10 bg-neutral-900 p-0.5">
                {(['all', 'daily', 'weekly'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCadence(option)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition ${
                      cadence === option
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-neutral-400">Metric</span>
              <div className="flex rounded-lg border border-white/10 bg-neutral-900 p-0.5">
                {(['count', 'percent'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMetricMode(option)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition ${
                      metricMode === option
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {cadence === 'all' && (
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 xl:col-span-2">
                <input
                  type="checkbox"
                  checked={includeWeekly}
                  onChange={event => setIncludeWeekly(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-neutral-800 text-cyan-400"
                />
                Include weekly habits
              </label>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-neutral-900/60 py-16 text-neutral-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading dashboard
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Unable to load dashboard
          </div>
          <div className="mt-1 text-sm text-rose-100/90">{error}</div>
        </div>
      )}

      {!loading && !error && data && monthly && weekly && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SummaryRing
              title="Completed vs Goal (Month)"
              completed={monthly.completed}
              goal={monthly.goal}
              percent={monthly.percent}
              accent="#22d3ee"
            />
            <SummaryRing
              title="Week Progress"
              completed={weekly.completed}
              goal={weekly.goal}
              percent={weekly.percent}
              accent="#34d399"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Daily Trend</h4>
                <p className="text-xs text-neutral-500">
                  {metricMode === 'count'
                    ? 'Completed habits per day'
                    : 'Daily completion percent (selected habits)'}
                </p>
              </div>
              <div className="text-xs text-neutral-500">{formatMonthLabel(data.month)}</div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="dayKey"
                    tick={{ fill: '#a3a3a3', fontSize: 10 }}
                    tickFormatter={(value: string) => value.slice(8)}
                  />
                  <YAxis
                    tick={{ fill: '#a3a3a3', fontSize: 10 }}
                    domain={metricMode === 'percent' ? [0, 100] : [0, 'auto']}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{
                      background: '#0a0a0a',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => {
                      if (metricMode === 'percent') return [`${Number(value).toFixed(1)}%`, 'Completion'];
                      return [value, 'Completed'];
                    }}
                    labelFormatter={label => formatTooltipDay(String(label))}
                  />
                  <Bar
                    dataKey={metricMode === 'percent' ? 'percent' : 'count'}
                    fill={metricMode === 'percent' ? '#38bdf8' : '#34d399'}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Habit x Day Heatmap</h4>
              <p className="text-xs text-neutral-500">Rows are habits; columns are DayKeys in the selected month.</p>
            </div>

            <div className="overflow-auto rounded-xl border border-white/10">
              <table className="min-w-[980px] w-full border-collapse text-xs">
                <thead className="bg-neutral-950/90 sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 z-20 bg-neutral-950 px-3 py-2 text-left text-neutral-300">Habit</th>
                    {data.days.map(dayKey => (
                      <th key={dayKey} className="px-2 py-2 text-neutral-400 font-medium">
                        {dayKey.slice(8)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.heatmap.habits.map(habit => (
                    <tr key={habit.habitId} className="border-t border-white/5">
                      <td className="sticky left-0 z-10 bg-neutral-950/95 px-3 py-2">
                        <div className="font-medium text-neutral-100">{habit.habitName}</div>
                        <div className="mt-0.5 text-[10px] text-neutral-500">
                          {habit.categoryName} · {habit.cadence}
                        </div>
                      </td>
                      {data.days.map(dayKey => {
                        const complete = habit.dayCompletion[dayKey];
                        return (
                          <td key={`${habit.habitId}-${dayKey}`} className="px-1 py-1">
                            <div
                              className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md border ${
                                complete
                                  ? 'border-emerald-300/40 bg-emerald-500/70 text-white'
                                  : 'border-white/10 bg-neutral-800/60 text-transparent'
                              }`}
                              title={`${habit.habitName} on ${dayKey}: ${complete ? 'complete/activity' : 'no completion/activity'}`}
                            >
                              <Check size={12} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4">
            <div className="mb-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Category Rollup</h4>
              <p className="text-xs text-neutral-500">
                {metricMode === 'count' ? 'Monthly completed opportunities by category.' : 'Monthly completion percent by category.'}
              </p>
            </div>

            {categoryChartData.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-neutral-950/70 px-4 py-8 text-center text-sm text-neutral-500">
                No category data for current filters.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryChartData}
                    layout="vertical"
                    margin={{ top: 8, right: 10, left: 10, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      type="number"
                      tick={{ fill: '#a3a3a3', fontSize: 11 }}
                      domain={metricMode === 'percent' ? [0, 100] : [0, 'auto']}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fill: '#d4d4d4', fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{
                        background: '#0a0a0a',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => {
                        if (metricMode === 'percent') return [`${Number(value).toFixed(1)}%`, 'Completion'];
                        return [value, 'Completed'];
                      }}
                    />
                    <Bar
                      dataKey={metricMode === 'percent' ? 'percent' : 'completed'}
                      fill={metricMode === 'percent' ? '#38bdf8' : '#22c55e'}
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
