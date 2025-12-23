import React, { useState, useEffect, useMemo } from 'react';
import { Battery, Droplet, UtensilsCrossed, Heart, Activity } from 'lucide-react';
import { fetchWellbeingEntries, upsertWellbeingEntries } from '../../../lib/persistenceClient';
import type { WellbeingEntry, WellbeingMetricKey } from '../../../models/persistenceTypes';
import { formatDayKeyFromDate } from '../../../domain/time/dayKey';

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

type ReadinessMetric = {
  key: WellbeingMetricKey;
  label: string;
  icon: React.ReactNode;
};

const READINESS_METRICS: ReadinessMetric[] = [
  { key: 'readiness', label: 'Readiness', icon: <Battery size={16} className="text-emerald-400" /> },
  { key: 'soreness', label: 'Soreness', icon: <Activity size={16} className="text-orange-400" /> },
  { key: 'hydration', label: 'Hydration', icon: <Droplet size={16} className="text-blue-400" /> },
  { key: 'fueling', label: 'Fueling', icon: <UtensilsCrossed size={16} className="text-amber-400" /> },
  { key: 'recovery', label: 'Recovery', icon: <Heart size={16} className="text-pink-400" /> },
];

export const ReadinessSnapshot: React.FC = () => {
  const timeZone = useMemo(() => getTimeZone(), []);
  const todayKey = useMemo(() => formatDayKeyFromDate(new Date(), timeZone), [timeZone]);
  const [values, setValues] = useState<Record<WellbeingMetricKey, number | null>>({
    readiness: null,
    soreness: null,
    hydration: null,
    fueling: null,
    recovery: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load today's values
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchWellbeingEntries({
      startDayKey: todayKey,
      endDayKey: todayKey,
    })
      .then((entries: WellbeingEntry[]) => {
        if (cancelled) return;

        const todayValues: Record<WellbeingMetricKey, number | null> = {
          readiness: null,
          soreness: null,
          hydration: null,
          fueling: null,
          recovery: null,
        };

        // Get the latest value for each metric (prefer morning, fallback to evening, then null)
        for (const metric of READINESS_METRICS) {
          const metricEntries = entries.filter(
            (e) => e.metricKey === metric.key && e.dayKey === todayKey && !e.deletedAt
          );

          if (metricEntries.length > 0) {
            // Prefer morning, then evening, then any
            const morningEntry = metricEntries.find((e) => e.timeOfDay === 'morning');
            const eveningEntry = metricEntries.find((e) => e.timeOfDay === 'evening');
            const entry = morningEntry || eveningEntry || metricEntries[0];

            if (entry && typeof entry.value === 'number') {
              todayValues[metric.key] = entry.value;
            }
          }
        }

        setValues(todayValues);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ReadinessSnapshot] Failed to load entries:', err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  const handleSliderChange = async (metricKey: WellbeingMetricKey, value: number) => {
    const newValues = { ...values, [metricKey]: value };
    setValues(newValues);
    setSaving(true);

    try {
      // Upsert wellbeing entry (morning session for readiness snapshot)
      await upsertWellbeingEntries({
        entries: [
          {
            dayKey: todayKey,
            timeOfDay: 'morning',
            metricKey,
            value,
            source: 'checkin',
            timestampUtc: new Date().toISOString(),
          },
        ],
        defaultTimeZone: timeZone,
      });

      // Trigger refresh event for other components
      window.dispatchEvent(new CustomEvent('habitflow:demo-data-changed'));
    } catch (err) {
      console.error('[ReadinessSnapshot] Failed to save entry:', err);
      // Revert on error
      setValues(values);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6">
        <div className="text-sm text-neutral-400">Loading readiness snapshot...</div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Activity size={18} className="text-emerald-400" />
        Subjective Readiness Snapshot
      </h3>

      <div className="grid grid-cols-5 gap-4">
        {READINESS_METRICS.map((metric) => {
          const currentValue = values[metric.key] ?? 2; // Default to middle (2 on 0-4 scale)

          return (
            <div key={metric.key} className="space-y-2">
              <div className="flex items-center gap-2 justify-center">
                {metric.icon}
                <label className="text-xs text-neutral-300 font-medium text-center">
                  {metric.label}
                </label>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={currentValue}
                onChange={(e) => handleSliderChange(metric.key, Number(e.target.value))}
                disabled={saving}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500/60 hover:accent-emerald-500/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(to right, 
                    rgb(34, 197, 94) 0%, 
                    rgb(34, 197, 94) ${(currentValue / 4) * 100}%, 
                    rgb(38, 38, 38) ${(currentValue / 4) * 100}%, 
                    rgb(38, 38, 38) 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-neutral-500 px-1">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

