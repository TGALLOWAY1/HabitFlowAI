import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Footprints, Moon, Dumbbell, Flame, Scale, Activity, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import { createHealthRule, getHealthRule, deleteHealthRule, triggerBackfill } from '../lib/persistenceClient';
import type { HealthMetricType, HealthRuleOperator, HealthRuleBehavior, HabitHealthRule } from '../models/persistenceTypes';
import { cn } from '../utils/cn';

type Props = {
  onBack: () => void;
};

const METRICS: Array<{
  key: HealthMetricType;
  label: string;
  icon: React.ReactNode;
  defaultName: string;
  defaultThreshold: string;
  unit: string;
}> = [
  { key: 'steps', label: 'Steps', icon: <Footprints size={20} className="text-emerald-400" />, defaultName: 'Daily Steps', defaultThreshold: '10000', unit: 'steps' },
  { key: 'sleep_hours', label: 'Sleep', icon: <Moon size={20} className="text-indigo-400" />, defaultName: 'Sleep Goal', defaultThreshold: '7', unit: 'hours' },
  { key: 'workout_minutes', label: 'Workouts', icon: <Dumbbell size={20} className="text-orange-400" />, defaultName: 'Daily Workout', defaultThreshold: '30', unit: 'minutes' },
  { key: 'active_calories', label: 'Calories', icon: <Flame size={20} className="text-red-400" />, defaultName: 'Active Calories', defaultThreshold: '500', unit: 'cal' },
  { key: 'weight', label: 'Weight', icon: <Scale size={20} className="text-sky-400" />, defaultName: 'Weight Tracking', defaultThreshold: '', unit: 'lbs' },
];

interface ConnectedHabit {
  habitId: string;
  habitName: string;
  rule: HabitHealthRule;
}

export function AppleHealthPage({ onBack }: Props) {
  const { habits, categories, addHabit } = useHabitStore();

  // Expand state for metric cards
  const [expandedMetric, setExpandedMetric] = useState<HealthMetricType | null>(null);

  // Create form state
  const [habitName, setHabitName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [operator, setOperator] = useState<HealthRuleOperator>('>=');
  const [threshold, setThreshold] = useState('');
  const [behavior, setBehavior] = useState<HealthRuleBehavior>('auto_log');
  const [backfillOption, setBackfillOption] = useState<'habit_start' | 'none'>('habit_start');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Connected habits
  const [connectedHabits, setConnectedHabits] = useState<ConnectedHabit[]>([]);
  const [loadingConnected, setLoadingConnected] = useState(true);

  // Load connected habits on mount
  const loadConnectedHabits = useCallback(async () => {
    setLoadingConnected(true);
    const results: ConnectedHabit[] = [];
    const activeHabits = habits.filter(h => !h.archived);

    for (const habit of activeHabits) {
      try {
        const { rule } = await getHealthRule(habit.id);
        if (rule && rule.active) {
          results.push({ habitId: habit.id, habitName: habit.name, rule });
        }
      } catch {
        // No rule for this habit
      }
    }

    setConnectedHabits(results);
    setLoadingConnected(false);
  }, [habits]);

  useEffect(() => {
    loadConnectedHabits();
  }, [loadConnectedHabits]);

  // Set defaults when expanding a metric
  const handleExpandMetric = (metricKey: HealthMetricType) => {
    if (expandedMetric === metricKey) {
      setExpandedMetric(null);
      return;
    }
    const metric = METRICS.find(m => m.key === metricKey)!;
    setExpandedMetric(metricKey);
    setHabitName(metric.defaultName);
    setThreshold(metric.defaultThreshold);
    setOperator('>=');
    setBehavior('auto_log');
    setBackfillOption('habit_start');
    setSubmitMessage(null);
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  };

  const handleCreateHabit = async (metricKey: HealthMetricType) => {
    if (!habitName.trim() || !selectedCategoryId) return;
    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      // Create the habit
      const newHabit = await addHabit({
        name: habitName.trim(),
        categoryId: selectedCategoryId,
        goal: { type: 'boolean', frequency: 'daily' },
        assignedDays: [0, 1, 2, 3, 4, 5, 6],
        requiredDaysPerWeek: 7,
      });

      // Create the health rule
      await createHealthRule(newHabit.id, {
        metricType: metricKey,
        operator,
        thresholdValue: operator === 'exists' ? null : Number(threshold) || null,
        behavior,
      });

      // Trigger backfill if requested
      if (backfillOption === 'habit_start') {
        await triggerBackfill(newHabit.id);
      }

      setSubmitMessage({ type: 'success', text: `Created "${habitName.trim()}" with ${metricKey} tracking` });
      setExpandedMetric(null);
      await loadConnectedHabits();
    } catch (e) {
      console.error('Failed to create health habit:', e);
      setSubmitMessage({ type: 'error', text: 'Failed to create habit. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async (habitId: string) => {
    try {
      await deleteHealthRule(habitId);
      setConnectedHabits(prev => prev.filter(c => c.habitId !== habitId));
    } catch (e) {
      console.error('Failed to disconnect health rule:', e);
    }
  };

  const handleBackfill = async (habitId: string) => {
    try {
      const result = await triggerBackfill(habitId);
      alert(`Backfill complete: ${result.created} entries created, ${result.skipped} skipped.`);
    } catch {
      alert('Backfill failed.');
    }
  };

  const metricLabel = (metricType: HealthMetricType): string => {
    return METRICS.find(m => m.key === metricType)?.label ?? metricType;
  };

  const ruleDescription = (rule: HabitHealthRule): string => {
    if (rule.operator === 'exists') return `any ${metricLabel(rule.metricType)} value`;
    const opLabel = rule.operator === '>=' ? 'at least' : rule.operator === '<=' ? 'at most' : rule.operator === '>' ? 'more than' : 'less than';
    return `${opLabel} ${rule.thresholdValue ?? ''} ${METRICS.find(m => m.key === rule.metricType)?.unit ?? ''}`;
  };

  // Check which metrics already have a connected habit
  const connectedMetrics = new Set(connectedHabits.map(c => c.rule.metricType));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Apple Health</h2>
        </div>
      </div>

      <p className="text-sm text-neutral-400">
        Create habits that automatically track using your Apple Health data. Choose a metric below to get started.
      </p>

      {/* Success/Error Message */}
      {submitMessage && (
        <div className={cn(
          "px-4 py-3 rounded-lg text-sm",
          submitMessage.type === 'success'
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-red-500/10 text-red-400 border border-red-500/20"
        )}>
          {submitMessage.text}
        </div>
      )}

      {/* Available Metrics */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Available Metrics</h3>
        <div className="space-y-2">
          {METRICS.map((metric) => {
            const isConnected = connectedMetrics.has(metric.key);
            const isExpanded = expandedMetric === metric.key;

            return (
              <div key={metric.key} className="rounded-xl border border-white/5 overflow-hidden">
                {/* Metric Card Header */}
                <button
                  type="button"
                  onClick={() => !isConnected && handleExpandMetric(metric.key)}
                  disabled={isConnected}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 text-left transition-colors",
                    isConnected
                      ? "bg-neutral-800/30 opacity-60 cursor-not-allowed"
                      : isExpanded
                        ? "bg-neutral-800/50"
                        : "bg-neutral-800/30 hover:bg-neutral-800/50"
                  )}
                >
                  <div className="flex-shrink-0">{metric.icon}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white">{metric.label}</span>
                    {isConnected && (
                      <span className="ml-2 text-xs text-emerald-400/70">Connected</span>
                    )}
                  </div>
                  {!isConnected && (
                    isExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />
                  )}
                </button>

                {/* Create Habit Form (expanded) */}
                {isExpanded && (
                  <div className="p-4 border-t border-white/5 space-y-4 bg-neutral-900/50 animate-in fade-in">
                    {/* Habit Name */}
                    <div className="space-y-1">
                      <label className="text-xs text-neutral-500">Habit Name</label>
                      <input
                        type="text"
                        value={habitName}
                        onChange={(e) => setHabitName(e.target.value)}
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                        placeholder={metric.defaultName}
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-1">
                      <label className="text-xs text-neutral-500">Category</label>
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Condition */}
                    <div className="flex gap-2">
                      <div className="space-y-1 flex-1">
                        <label className="text-xs text-neutral-500">Condition</label>
                        <select
                          value={operator}
                          onChange={(e) => setOperator(e.target.value as HealthRuleOperator)}
                          className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        >
                          <option value=">=">at least ({">="}) </option>
                          <option value="<=">at most ({"<="})</option>
                          <option value=">">more than ({">"}) </option>
                          <option value="<">less than ({"<"})</option>
                          <option value="exists">any value</option>
                        </select>
                      </div>
                      {operator !== 'exists' && (
                        <div className="space-y-1 w-28">
                          <label className="text-xs text-neutral-500">{metric.unit}</label>
                          <input
                            type="number"
                            value={threshold}
                            onChange={(e) => setThreshold(e.target.value)}
                            placeholder={metric.defaultThreshold}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* Behavior */}
                    <div className="space-y-1">
                      <label className="text-xs text-neutral-500">When condition is met</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBehavior('auto_log')}
                          className={cn(
                            "px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                            behavior === 'auto_log'
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                              : "bg-neutral-800 text-neutral-400 border-white/5"
                          )}
                        >
                          Auto-log
                        </button>
                        <button
                          type="button"
                          onClick={() => setBehavior('suggest')}
                          className={cn(
                            "px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                            behavior === 'suggest'
                              ? "bg-sky-500/20 text-sky-400 border-sky-500/50"
                              : "bg-neutral-800 text-neutral-400 border-white/5"
                          )}
                        >
                          Suggest
                        </button>
                      </div>
                    </div>

                    {/* Backfill */}
                    <div className="space-y-1">
                      <label className="text-xs text-neutral-500">Backfill past data</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBackfillOption('habit_start')}
                          className={cn(
                            "px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                            backfillOption === 'habit_start'
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                              : "bg-neutral-800 text-neutral-400 border-white/5"
                          )}
                        >
                          From start
                        </button>
                        <button
                          type="button"
                          onClick={() => setBackfillOption('none')}
                          className={cn(
                            "px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                            backfillOption === 'none'
                              ? "bg-neutral-700/50 text-neutral-300 border-white/10"
                              : "bg-neutral-800 text-neutral-400 border-white/5"
                          )}
                        >
                          No backfill
                        </button>
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      type="button"
                      onClick={() => handleCreateHabit(metric.key)}
                      disabled={isSubmitting || !habitName.trim() || !selectedCategoryId}
                      className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Habit'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected Habits */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Connected Habits</h3>
        {loadingConnected ? (
          <p className="text-sm text-neutral-500">Loading...</p>
        ) : connectedHabits.length === 0 ? (
          <p className="text-sm text-neutral-500">No habits connected to Apple Health yet.</p>
        ) : (
          <div className="space-y-2">
            {connectedHabits.map((connected) => (
              <div
                key={connected.habitId}
                className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/30 border border-white/5"
              >
                <div className="flex-shrink-0">
                  {METRICS.find(m => m.key === connected.rule.metricType)?.icon ?? <Activity size={20} className="text-neutral-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{connected.habitName}</div>
                  <div className="text-xs text-neutral-500">
                    {ruleDescription(connected.rule)} · {connected.rule.behavior === 'auto_log' ? 'Auto-log' : 'Suggest'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleBackfill(connected.habitId)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-400 hover:bg-white/5 transition-colors"
                    title="Run backfill"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(connected.habitId)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                    title="Disconnect"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
