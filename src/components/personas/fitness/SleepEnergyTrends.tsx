import React, { useState, useMemo, memo, useRef } from 'react';
import { Moon, Battery } from 'lucide-react';
import { useWellbeingEntriesRange } from '../../../hooks/useWellbeingEntriesRange';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { formatDayKeyFromDate } from '../../../domain/time/dayKey';

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function getDayKeyDaysAgo(daysAgo: number, timeZone: string): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatDayKeyFromDate(d, timeZone);
}

const SleepEnergyTrendsComponent: React.FC = () => {
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(14);
  const { startDayKey, endDayKey, loading, error, getDailyAverage } = useWellbeingEntriesRange(windowDays);
  const timeZone = useMemo(() => getTimeZone(), []);

  // DEV ONLY: Debug log to confirm re-renders
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[SleepEnergyTrends] Render', { windowDays, loading, error });
  }

  // Compute sleep/energy data - only recompute when windowDays changes or when
  // actual sleep/energy values change (not readiness metrics)
  // We compute the values and compare them to previous values to prevent unnecessary updates
  const sleepData = useMemo(() => {
    const rows: Array<{ dayKey: string; value: number | null }> = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const dayKey = getDayKeyDaysAgo(i, timeZone);
      const value = getDailyAverage(dayKey, 'sleepQuality');
      rows.push({ dayKey, value: typeof value === 'number' ? value : null });
    }
    return rows;
  }, [windowDays, timeZone, getDailyAverage]);

  const energyData = useMemo(() => {
    const rows: Array<{ dayKey: string; value: number | null }> = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const dayKey = getDayKeyDaysAgo(i, timeZone);
      const value = getDailyAverage(dayKey, 'energy');
      rows.push({ dayKey, value: typeof value === 'number' ? value : null });
    }
    return rows;
  }, [windowDays, timeZone, getDailyAverage]);

  // Store previous computed values to compare and prevent unnecessary re-renders
  // Only re-render charts if actual sleep/energy values changed, not when readiness entries are added
  const prevSleepDataRef = useRef<Array<{ dayKey: string; value: number | null }>>([]);
  const prevEnergyDataRef = useRef<Array<{ dayKey: string; value: number | null }>>([]);
  
  // Only update if values actually changed (deep comparison of values)
  const stableSleepData = useMemo(() => {
    const prev = prevSleepDataRef.current;
    const current = sleepData;
    
    // Compare values (not references) - only sleep/energy values matter
    if (prev.length !== current.length) {
      prevSleepDataRef.current = current;
      return current;
    }
    
    const valuesChanged = prev.some((p, i) => {
      const c = current[i];
      return p.dayKey !== c.dayKey || p.value !== c.value;
    });
    
    if (valuesChanged) {
      prevSleepDataRef.current = current;
      return current;
    }
    
    // No change - return previous to prevent re-render
    return prev;
  }, [sleepData]);

  const stableEnergyData = useMemo(() => {
    const prev = prevEnergyDataRef.current;
    const current = energyData;
    
    // Compare values (not references) - only sleep/energy values matter
    if (prev.length !== current.length) {
      prevEnergyDataRef.current = current;
      return current;
    }
    
    const valuesChanged = prev.some((p, i) => {
      const c = current[i];
      return p.dayKey !== c.dayKey || p.value !== c.value;
    });
    
    if (valuesChanged) {
      prevEnergyDataRef.current = current;
      return current;
    }
    
    // No change - return previous to prevent re-render
    return prev;
  }, [energyData]);

  const formatDayKey = (dayKey: string): string => {
    const d = new Date(`${dayKey}T00:00:00.000Z`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Sleep & Energy Trends</h3>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value) as 7 | 14 | 30)}
          className="bg-neutral-800 text-xs text-neutral-300 border border-white/5 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      <div className="space-y-6">
        {/* Sleep Quality Trend */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Moon size={14} className="text-indigo-400" />
            <span className="text-sm text-neutral-300 font-medium">Sleep Quality</span>
          </div>
          {loading ? (
            <div className="text-xs text-neutral-400 h-24 flex items-center">Loading…</div>
          ) : error ? (
            <div className="text-xs text-red-300 h-24 flex items-center">{error}</div>
          ) : (
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stableSleepData}>
                  <XAxis
                    dataKey="dayKey"
                    tick={{ fill: '#a3a3a3', fontSize: 9 }}
                    tickFormatter={formatDayKey}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 4]}
                    tick={{ fill: '#a3a3a3', fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#262626',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    labelFormatter={(label) => formatDayKey(label)}
                    formatter={(value: any) => (value !== null ? value.toFixed(1) : 'N/A')}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#818cf8"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Energy Level Trend */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Battery size={14} className="text-emerald-400" />
            <span className="text-sm text-neutral-300 font-medium">Energy Level</span>
          </div>
          {loading ? (
            <div className="text-xs text-neutral-400 h-24 flex items-center">Loading…</div>
          ) : error ? (
            <div className="text-xs text-red-300 h-24 flex items-center">{error}</div>
          ) : (
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stableEnergyData}>
                  <XAxis
                    dataKey="dayKey"
                    tick={{ fill: '#a3a3a3', fontSize: 9 }}
                    tickFormatter={formatDayKey}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[1, 5]}
                    tick={{ fill: '#a3a3a3', fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#262626',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    labelFormatter={(label) => formatDayKey(label)}
                    formatter={(value: any) => (value !== null ? value.toFixed(1) : 'N/A')}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Memoize component to prevent re-renders when parent re-renders
// Only re-renders when internal state/hooks change (windowDays, or sleep/energy data)
// getDailyAverage is now stable via useCallback, so readiness changes won't trigger re-renders
export const SleepEnergyTrends = memo(SleepEnergyTrendsComponent);

