import React, { useState, useMemo, useEffect } from 'react';
import { Play, Eye, Edit, Target } from 'lucide-react';
import { useRoutineStore } from '../../../store/RoutineContext';
import { useHabitStore } from '../../../store/HabitContext';
import { fetchDashboardPrefs, updateDashboardPrefs } from '../../../lib/persistenceClient';
import type { Routine, RoutineLog } from '../../../models/persistenceTypes';

const PinRoutinesModal: React.FC<{
  isOpen: boolean;
  routines: Routine[];
  initialPinnedIds: string[];
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void>;
}> = ({ isOpen, routines, initialPinnedIds, onClose, onSave }) => {
  const [selected, setSelected] = useState<string[]>(initialPinnedIds);
  React.useEffect(() => setSelected(initialPinnedIds), [initialPinnedIds, isOpen]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const suggestedCap = 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">Pin routines</div>
            <div className="text-xs text-neutral-500 mt-1">Pin up to {suggestedCap} routines for Action Cards.</div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">Close</button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {routines.length === 0 ? (
            <div className="text-sm text-neutral-400">No routines yet.</div>
          ) : (
            routines.map((r) => {
              const checked = selected.includes(r.id);
              return (
                <label key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/50 border border-white/5 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={checked} onChange={() => toggle(r.id)} />
                    <div>
                      <div className="text-sm text-white font-semibold">{r.title}</div>
                      <div className="text-xs text-neutral-500">{r.steps.length} steps</div>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500">{checked ? 'Pinned' : '—'}</div>
                </label>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-white/5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-white/5 text-sm font-medium">Cancel</button>
          <button
            onClick={async () => {
              await onSave(selected);
              onClose();
            }}
            className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold"
          >
            Save pins
          </button>
        </div>
      </div>
    </div>
  );
};

type Props = {
  onStartRoutine?: (routine: Routine) => void;
  onViewRoutine?: (routine: Routine) => void;
};

/**
 * Calculate last week's same weekday date
 * @param today - Today's date (YYYY-MM-DD)
 * @returns Last week's same weekday (YYYY-MM-DD)
 */
export function getLastWeekSameWeekday(today: string): string {
  const d = new Date(`${today}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Get routine IDs used on a specific date from routine logs
 * @param routineLogs - Record of routine logs keyed by `${routineId}-${date}`
 * @param date - Date to check (YYYY-MM-DD)
 * @returns Set of routine IDs used on that date
 */
export function getRoutinesUsedOnDate(routineLogs: Record<string, RoutineLog>, date: string): Set<string> {
  const routineIds = new Set<string>();
  for (const [compositeKey, log] of Object.entries(routineLogs)) {
    if (log.date === date) {
      routineIds.add(log.routineId);
    }
  }
  return routineIds;
}

/**
 * Order routines: surface routines used last week on same weekday first
 * @param routines - Array of routines to order
 * @param routineLogs - Record of routine logs
 * @param today - Today's date (YYYY-MM-DD)
 * @returns Ordered array with weekday-mirrored routines first
 */
export function orderRoutinesByWeekdayMirroring(
  routines: Routine[],
  routineLogs: Record<string, RoutineLog>,
  today: string
): Routine[] {
  const lastWeekSameWeekday = getLastWeekSameWeekday(today);
  const routinesUsedLastWeek = getRoutinesUsedOnDate(routineLogs, lastWeekSameWeekday);

  const used: Routine[] = [];
  const notUsed: Routine[] = [];

  for (const routine of routines) {
    if (routinesUsedLastWeek.has(routine.id)) {
      used.push(routine);
    } else {
      notUsed.push(routine);
    }
  }

  // Return used routines first, then others (preserving original order within each group)
  return [...used, ...notUsed];
}

export const ActionCards: React.FC<Props> = ({ onStartRoutine, onViewRoutine }) => {
  const { routines, routineLogs } = useRoutineStore();
  const { categories } = useHabitStore();
  const [prefsIds, setPrefsIds] = useState<string[]>([]);
  const [goToRoutineId, setGoToRoutineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const loadPrefs = async () => {
    setLoading(true);
    try {
      const prefs = await fetchDashboardPrefs();
      setPrefsIds(prefs.pinnedRoutineIds || []);
      // For now, use first pinned routine as go-to (can be extended to store in prefs)
      setGoToRoutineId(prefs.pinnedRoutineIds?.[0] || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPrefs();
  }, []);

  useEffect(() => {
    const handler = () => void loadPrefs();
    window.addEventListener('habitflow:demo-data-changed', handler as any);
    return () => window.removeEventListener('habitflow:demo-data-changed', handler as any);
  }, []);

  const pinnedRoutines = useMemo(() => {
    const map = new Map(routines.map((r) => [r.id, r]));
    const pinned = prefsIds
      .slice(0, 4) // Max 4 cards
      .map((id) => map.get(id))
      .filter(Boolean) as Routine[];

    // Apply weekday mirroring ordering
    const today = new Date().toISOString().slice(0, 10);
    return orderRoutinesByWeekdayMirroring(pinned, routineLogs, today);
  }, [prefsIds, routines, routineLogs]);

  const calculateDuration = (routine: Routine): number => {
    // Estimate duration: sum of timerSeconds + 60s buffer per step
    const estimatedSeconds = routine.steps.reduce((acc, step) => acc + (step.timerSeconds || 60), 0);
    return Math.max(1, Math.ceil(estimatedSeconds / 60));
  };

  const getCategoryName = (routine: Routine): string => {
    if (!routine.categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === routine.categoryId);
    return category?.name || 'Uncategorized';
  };

  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6">
        <div className="text-sm text-neutral-400">Loading action cards...</div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Action Cards</h3>
        </div>
        <button
          onClick={() => setIsPinModalOpen(true)}
          className="p-2 rounded-lg bg-neutral-800/60 hover:bg-neutral-800 border border-white/10 text-neutral-200 hover:text-white transition-colors"
          aria-label="Edit pinned routines"
          title="Edit pinned routines"
        >
          <Edit size={16} />
        </button>
      </div>

      {pinnedRoutines.length === 0 ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-neutral-300 font-medium">No pinned routines yet.</div>
            <div className="text-xs text-neutral-500 mt-1">Pin up to 4 routines to show here.</div>
          </div>
          <button
            onClick={() => setIsPinModalOpen(true)}
            className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-white/5 text-sm font-semibold"
          >
            Pin routines
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {pinnedRoutines.map((routine) => {
            const duration = calculateDuration(routine);
            const categoryName = getCategoryName(routine);
            const isGoTo = routine.id === goToRoutineId;

            return (
              <div
                key={routine.id}
                className="p-4 rounded-xl bg-neutral-800/50 border border-white/5 flex flex-col justify-between min-h-[140px]"
              >
                <div className="mb-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{routine.title}</div>
                      {isGoTo && (
                        <div className="text-[10px] text-emerald-400 font-medium mt-0.5">My Go-To Routine</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-400">
                    <span>{duration} min</span>
                    <span>•</span>
                    <span className="truncate">{categoryName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onStartRoutine && onStartRoutine(routine)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
                  >
                    <Play size={14} />
                    Start
                  </button>
                  {onViewRoutine && (
                    <button
                      onClick={() => onViewRoutine(routine)}
                      className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 border border-white/10 text-neutral-300 hover:text-white text-sm font-medium transition-colors"
                      title="View routine"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PinRoutinesModal
        isOpen={isPinModalOpen}
        routines={routines}
        initialPinnedIds={prefsIds}
        onClose={() => setIsPinModalOpen(false)}
        onSave={async (ids) => {
          const saved = await updateDashboardPrefs({ pinnedRoutineIds: ids });
          setPrefsIds(saved.pinnedRoutineIds || []);
          // Update go-to routine to first pinned
          setGoToRoutineId(saved.pinnedRoutineIds?.[0] || null);
        }}
      />
    </div>
  );
};

