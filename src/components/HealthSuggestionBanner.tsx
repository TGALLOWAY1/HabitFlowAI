import { useState, useEffect, useCallback } from 'react';
import { Activity, Check, X } from 'lucide-react';
import { getHealthSuggestions, acceptSuggestion, dismissSuggestion, isHealthFeatureEnabled } from '../lib/persistenceClient';
import { useAuth } from '../store/AuthContext';
import { useHabitStore } from '../store/HabitContext';
import type { HealthSuggestion } from '../models/persistenceTypes';

const METRIC_LABELS: Record<string, string> = {
  steps: 'steps',
  sleep_hours: 'hrs sleep',
  workout_minutes: 'min workout',
  active_calories: 'cal burned',
  weight: 'lbs',
};

export function HealthSuggestionBanner() {
  const { user } = useAuth();
  const { habits, refreshDayLogs } = useHabitStore();
  const [suggestions, setSuggestions] = useState<HealthSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const enabled = isHealthFeatureEnabled(user?.email);

  const loadSuggestions = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const { suggestions: data } = await getHealthSuggestions();
      setSuggestions(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleAccept = async (id: string) => {
    try {
      await acceptSuggestion(id);
      setSuggestions(prev => prev.filter(s => s.id !== id));
      refreshDayLogs?.();
    } catch {
      // silent
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissSuggestion(id);
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch {
      // silent
    }
  };

  if (!enabled || loading || suggestions.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-3">
      {suggestions.map(s => {
        const habit = habits.find(h => h.id === s.habitId);
        const label = METRIC_LABELS[s.metricType] || s.metricType;
        return (
          <div
            key={s.id}
            className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-2"
          >
            <Activity size={14} className="flex-shrink-0 text-sky-400" />
            <span className="flex-1 text-xs text-sky-200 truncate">
              <span className="font-medium">{habit?.name || 'Habit'}</span>
              {' — '}
              {s.metricValue.toLocaleString()} {label}
            </span>
            <button
              onClick={() => handleAccept(s.id)}
              className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
              title="Accept"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => handleDismiss(s.id)}
              className="p-1 rounded-md bg-neutral-700/50 text-neutral-400 hover:bg-neutral-700 transition-colors"
              title="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
