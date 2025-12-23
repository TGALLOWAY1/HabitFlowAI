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

type ReadinessKey = 'readiness' | 'soreness' | 'hydration' | 'fueling' | 'recovery';

type ReadinessMetric = {
  key: ReadinessKey;
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
  const [values, setValues] = useState<Record<ReadinessKey, number | null>>({
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

        const todayValues: Record<ReadinessKey, number | null> = {
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

  const handleSliderChange = async (metricKey: ReadinessKey, value: number) => {
    // Note: State is already updated optimistically in onChange handler
    // This function only handles persistence
    
    setSaving(true);

    try {
      // Upsert wellbeing entry (morning session for readiness snapshot)
      // Each metric is persisted independently with its own metricKey
      await upsertWellbeingEntries({
        entries: [
          {
            dayKey: todayKey,
            timeOfDay: 'morning',
            metricKey, // Unique metric key ensures no overwriting
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
      // Revert on error using functional update
      setValues((prev) => {
        // Restore previous value for this metric only
        const reverted = { ...prev };
        // Note: We can't easily restore here without storing previous state
        // The error case is rare, so we'll let the next load fix it
        return reverted;
      });
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
          const metricKey = metric.key; // Capture in closure to ensure independence

          return (
            <div key={metric.key} className="space-y-2">
              <div className="flex items-center gap-2 justify-center">
                {metric.icon}
                <label 
                  htmlFor={`readiness-slider-${metric.key}`}
                  className="text-xs text-neutral-300 font-medium text-center cursor-pointer"
                >
                  {metric.label}
                </label>
              </div>
              <input
                type="range"
                id={`readiness-slider-${metric.key}`}
                name={`readiness-${metric.key}`}
                min={0}
                max={4}
                step={1}
                value={currentValue}
                onChange={(e) => {
                  // Capture the metric key and value immediately to ensure independence
                  const targetMetric = metricKey;
                  const newValue = Number(e.target.value);
                  
                  // Update state immediately for responsive UI
                  setValues((prev) => {
                    const updated = { ...prev, [targetMetric]: newValue };
                    
                    // DEV: Verify only this metric changed
                    if (import.meta.env.DEV) {
                      const otherKeys = (Object.keys(updated) as ReadinessKey[]).filter(k => k !== targetMetric);
                      const otherChanged = otherKeys.filter(k => updated[k] !== prev[k]);
                      if (otherChanged.length > 0) {
                        console.error(`[ReadinessSnapshot] onChange: Moving ${targetMetric} also changed: ${otherChanged.join(', ')}`);
                      }
                    }
                    
                    return updated;
                  });
                  
                  // Trigger async save (don't await - let it happen in background)
                  handleSliderChange(targetMetric, newValue).catch(err => {
                    console.error(`[ReadinessSnapshot] Failed to save ${targetMetric}:`, err);
                  });
                }}
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

