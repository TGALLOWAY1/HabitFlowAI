import React, { useMemo, useState } from 'react';
import {
  Sun,
  ExternalLink,
  HeartHandshake,
  Sparkles,
  Activity,
  Brain,
  Battery,
  Play,
  Target,
  Crosshair,
  Moon,
  Heart,
  Wind,
  Repeat,
  Flower2,
  Layers,
} from 'lucide-react';
import { useWellbeingEntriesRange } from '../../../hooks/useWellbeingEntriesRange';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { fetchEntries, createEntry as createJournalEntry, upsertEntryByKey } from '../../../api/journal';
import type { JournalEntry, Routine } from '../../../models/persistenceTypes';
import { formatDayKeyFromDate } from '../../../domain/time/dayKey';
import { useRoutineStore } from '../../../store/RoutineContext';
import { fetchDashboardPrefs, updateDashboardPrefs } from '../../../lib/persistenceClient';
import { useHabitStore } from '../../../store/HabitContext';
import { getActivePersonaConfig } from '../../../shared/personas/activePersona';
import type { WellbeingMetricKey } from '../../../models/persistenceTypes';
import { GratitudeJarIcon } from '../../icons/GratitudeJarIcon';

type Props = {
  onOpenCheckIn: () => void;
  onNavigateWellbeingHistory?: () => void;
  onStartRoutine?: (routine: Routine) => void;
};

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

const Card: React.FC<{
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  headerClassName?: string;
}> = ({ title, icon, right, children, className, titleClassName, headerClassName }) => (
  <div className={`bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm ${className || ''}`}>
    <div className={`flex items-center justify-between mb-4 ${headerClassName || ''}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className={`text-lg font-semibold text-white ${titleClassName || ''}`}>{title}</h3>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const VIBE_OPTIONS = ['strained', 'tender', 'steady', 'open', 'thriving'] as const;
type Vibe = typeof VIBE_OPTIONS[number];

type SnapshotMetric = {
  key: WellbeingMetricKey;
  label: string;
  icon: React.ReactNode;
  /** Used for pip rendering; Snapshot never shows numbers */
  scale: '0_4' | '1_5' | '0_100';
};

const SNAPSHOT_METRIC_META: Record<WellbeingMetricKey, SnapshotMetric> = {
  depression: { key: 'depression', label: 'Depression', icon: <Brain size={14} className="text-blue-400" />, scale: '1_5' },
  anxiety: { key: 'anxiety', label: 'Anxiety', icon: <Activity size={14} className="text-purple-400" />, scale: '1_5' },
  energy: { key: 'energy', label: 'Energy', icon: <Battery size={14} className="text-emerald-400" />, scale: '1_5' },
  sleepScore: { key: 'sleepScore', label: 'Sleep score', icon: <Moon size={14} className="text-indigo-400" />, scale: '0_100' },
  sleepQuality: { key: 'sleepQuality', label: 'Sleep quality', icon: <Heart size={14} className="text-fuchsia-300" />, scale: '0_4' },
  lowMood: { key: 'lowMood', label: 'Low Mood', icon: <Brain size={14} className="text-blue-400" />, scale: '0_4' },
  calm: { key: 'calm', label: 'Calm', icon: <Wind size={14} className="text-emerald-400" />, scale: '0_4' },
  stress: { key: 'stress', label: 'Stress', icon: <Target size={14} className="text-orange-400" />, scale: '0_4' },
  focus: { key: 'focus', label: 'Focus', icon: <Crosshair size={14} className="text-amber-300" />, scale: '0_4' },
  notes: { key: 'notes', label: 'Notes', icon: <Sparkles size={14} className="text-neutral-400" />, scale: '0_4' },
};

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function filledPips(scale: SnapshotMetric['scale'], value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  if (scale === '0_4') {
    const v = clampInt(value, 0, 4);
    return v + 1;
  }
  if (scale === '1_5') {
    return clampInt(value, 0, 5);
  }
  // 0..100 -> 5 buckets (soft)
  const v = clampInt(value, 0, 100);
  if (v <= 20) return 1;
  if (v <= 40) return 2;
  if (v <= 60) return 3;
  if (v <= 80) return 4;
  return 5;
}

const CurrentVibeCard: React.FC = () => {
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const VIBE_COPY: Record<Vibe, string> = {
    strained: 'Today can be lighter.',
    tender: 'Today is about gentleness.',
    steady: 'Steady is enough.',
    open: 'Make room for what helps.',
    thriving: 'Let the good be real.',
  };

  const VIBE_UI: Record<
    Vibe,
    {
      label: string;
      Icon: React.ComponentType<{ size?: number; className?: string }>;
      tileBaseClass: string;
      tileSelectedClass: string;
      labelSelectedClass: string;
    }
  > = {
    strained: {
      label: 'strained',
      Icon: Repeat,
      tileBaseClass: 'bg-slate-800/60 border-white/10 text-slate-200',
      tileSelectedClass: 'bg-slate-700/70 border-slate-200/30 shadow-lg shadow-slate-400/10 ring-2 ring-slate-200/25',
      labelSelectedClass: 'text-white',
    },
    tender: {
      label: 'tender',
      Icon: HeartHandshake,
      tileBaseClass: 'bg-rose-900/20 border-rose-200/10 text-rose-100/80',
      tileSelectedClass: 'bg-rose-900/35 border-rose-200/25 shadow-lg shadow-rose-400/20 ring-2 ring-rose-300/30',
      labelSelectedClass: 'text-rose-50',
    },
    steady: {
      label: 'steady',
      Icon: Layers,
      tileBaseClass: 'bg-sky-900/20 border-sky-200/10 text-sky-100/80',
      tileSelectedClass: 'bg-sky-900/35 border-sky-200/25 shadow-lg shadow-sky-400/20 ring-2 ring-sky-300/30',
      labelSelectedClass: 'text-sky-50',
    },
    open: {
      label: 'open',
      Icon: Flower2,
      tileBaseClass: 'bg-emerald-900/20 border-emerald-200/10 text-emerald-100/80',
      tileSelectedClass: 'bg-emerald-900/35 border-emerald-200/25 shadow-lg shadow-emerald-400/20 ring-2 ring-emerald-300/30',
      labelSelectedClass: 'text-emerald-50',
    },
    thriving: {
      label: 'thriving',
      Icon: Sun,
      tileBaseClass: 'bg-amber-900/15 border-amber-200/10 text-amber-100/80',
      tileSelectedClass: 'bg-amber-900/30 border-amber-200/25 shadow-lg shadow-amber-300/20 ring-2 ring-amber-200/30',
      labelSelectedClass: 'text-amber-50',
    },
  };

  const loadVibeData = React.useCallback(() => {
    let cancelled = false;
    setLoading(true);
    fetchEntries()
      .then((all) => {
        if (cancelled) return;
        const entry = all.find((e) => e.templateId === 'current_vibe' && e.date === today);
        const v = entry?.content?.value as string | undefined;
        if (v && (VIBE_OPTIONS as readonly string[]).includes(v)) {
          setVibe(v as Vibe);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  React.useEffect(() => {
    const cleanup = loadVibeData();
    return cleanup;
  }, [loadVibeData]);

  // Refresh after demo seed/reset
  React.useEffect(() => {
    const handler = () => loadVibeData();
    window.addEventListener('habitflow:demo-data-changed', handler as any);
    return () => window.removeEventListener('habitflow:demo-data-changed', handler as any);
  }, [loadVibeData]);

  const saveVibe = async (next: Vibe) => {
    setVibe(next);
    await upsertEntryByKey({
      templateId: 'current_vibe',
      mode: 'free',
      persona: 'Emotional Wellbeing',
      date: today,
      content: { value: next },
    });
  };

  return (
    <Card
      title="Today’s Support"
      titleClassName="text-2xl font-light text-white/80"
      headerClassName="justify-center mb-6"
    >
      <div className="text-center text-sm tracking-wide text-neutral-400 mb-5">Current Vibe</div>

      <div className="grid grid-cols-5 gap-3 items-start">
        {(VIBE_OPTIONS as readonly Vibe[]).map((key) => {
          const ui = VIBE_UI[key];
          const selected = vibe === key;
          const Icon = ui.Icon;

          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => saveVibe(key)}
              className="group flex flex-col items-center"
            >
              <div
                className={[
                  'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border flex items-center justify-center transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950',
                  selected ? ui.tileSelectedClass : ui.tileBaseClass,
                ].join(' ')}
              >
                <Icon
                  size={28}
                  className={`transition-opacity ${selected ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}
                />
              </div>
              <div
                className={[
                  'mt-2 text-xs sm:text-sm font-semibold tracking-wide text-center transition-colors',
                  selected ? ui.labelSelectedClass : 'text-neutral-400 group-hover:text-neutral-200',
                ].join(' ')}
              >
                {ui.label}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-center text-lg sm:text-xl text-amber-100/80 leading-relaxed">
        {loading ? 'Loading…' : vibe ? VIBE_COPY[vibe] : 'What fits right now?'}
      </div>
    </Card>
  );
};

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

  const suggestedCap = 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">Pin routines</div>
            <div className="text-xs text-neutral-500 mt-1">Suggested: pin ~{suggestedCap}. You can pin more.</div>
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

const TodaysSnapshotCard: React.FC = () => {
  const { wellbeingLogs } = useHabitStore();
  const persona = getActivePersonaConfig();
  const today = new Date().toISOString().slice(0, 10);
  const [extraKeys, setExtraKeys] = useState<WellbeingMetricKey[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetchDashboardPrefs()
      .then((prefs) => {
        if (cancelled) return;
        const keys = (prefs.checkinExtraMetricKeys || [])
          .filter((k): k is WellbeingMetricKey => !!k)
          .filter((k) => k !== 'notes');
        setExtraKeys(keys);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const base = (persona.checkinSubset || []).filter((k): k is WellbeingMetricKey => k !== 'vibe');
    const all = Array.from(new Set([...base, ...extraKeys]))
      .filter((k) => k !== 'notes')
      .filter((k) => SNAPSHOT_METRIC_META[k] !== undefined);
    return all.map((k) => SNAPSHOT_METRIC_META[k]);
  }, [persona.checkinSubset, extraKeys]);

  const todaysLog = wellbeingLogs[today];
  const session = todaysLog?.evening || todaysLog?.morning;

  const valueFor = (key: WellbeingMetricKey): number | null => {
    // Prefer session (morning/evening), then legacy top-level.
    const v = (session as any)?.[key];
    if (typeof v === 'number') return v;
    const legacy = (todaysLog as any)?.[key];
    if (typeof legacy === 'number') return legacy;
    return null;
  };

  return (
    <Card title="Today’s Snapshot" icon={<Sparkles size={16} className="text-sky-300" />} className="bg-neutral-900/40">
      {metrics.length === 0 ? (
        <div className="text-sm text-neutral-400">No check-in metrics configured.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {metrics.map((m) => {
            const v = valueFor(m.key);
            const filled = filledPips(m.scale, v);
            return (
              <div key={m.key} className="p-4 rounded-xl bg-neutral-900/40 border border-white/5">
                <div className="flex items-center gap-2">
                  {m.icon}
                  <div className="text-sm font-semibold text-white">{m.label}</div>
                </div>
                <div className="mt-3 flex gap-1.5" aria-label={`${m.label} intensity`}>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2.5 h-2.5 rounded-full ${idx < filled ? 'bg-white/50' : 'bg-white/10'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 text-sm text-neutral-400">You can feel more than one thing at once.</div>
    </Card>
  );
};

type MoodCompareKey = Exclude<WellbeingMetricKey, 'notes'>;

function intensity0to4FromMetricValue(metric: MoodCompareKey, value: number | null): number | null {
  if (value === null || value === undefined) return null;
  // legacy 1..5 -> 0..4
  if (metric === 'anxiety' || metric === 'energy' || metric === 'depression') {
    return clampInt(value - 1, 0, 4);
  }
  // legacy 0..100 -> bucket to 0..4
  if (metric === 'sleepScore') {
    const v = clampInt(value, 0, 100);
    if (v <= 20) return 0;
    if (v <= 40) return 1;
    if (v <= 60) return 2;
    if (v <= 80) return 3;
    return 4;
  }
  // new subjective superset already 0..4
  return clampInt(value, 0, 4);
}

function moodCellClass(metric: MoodCompareKey, intensity: number | null): string {
  if (intensity === null) return 'bg-neutral-800/60 border-white/5';

  const opacity = [15, 25, 35, 50, 65][intensity] || 25;
  // Keep colors muted and non-judgmental.
  const base =
    metric === 'calm'
      ? 'bg-emerald-400'
      : metric === 'anxiety'
        ? 'bg-purple-400'
        : metric === 'lowMood'
          ? 'bg-sky-400'
          : metric === 'stress'
            ? 'bg-orange-400'
            : metric === 'focus'
              ? 'bg-amber-300'
              : metric === 'energy'
                ? 'bg-green-400'
                : metric === 'sleepQuality'
                  ? 'bg-fuchsia-300'
                  : metric === 'sleepScore'
                    ? 'bg-indigo-400'
                    : 'bg-neutral-400';

  // Use Tailwind opacity via slash when possible; fall back to inline-ish classes with /xx.
  // We stick to a fixed palette to avoid runtime styles.
  const withOpacity =
    base === 'bg-emerald-400' ? `bg-emerald-400/${opacity}` :
    base === 'bg-purple-400' ? `bg-purple-400/${opacity}` :
    base === 'bg-sky-400' ? `bg-sky-400/${opacity}` :
    base === 'bg-orange-400' ? `bg-orange-400/${opacity}` :
    base === 'bg-amber-300' ? `bg-amber-300/${opacity}` :
    base === 'bg-green-400' ? `bg-green-400/${opacity}` :
    base === 'bg-fuchsia-300' ? `bg-fuchsia-300/${opacity}` :
    base === 'bg-indigo-400' ? `bg-indigo-400/${opacity}` :
    `bg-neutral-400/${opacity}`;

  return `${withOpacity} border-white/5`;
}

const HabitsMoodPatternsCard: React.FC = () => {
  const { habits, logs, wellbeingLogs } = useHabitStore();
  const persona = getActivePersonaConfig();
  const [extraKeys, setExtraKeys] = useState<WellbeingMetricKey[]>([]);
  const timeZone = useMemo(() => getTimeZone(), []);
  const [selectedMetric, setSelectedMetric] = useState<MoodCompareKey>('calm');

  React.useEffect(() => {
    let cancelled = false;
    fetchDashboardPrefs()
      .then((prefs) => {
        if (cancelled) return;
        const keys = (prefs.checkinExtraMetricKeys || []).filter((k): k is WellbeingMetricKey => !!k);
        setExtraKeys(keys);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metricOptions = useMemo(() => {
    const base = (persona.checkinSubset || []).filter((k): k is WellbeingMetricKey => k !== 'vibe');
    const all = Array.from(new Set([...base, ...extraKeys]))
      .filter((k) => k !== 'notes')
      .filter((k) => SNAPSHOT_METRIC_META[k] !== undefined) as MoodCompareKey[];
    return all.map((k) => SNAPSHOT_METRIC_META[k]);
  }, [persona.checkinSubset, extraKeys]);

  React.useEffect(() => {
    // Ensure selectedMetric stays valid when persona/extras change.
    if (metricOptions.length === 0) return;
    const keys = metricOptions.map((m) => m.key as MoodCompareKey);
    if (!keys.includes(selectedMetric)) {
      setSelectedMetric(keys.includes('calm') ? 'calm' : keys[0]);
    }
  }, [metricOptions]);

  const dayKeys30 = useMemo(() => {
    const keys: string[] = [];
    for (let i = 29; i >= 0; i--) {
      keys.push(getDayKeyDaysAgo(i, timeZone));
    }
    return keys;
  }, [timeZone]);

  const activeHabits = useMemo(() => {
    return habits.filter((h) => !h.archived);
  }, [habits]);

  const getMoodValueForDay = (dayKey: string, key: MoodCompareKey): number | null => {
    const log = wellbeingLogs[dayKey];
    if (!log) return null;
    const session = log.evening || log.morning;
    const v = (session as any)?.[key];
    if (typeof v === 'number') return v;
    const legacy = (log as any)?.[key];
    if (typeof legacy === 'number') return legacy;
    return null;
  };

  const gridStyle: React.CSSProperties = useMemo(() => ({ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))', gap: '3px' }), []);

  return (
    <Card
      title="Habits & Mood Patterns"
      icon={<Sparkles size={16} className="text-neutral-300" />}
      right={
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Metric:</span>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MoodCompareKey)}
            className="bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-white/20"
          >
            {metricOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div className="space-y-5">
        {activeHabits.length === 0 ? (
          <div className="text-sm text-neutral-400">No habits yet.</div>
        ) : (
          activeHabits.map((habit) => {
            const habitCells = dayKeys30.map((dayKey) => {
              const log = logs[`${habit.id}-${dayKey}`];
              const hasAny =
                !!log &&
                (log.completed ||
                  (typeof log.value === 'number' && log.value > 0) ||
                  (log.completedOptions && Object.keys(log.completedOptions).length > 0));
              return hasAny;
            });

            const moodCells = dayKeys30.map((dayKey) => {
              const v = getMoodValueForDay(dayKey, selectedMetric);
              return intensity0to4FromMetricValue(selectedMetric, v);
            });

            return (
              <div key={habit.id} className="space-y-2">
                <div className="grid grid-cols-[180px_1fr] gap-3 items-center">
                  <div className="text-sm font-semibold text-white truncate">{habit.name}</div>
                  <div className="grid" style={gridStyle}>
                    {habitCells.map((active, idx) => (
                      <div
                        key={idx}
                        className={`h-4 rounded-sm border ${
                          active ? 'bg-emerald-400/35 border-emerald-400/10' : 'bg-neutral-800/50 border-white/5'
                        }`}
                        title={`${dayKeys30[idx]}: ${active ? 'active' : '—'}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-[180px_1fr] gap-3 items-center">
                  <div className="text-xs text-neutral-500 truncate"> </div>
                  <div className="grid" style={gridStyle}>
                    {moodCells.map((intensity, idx) => (
                      <div
                        key={idx}
                        className={`h-4 rounded-sm border ${moodCellClass(selectedMetric, intensity)}`}
                        title={`${dayKeys30[idx]}: ${intensity === null ? '—' : intensity}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 text-xs text-neutral-500">Notice any patterns.</div>
    </Card>
  );
};

const ActionCards: React.FC<{ onStartRoutine?: (routine: Routine) => void }> = ({ onStartRoutine }) => {
  const { routines } = useRoutineStore();
  const [prefsIds, setPrefsIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const loadPrefs = async () => {
    setLoading(true);
    try {
      const prefs = await fetchDashboardPrefs();
      setPrefsIds(prefs.pinnedRoutineIds || []);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadPrefs();
  }, []);

  React.useEffect(() => {
    const handler = () => void loadPrefs();
    window.addEventListener('habitflow:demo-data-changed', handler as any);
    return () => window.removeEventListener('habitflow:demo-data-changed', handler as any);
  }, []);

  const pinnedRoutines = useMemo(() => {
    const map = new Map(routines.map((r) => [r.id, r]));
    return prefsIds.map((id) => map.get(id)).filter(Boolean) as Routine[];
  }, [prefsIds, routines]);

  return (
    <Card title="Action Cards" icon={<HeartHandshake size={16} className="text-emerald-400" />}>
      {loading ? (
        <div className="text-sm text-neutral-400">Loading…</div>
      ) : pinnedRoutines.length === 0 ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-neutral-300 font-medium">No pinned routines yet.</div>
            <div className="text-xs text-neutral-500 mt-1">Pin 2–3 gentle routines to show here.</div>
          </div>
          <button
            onClick={() => setIsPinModalOpen(true)}
            className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-white/5 text-sm font-semibold"
          >
            Pin routines
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {pinnedRoutines.map((r) => (
            <div key={r.id} className="p-4 rounded-xl bg-neutral-800/50 border border-white/5 flex flex-col justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{r.title}</div>
                <div className="text-xs text-neutral-500 mt-1">A gentle reset you can do now.</div>
              </div>
              <button
                onClick={() => onStartRoutine && onStartRoutine(r)}
                className="mt-4 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold"
              >
                <Play size={16} />
                Start
              </button>
            </div>
          ))}
          <div className="p-4 rounded-xl bg-neutral-900/40 border border-white/5 flex items-center justify-center">
            <button
              onClick={() => setIsPinModalOpen(true)}
              className="text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
            >
              Edit pins
            </button>
          </div>
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
        }}
      />
    </Card>
  );
};

const GratitudeJarCard: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchEntries();
      const gratitude = all.filter((e) => e.templateId === 'gratitude-jar');
      // newest first (api already sorts desc)
      setEntries(gratitude.slice(0, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gratitude entries');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void load();
  }, []);

  React.useEffect(() => {
    const handler = () => void load();
    window.addEventListener('habitflow:demo-data-changed', handler as any);
    return () => window.removeEventListener('habitflow:demo-data-changed', handler as any);
  }, []);

  const handleQuickAdd = async () => {
    await createJournalEntry({
      templateId: 'gratitude-jar',
      mode: 'free',
      persona: 'Emotional Wellbeing',
      date: new Date().toISOString().slice(0, 10),
      content: { 'free-write': 'Today I’m grateful for…' },
    });
    await load();
  };

  return (
    <Card
      title="Gratitude Jar"
      icon={<GratitudeJarIcon size={18} className="text-emerald-300" />}
      right={
        <button
          onClick={handleQuickAdd}
          className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
        >
          + Quick add
        </button>
      }
      // Supportive, secondary visual hierarchy vs Current Vibe
      className="bg-neutral-900/30 p-4"
      headerClassName="mb-3"
      titleClassName="text-sm font-semibold text-white/90"
    >
      {loading ? (
        <div className="text-sm text-neutral-400">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-300">{error}</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-neutral-400">No gratitude entries yet.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="p-3 rounded-xl bg-neutral-900/40 border border-white/5">
              <div className="text-xs text-neutral-500 mb-1">{e.date}</div>
              <div className="text-sm text-white line-clamp-3">{e.content?.['free-write'] || '(empty)'}</div>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-neutral-500 mt-2">Shows your most recent gratitude entries.</div>
    </Card>
  );
};

const EmotionalTrendCard: React.FC<{ onNavigateWellbeingHistory?: () => void }> = ({ onNavigateWellbeingHistory }) => {
  const [windowDays, setWindowDays] = useState<7 | 14 | 30 | 90>(14);
  const [mode, setMode] = useState<'avg' | 'am_pm'>('avg');
  const { startDayKey, endDayKey, loading, error, getDailyAverage } = useWellbeingEntriesRange(windowDays);
  const [activeMetrics, setActiveMetrics] = useState<Array<'anxiety' | 'lowMood' | 'calm' | 'energy' | 'stress' | 'focus' | 'sleepScore' | 'sleepQuality'>>([
    'anxiety',
    'lowMood',
    'calm',
  ]);

  const timeZone = useMemo(() => getTimeZone(), []);

  const yDomain = useMemo(() => {
    if (activeMetrics.includes('sleepScore')) return [0, 100] as const;
    if (activeMetrics.some((m) => m === 'anxiety' || m === 'energy')) return [0, 5] as const;
    return [0, 4] as const;
  }, [activeMetrics]);

  const metricChips: Array<{ key: typeof activeMetrics[number]; label: string; color: string }> = [
    { key: 'anxiety', label: 'Anxiety', color: '#a855f7' },
    { key: 'lowMood', label: 'Low Mood', color: '#60a5fa' },
    { key: 'calm', label: 'Calm', color: '#34d399' },
    { key: 'energy', label: 'Energy', color: '#10b981' },
    { key: 'stress', label: 'Stress', color: '#f97316' },
    { key: 'focus', label: 'Focus', color: '#fbbf24' },
    { key: 'sleepScore', label: 'Sleep score', color: '#818cf8' },
    { key: 'sleepQuality', label: 'Sleep quality', color: '#c084fc' },
  ];

  const applyPreset = (preset: 'emotional_core' | 'energy_focus' | 'sleep') => {
    if (preset === 'emotional_core') {
      setActiveMetrics(['anxiety', 'lowMood', 'calm']);
      return;
    }
    if (preset === 'energy_focus') {
      setMode('avg');
      setActiveMetrics(['energy', 'stress', 'focus']);
      return;
    }
    if (preset === 'sleep') {
      setMode('avg');
      setActiveMetrics(['sleepScore', 'sleepQuality']);
      return;
    }
  };

  const toggleMetric = (k: typeof activeMetrics[number]) => {
    setActiveMetrics((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  // AM/PM is session-based; if user wants AM/PM, keep selection to session-friendly metrics.
  React.useEffect(() => {
    if (mode !== 'am_pm') return;
    const sessionFriendly: any[] = ['anxiety', 'lowMood', 'calm', 'energy'];
    const filtered = activeMetrics.filter((m) => sessionFriendly.includes(m));
    if (filtered.length === 0) {
      setActiveMetrics(['anxiety', 'lowMood', 'calm']);
    } else if (filtered.length !== activeMetrics.length) {
      setActiveMetrics(filtered as any);
    }
  }, [mode]);

  const series = useMemo(() => {
    if (mode === 'am_pm') {
      const out: Array<{ name: string; key: string; color: string; dashed?: boolean }> = [];
      const addPair = (base: string, label: string, color: string) => {
        out.push({ name: `${label} AM`, key: `${base}_am`, color });
        out.push({ name: `${label} PM`, key: `${base}_pm`, color, dashed: true });
      };
      if (activeMetrics.includes('anxiety')) addPair('anxiety', 'Anxiety', '#a855f7');
      if (activeMetrics.includes('lowMood')) addPair('lowMood', 'Low Mood', '#60a5fa');
      if (activeMetrics.includes('calm')) addPair('calm', 'Calm', '#34d399');
      if (activeMetrics.includes('energy')) addPair('energy', 'Energy', '#10b981');
      return out;
    }
    return metricChips
      .filter((m) => activeMetrics.includes(m.key))
      .map((m) => ({ name: m.label, key: m.key, color: m.color }));
  }, [mode, activeMetrics]);

  const data = useMemo(() => {
    const rows: any[] = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const dayKey = getDayKeyDaysAgo(i, timeZone);
      if (mode === 'am_pm') {
        const row: any = { dayKey };
        if (activeMetrics.includes('anxiety')) {
          row.anxiety_am = getDailyAverage(dayKey, 'anxiety', 'morning');
          row.anxiety_pm = getDailyAverage(dayKey, 'anxiety', 'evening');
        }
        if (activeMetrics.includes('lowMood')) {
          row.lowMood_am = getDailyAverage(dayKey, 'lowMood', 'morning');
          row.lowMood_pm = getDailyAverage(dayKey, 'lowMood', 'evening');
        }
        if (activeMetrics.includes('calm')) {
          row.calm_am = getDailyAverage(dayKey, 'calm', 'morning');
          row.calm_pm = getDailyAverage(dayKey, 'calm', 'evening');
        }
        if (activeMetrics.includes('energy')) {
          row.energy_am = getDailyAverage(dayKey, 'energy', 'morning');
          row.energy_pm = getDailyAverage(dayKey, 'energy', 'evening');
        }
        rows.push(row);
      } else {
        const row: any = { dayKey };
        if (activeMetrics.includes('anxiety')) row.anxiety = getDailyAverage(dayKey, 'anxiety');
        if (activeMetrics.includes('lowMood')) row.lowMood = getDailyAverage(dayKey, 'lowMood');
        if (activeMetrics.includes('calm')) row.calm = getDailyAverage(dayKey, 'calm');
        if (activeMetrics.includes('energy')) row.energy = getDailyAverage(dayKey, 'energy');
        if (activeMetrics.includes('stress')) row.stress = getDailyAverage(dayKey, 'stress');
        if (activeMetrics.includes('focus')) row.focus = getDailyAverage(dayKey, 'focus');
        if (activeMetrics.includes('sleepScore')) row.sleepScore = getDailyAverage(dayKey, 'sleepScore');
        if (activeMetrics.includes('sleepQuality')) row.sleepQuality = getDailyAverage(dayKey, 'sleepQuality');
        rows.push(row);
      }
    }
    return rows;
  }, [windowDays, timeZone, getDailyAverage, mode, activeMetrics]);

  return (
    <Card
      title="Emotional State Trend"
      icon={<Activity size={16} className="text-sky-400" />}
      right={
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 mr-1">
            <div className="text-[11px] text-neutral-500 font-semibold">Presets:</div>
            <button
              onClick={() => applyPreset('emotional_core')}
              className="px-2 py-1 rounded-md bg-neutral-800/60 border border-white/10 text-[11px] text-neutral-200 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              Emotional core
            </button>
            <button
              onClick={() => applyPreset('energy_focus')}
              className="px-2 py-1 rounded-md bg-neutral-800/60 border border-white/10 text-[11px] text-neutral-200 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              Energy & focus
            </button>
            <button
              onClick={() => applyPreset('sleep')}
              className="px-2 py-1 rounded-md bg-neutral-800/60 border border-white/10 text-[11px] text-neutral-200 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              Sleep
            </button>
          </div>
          <div className="flex bg-neutral-800 rounded-md p-0.5 border border-white/5">
            {(['avg', 'am_pm'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  mode === m ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title={m === 'avg' ? 'Daily average' : 'Morning/Evening'}
              >
                {m === 'avg' ? 'Daily avg' : 'AM/PM'}
              </button>
            ))}
          </div>
          <div className="flex bg-neutral-800 rounded-md p-0.5 border border-white/5">
            {([7, 14, 30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  windowDays === d ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          {onNavigateWellbeingHistory && (
            <button
              onClick={onNavigateWellbeingHistory}
              className="text-xs text-neutral-400 hover:text-white transition-colors inline-flex items-center gap-1"
              title="Open full wellbeing history"
            >
              History <ExternalLink size={12} />
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {metricChips.map((m) => {
          const active = activeMetrics.includes(m.key);
          const disabledInAmPm = mode === 'am_pm' && !['anxiety', 'lowMood', 'calm', 'energy'].includes(m.key);
          return (
            <button
              key={m.key}
              onClick={() => {
                if (disabledInAmPm) setMode('avg');
                toggleMetric(m.key);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                active ? 'bg-white/10 text-white border-white/20' : 'bg-neutral-800/60 text-neutral-300 border-white/10 hover:text-white'
              }`}
              title={disabledInAmPm ? 'Switches to Daily avg (this metric is not session-based).' : undefined}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-sm text-neutral-400">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-300">{error}</div>
      ) : series.length === 0 ? (
        <div className="text-sm text-neutral-400">Select at least one metric.</div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="dayKey" tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={yDomain as any} tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              {series.map((s) => (
                <Line
                  key={s.key}
                  name={s.name}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeDasharray={s.dashed ? '4 3' : undefined}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="text-xs text-neutral-500 mt-3">
        Powered by canonical <code className="text-neutral-400">/api/wellbeingEntries</code>. Weekly view removed; use 90d + presets for patterns.
      </div>
    </Card>
  );
};

export const EmotionalWellbeingDashboard: React.FC<Props> = ({ onOpenCheckIn, onNavigateWellbeingHistory, onStartRoutine }) => {
  return (
    <div className="space-y-6 overflow-y-auto pb-20">
      {/* Persona Header actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onOpenCheckIn}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/5"
        >
          <Sun size={16} className="text-amber-400" />
          Daily Check-in
        </button>
        {onNavigateWellbeingHistory && (
          <button
            onClick={onNavigateWellbeingHistory}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/5"
          >
            <Brain size={16} className="text-sky-400" />
            Wellbeing History
          </button>
        )}
      </div>

      {/* Top row: Current Vibe (primary) + Gratitude Jar (secondary) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
        <div className="md:col-span-3">
          <CurrentVibeCard />
        </div>
        <div className="md:col-span-2">
          <GratitudeJarCard />
        </div>
      </div>

      {/* Main dashboard must be today-focused: no historical wellbeing charts here. */}
      <TodaysSnapshotCard />
      <HabitsMoodPatternsCard />
      <ActionCards onStartRoutine={onStartRoutine} />
    </div>
  );
};


