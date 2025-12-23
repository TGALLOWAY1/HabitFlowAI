import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Hash, Clock } from 'lucide-react';
import { useHabitStore } from '../../../store/HabitContext';
import { upsertHabitEntry, fetchHabitEntries } from '../../../lib/persistenceClient';
import { formatDayKeyFromDate } from '../../../domain/time/dayKey';
import type { Habit } from '../../../models/persistenceTypes';

interface EntryView {
  habitId: string;
  dayKey: string;
  timestampUtc: string;
  value: number | null;
  unit?: string;
  source: string;
}

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const QuickLog: React.FC = () => {
  const { habits, refreshProgress } = useHabitStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [numericValue, setNumericValue] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentEntries, setRecentEntries] = useState<Array<EntryView & { habitName: string }>>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeHabits = habits.filter((h) => !h.archived);
  const todayKey = formatDayKeyFromDate(new Date(), getTimeZone());
  const timeZone = getTimeZone();

  // Fetch recent entries (from today)
  useEffect(() => {
    const loadRecentEntries = async () => {
      if (activeHabits.length === 0) {
        setRecentEntries([]);
        return;
      }

      setLoadingEntries(true);
      try {
        const allEntries: Array<EntryView & { habitName: string }> = [];
        
        // Fetch entries for all active habits from today
        for (const habit of activeHabits) {
          try {
            const entries = await fetchHabitEntries(habit.id, todayKey, todayKey, timeZone);
            for (const entry of entries) {
              allEntries.push({
                ...entry,
                habitName: habit.name,
              });
            }
          } catch (err) {
            console.error(`[QuickLog] Failed to fetch entries for habit ${habit.id}:`, err);
          }
        }

        // Sort by timestamp (most recent first) and take top 5
        allEntries.sort((a, b) => {
          const timeA = new Date(a.timestampUtc || a.dayKey).getTime();
          const timeB = new Date(b.timestampUtc || b.dayKey).getTime();
          return timeB - timeA;
        });

        setRecentEntries(allEntries.slice(0, 5));
      } catch (err) {
        console.error('[QuickLog] Failed to load recent entries:', err);
      } finally {
        setLoadingEntries(false);
      }
    };

    loadRecentEntries();
    
    // Refresh entries when a new entry is logged
    const handleEntryChange = () => {
      loadRecentEntries();
    };
    window.addEventListener('habitflow:demo-data-changed', handleEntryChange);
    return () => window.removeEventListener('habitflow:demo-data-changed', handleEntryChange);
  }, [activeHabits, todayKey, timeZone]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Auto-focus numeric input when it appears
  useEffect(() => {
    if (selectedHabit && selectedHabit.goal.type === 'number' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedHabit]);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedHabit(null);
    setNumericValue('');
    setSelectedOptionId(null);
  };

  const handleHabitSelect = (habit: Habit) => {
    setSelectedHabit(habit);
    setNumericValue('');
    setSelectedOptionId(null);
  };

  const handleQuickLog = async (habit: Habit) => {
    // Boolean habit - immediate log
    if (habit.goal.type === 'boolean') {
      await logEntry(habit, { value: 1 });
      return;
    }

    // For numeric or choice, need to select first
    setSelectedHabit(habit);
  };

  const handleNumericSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHabit || !numericValue) return;

    const numValue = Number(numericValue);
    if (isNaN(numValue) || numValue <= 0) return;

    await logEntry(selectedHabit, { value: numValue });
  };

  const handleChoiceSelect = async (habit: Habit, optionId: string) => {
    const option = habit.bundleOptions?.find((o) => o.id === optionId);
    if (!option) return;

    const isMetricRequired = option.metricConfig?.mode === 'required';
    if (isMetricRequired) {
      // Need numeric input for this option
      setSelectedOptionId(optionId);
      return;
    }

    // No metric required - log immediately
    await logEntry(habit, {
      bundleOptionId: optionId,
      bundleOptionLabel: option.label,
      value: 1,
    });
  };

  const handleChoiceWithMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHabit || !selectedOptionId || !numericValue) return;

    const option = selectedHabit.bundleOptions?.find((o) => o.id === selectedOptionId);
    if (!option) return;

    const numValue = Number(numericValue);
    if (isNaN(numValue) || numValue <= 0) return;

    await logEntry(selectedHabit, {
      bundleOptionId: selectedOptionId,
      bundleOptionLabel: option.label,
      value: numValue,
      unitSnapshot: option.metricConfig?.unit,
    });
  };

  const logEntry = async (habit: Habit, data: any) => {
    setIsSubmitting(true);
    try {
      await upsertHabitEntry(habit.id, todayKey, {
        ...data,
        source: 'quick',
        timestamp: new Date().toISOString(),
      });

      // Refresh progress to update UI
      refreshProgress();

      // Trigger refresh event (will update recent entries via event listener)
      window.dispatchEvent(new CustomEvent('habitflow:demo-data-changed'));

      // Collapse UI
      handleClose();
    } catch (err) {
      console.error('[QuickLog] Failed to log entry:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="w-full bg-neutral-900/30 rounded-xl border border-white/5 p-3 space-y-2.5">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full text-left group"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 group-hover:text-neutral-300 transition-colors">
            <Plus size={12} className="text-neutral-500 group-hover:text-neutral-400" />
            <span>Log something you did</span>
          </div>
        </button>
        
        {/* Recent entries list (gratitude-jar style) */}
        {recentEntries.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            {recentEntries.map((entry, idx) => {
              const entryTime = entry.timestampUtc ? new Date(entry.timestampUtc) : new Date(entry.dayKey);
              const timeStr = entryTime.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              });
              
              return (
                <div 
                  key={`${entry.habitId}-${entry.dayKey}-${idx}`}
                  className="text-xs text-neutral-500 flex items-start gap-1.5"
                >
                  <Clock size={10} className="mt-0.5 flex-shrink-0 text-neutral-600" />
                  <div className="flex-1 min-w-0">
                    <span className="text-neutral-400">{entry.habitName}</span>
                    {entry.value !== null && entry.value !== undefined && (
                      <span className="text-neutral-500">
                        {' '}
                        {entry.value}
                        {entry.unit && ` ${entry.unit}`}
                      </span>
                    )}
                    <span className="text-neutral-600 ml-1.5">{timeStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loadingEntries && recentEntries.length === 0 && (
          <div className="text-[10px] text-neutral-600 pt-2 border-t border-white/5">
            No entries today
          </div>
        )}
      </div>
    );
  }

  // Habit picker view
  if (!selectedHabit) {
    return (
      <div
        ref={containerRef}
        className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 shadow-lg"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">Log something you did</span>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {activeHabits.length === 0 ? (
            <div className="text-xs text-neutral-400 py-2">No active habits</div>
          ) : (
            activeHabits.map((habit) => (
              <button
                key={habit.id}
                onClick={() => handleQuickLog(habit)}
                className="w-full text-left px-3 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 border border-white/5 hover:border-white/10 transition-all text-sm text-neutral-300 hover:text-white"
              >
                {habit.name}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Numeric input view
  if (selectedHabit.goal.type === 'number') {
    return (
      <div
        ref={containerRef}
        className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 shadow-lg"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">{selectedHabit.name}</span>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleNumericSubmit}>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="number"
              step={selectedHabit.goal.unit === 'miles' ? 0.25 : 1}
              min={0}
              value={numericValue}
              onChange={(e) => setNumericValue(e.target.value)}
              placeholder={selectedHabit.goal.unit || 'amount'}
              className="flex-1 bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
            {selectedHabit.goal.unit && (
              <span className="text-xs text-neutral-400">{selectedHabit.goal.unit}</span>
            )}
            <button
              type="submit"
              disabled={!numericValue || isSubmitting}
              className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '...' : 'Log'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Choice habit view
  if (selectedHabit.bundleType === 'choice' && selectedHabit.bundleOptions) {
    // If option selected and needs metric input
    if (selectedOptionId) {
      const option = selectedHabit.bundleOptions.find((o) => o.id === selectedOptionId);
      const isMetricRequired = option?.metricConfig?.mode === 'required';

      if (isMetricRequired) {
        return (
          <div
            ref={containerRef}
            className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white">{option?.label}</span>
              <button
                onClick={() => {
                  setSelectedOptionId(null);
                  setNumericValue('');
                }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleChoiceWithMetric}>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="number"
                  step={option?.metricConfig?.step || 1}
                  min={0}
                  value={numericValue}
                  onChange={(e) => setNumericValue(e.target.value)}
                  placeholder={option?.metricConfig?.unit || 'amount'}
                  className="flex-1 bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                {option?.metricConfig?.unit && (
                  <span className="text-xs text-neutral-400">{option.metricConfig.unit}</span>
                )}
                <button
                  type="submit"
                  disabled={!numericValue || isSubmitting}
                  className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '...' : 'Log'}
                </button>
              </div>
            </form>
          </div>
        );
      }
    }

    // Option picker
    return (
      <div
        ref={containerRef}
        className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 shadow-lg"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">{selectedHabit.name}</span>
          <button
            onClick={() => setSelectedHabit(null)}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1.5">
          {selectedHabit.bundleOptions.map((option) => {
            const hasMetric = option.metricConfig?.mode === 'required';
            return (
              <button
                key={option.id}
                onClick={() => handleChoiceSelect(selectedHabit, option.id)}
                className="w-full text-left px-3 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 border border-white/5 hover:border-white/10 transition-all text-sm text-neutral-300 hover:text-white flex items-center justify-between"
              >
                <span>{option.label}</span>
                {hasMetric && (
                  <Hash size={12} className="text-neutral-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};

