import React, { useMemo, useState } from 'react';
import { Sun, ExternalLink, HeartHandshake, Sparkles, Activity, Brain, Battery, Play } from 'lucide-react';
import { ProgressRings } from '../../ProgressRings';
import { DashboardComposer } from '../../../shared/personas/dashboardComposer';
import { getActivePersonaId } from '../../../shared/personas/activePersona';
import { useWellbeingEntriesRange } from '../../../hooks/useWellbeingEntriesRange';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { fetchEntries, createEntry as createJournalEntry, upsertEntryByKey } from '../../../api/journal';
import type { JournalEntry, Routine } from '../../../models/persistenceTypes';
import { formatDayKeyFromDate } from '../../../domain/time/dayKey';
import { useRoutineStore } from '../../../store/RoutineContext';
import { fetchDashboardPrefs, updateDashboardPrefs } from '../../../lib/persistenceClient';

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

const Card: React.FC<{ title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, right, children }) => (
  <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const VIBE_OPTIONS = ['strained', 'tender', 'steady', 'open', 'thriving'] as const;
type Vibe = typeof VIBE_OPTIONS[number];

function vibeDotClass(v: Vibe | null): string {
  switch (v) {
    case 'strained':
      return 'bg-red-400';
    case 'tender':
      return 'bg-fuchsia-300';
    case 'steady':
      return 'bg-emerald-400';
    case 'open':
      return 'bg-sky-400';
    case 'thriving':
      return 'bg-amber-300';
    default:
      return 'bg-neutral-700';
  }
}

const CurrentVibeCard: React.FC = () => {
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [loading, setLoading] = useState(false);
  const [week, setWeek] = useState<Array<{ dayKey: string; vibe: Vibe | null }>>([]);

  const today = new Date().toISOString().slice(0, 10);

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

        // Last 7 days row (including today)
        const timeZone = getTimeZone();
        const days: Array<{ dayKey: string; vibe: Vibe | null }> = [];
        for (let i = 6; i >= 0; i--) {
          const dayKey = getDayKeyDaysAgo(i, timeZone);
          const e = all.find((x) => x.templateId === 'current_vibe' && x.date === dayKey);
          const vv = e?.content?.value as string | undefined;
          days.push({
            dayKey,
            vibe: vv && (VIBE_OPTIONS as readonly string[]).includes(vv) ? (vv as Vibe) : null,
          });
        }
        setWeek(days);
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
    // optimistic update in mini history row
    setWeek((prev) => prev.map((d) => (d.dayKey === today ? { ...d, vibe: next } : d)));
  };

  return (
    <Card
      title="Current Vibe"
      icon={<Sparkles size={16} className="text-amber-400" />}
      right={<span className="text-xs text-neutral-500">{loading ? 'Loading…' : 'Saved as JournalEntry (current_vibe)'}</span>}
    >
      <div className="text-sm text-neutral-400 mb-3">Quick check: how do you feel right now?</div>
      <div className="flex flex-wrap gap-2">
        {(VIBE_OPTIONS as readonly Vibe[]).map((key) => (
          <button
            key={key}
            onClick={() => saveVibe(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              vibe === key ? 'bg-white/10 text-white border-white/20' : 'bg-neutral-800/60 text-neutral-300 border-white/10 hover:text-white'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="text-xs text-neutral-500 mb-2">Last 7 days</div>
        <div className="flex items-center gap-2">
          {week.map((d) => {
            const weekday = new Date(`${d.dayKey}T00:00:00.000Z`).toLocaleDateString(undefined, { weekday: 'narrow' });
            return (
              <div key={d.dayKey} className="flex flex-col items-center gap-1 w-7">
                <div className="text-[10px] text-neutral-500">{weekday}</div>
                <div className={`w-2.5 h-2.5 rounded-full ${vibeDotClass(d.vibe)}`} title={`${d.dayKey}: ${d.vibe ?? '—'}`} />
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-neutral-500 mt-2">Missing days are normal. No pressure.</div>
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
      setEntries(gratitude.slice(0, 3));
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
      icon={<Sparkles size={16} className="text-emerald-400" />}
      right={
        <button
          onClick={handleQuickAdd}
          className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
        >
          + Quick add
        </button>
      }
    >
      {loading ? (
        <div className="text-sm text-neutral-400">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-300">{error}</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-neutral-400">No gratitude entries yet.</div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <div key={e.id} className="p-4 rounded-xl bg-neutral-800/50 border border-white/5">
              <div className="text-xs text-neutral-500 mb-1">{e.date}</div>
              <div className="text-sm text-white line-clamp-3">{e.content?.['free-write'] || '(empty)'}</div>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-neutral-500 mt-3">Shows your last 3 gratitude-jar journal entries.</div>
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
  const personaId = getActivePersonaId();
  const widgets = DashboardComposer(personaId);

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

      {widgets.map((w, idx) => {
        switch (w.type) {
          case 'header':
            return <ProgressRings key={`${w.type}-${idx}`} />;
          case 'currentVibe':
            return <CurrentVibeCard key={`${w.type}-${idx}`} />;
          case 'actionCards':
            return <ActionCards key={`${w.type}-${idx}`} onStartRoutine={onStartRoutine} />;
          case 'gratitudeJar':
            return <GratitudeJarCard key={`${w.type}-${idx}`} />;
          case 'emotionalTrend':
            return <EmotionalTrendCard key={`${w.type}-${idx}`} onNavigateWellbeingHistory={onNavigateWellbeingHistory} />;
          default:
            return null;
        }
      })}

      {/* Minimal “legend” for what this persona is */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Activity size={16} className="text-purple-400" /> Anxiety
          </div>
          <div className="text-xs text-neutral-500 mt-1">Often shows up differently AM vs PM. Use the AM/PM toggle to compare.</div>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Brain size={16} className="text-blue-400" /> Low Mood
          </div>
          <div className="text-xs text-neutral-500 mt-1">A gentle signal (0–4) that pairs well with Calm.</div>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles size={16} className="text-emerald-400" /> Calm
          </div>
          <div className="text-xs text-neutral-500 mt-1">A counter-signal to stress; patterns matter more than any single day.</div>
        </div>
      </div>
    </div>
  );
};


