import React, { useMemo, useState } from 'react';
import { Sun, ExternalLink, HeartHandshake, Sparkles, Activity, Brain, Battery, CalendarRange } from 'lucide-react';
import { ProgressRings } from '../../ProgressRings';
import { DashboardComposer } from '../../../shared/personas/dashboardComposer';
import { getActivePersonaId } from '../../../shared/personas/activePersona';
import { useWellbeingEntriesRange } from '../../../hooks/useWellbeingEntriesRange';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { fetchEntries, createEntry as createJournalEntry } from '../../../api/journal';
import type { JournalEntry } from '../../../models/persistenceTypes';
import { fetchWellbeingEntries } from '../../../lib/persistenceClient';
import { formatDayKeyFromDate } from '../../../domain/time/dayKey';

type Props = {
  onOpenCheckIn: () => void;
  onNavigateWellbeingHistory?: () => void;
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

const CurrentVibeCard: React.FC = () => {
  // UI-only placeholder for MVP (no unstable schema keys).
  const [vibe, setVibe] = useState<'low' | 'meh' | 'okay' | 'good' | 'great' | null>(null);

  return (
    <Card
      title="Current Vibe"
      icon={<Sparkles size={16} className="text-amber-400" />}
      right={<span className="text-xs text-neutral-500">TODO: add stable storage (not a metric key)</span>}
    >
      <div className="text-sm text-neutral-400 mb-3">Quick check: how do you feel right now?</div>
      <div className="flex flex-wrap gap-2">
        {([
          ['low', 'Low'],
          ['meh', 'Meh'],
          ['okay', 'Okay'],
          ['good', 'Good'],
          ['great', 'Great'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setVibe(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              vibe === key ? 'bg-white/10 text-white border-white/20' : 'bg-neutral-800/60 text-neutral-300 border-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </Card>
  );
};

const ActionCards: React.FC = () => {
  // Placeholder: pinned routines don’t exist yet.
  const actions = [
    { title: '2-min breath reset', note: 'Slow exhale x 6' },
    { title: 'Gentle walk', note: '10 minutes outside' },
    { title: 'Text a friend', note: 'Ask for a check-in' },
  ];

  return (
    <Card title="Action Cards" icon={<HeartHandshake size={16} className="text-emerald-400" />}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {actions.map((a) => (
          <div key={a.title} className="p-4 rounded-xl bg-neutral-800/50 border border-white/5">
            <div className="text-sm font-semibold text-white">{a.title}</div>
            <div className="text-xs text-neutral-500 mt-1">{a.note}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-neutral-500 mt-3">TODO: map these to pinned routines when routine pinning is available.</div>
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
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(7);
  const { startDayKey, endDayKey, loading, error, getDailyAverage } = useWellbeingEntriesRange(windowDays);

  const timeZone = useMemo(() => getTimeZone(), []);
  const data = useMemo(() => {
    const rows: any[] = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const dayKey = getDayKeyDaysAgo(i, timeZone);
      rows.push({
        dayKey,
        depression: getDailyAverage(dayKey, 'depression'),
        anxiety: getDailyAverage(dayKey, 'anxiety'),
        energy: getDailyAverage(dayKey, 'energy'),
      });
    }
    return rows;
  }, [windowDays, timeZone, getDailyAverage]);

  return (
    <Card
      title="Emotional State Trend"
      icon={<Activity size={16} className="text-sky-400" />}
      right={
        <div className="flex items-center gap-3">
          <div className="flex bg-neutral-800 rounded-md p-0.5 border border-white/5">
            {([7, 14, 30] as const).map((d) => (
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
      {loading ? (
        <div className="text-sm text-neutral-400">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-300">{error}</div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="dayKey" tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              <Line name="Depression" type="monotone" dataKey="depression" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
              <Line name="Anxiety" type="monotone" dataKey="anxiety" stroke="#a855f7" strokeWidth={2} dot={false} connectNulls />
              <Line name="Energy" type="monotone" dataKey="energy" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="text-xs text-neutral-500 mt-3">
        Powered by canonical <code className="text-neutral-400">/api/wellbeingEntries</code> (averaged per day).
      </div>
    </Card>
  );
};

const WeeklyTrajectoryCard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const timeZone = getTimeZone();
    const endDayKey = getDayKeyDaysAgo(0, timeZone);
    const startDayKey = getDayKeyDaysAgo(55, timeZone); // ~8 weeks

    setLoading(true);
    setError(null);
    fetchWellbeingEntries({ startDayKey, endDayKey })
      .then((entries) => {
        if (cancelled) return;

        const byWeek = new Map<string, { depression: number[]; anxiety: number[] }>();
        for (const e of entries) {
          if (typeof e.value !== 'number') continue;
          if (e.metricKey !== 'depression' && e.metricKey !== 'anxiety') continue;

          // Week key: Monday-based label derived from dayKey date
          const d = new Date(`${e.dayKey}T00:00:00.000Z`);
          const day = d.getUTCDay(); // 0..6, Sun=0
          const diffToMonday = (day + 6) % 7;
          d.setUTCDate(d.getUTCDate() - diffToMonday);
          const weekKey = formatDayKeyFromDate(d, 'UTC');

          const bucket = byWeek.get(weekKey) || { depression: [], anxiety: [] };
          bucket[e.metricKey].push(e.value as number);
          byWeek.set(weekKey, bucket);
        }

        const weeks = Array.from(byWeek.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-8)
          .map(([weekKey, vals]) => ({
            week: weekKey,
            depression: vals.depression.length ? vals.depression.reduce((x, y) => x + y, 0) / vals.depression.length : null,
            anxiety: vals.anxiety.length ? vals.anxiety.reduce((x, y) => x + y, 0) / vals.anxiety.length : null,
          }));

        setData(weeks);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load weekly trajectory');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card title="Weekly Emotional Trajectory" icon={<CalendarRange size={16} className="text-indigo-400" />}>
      {loading ? (
        <div className="text-sm text-neutral-400">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-300">{error}</div>
      ) : data.length === 0 ? (
        <div className="text-sm text-neutral-400">No weekly data yet.</div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="week" tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              <Bar name="Depression" dataKey="depression" fill="#3b82f6" />
              <Bar name="Anxiety" dataKey="anxiety" fill="#a855f7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="text-xs text-neutral-500 mt-3">Last 6–8 weeks, averaged per week (canonical wellbeingEntries).</div>
    </Card>
  );
};

export const EmotionalWellbeingDashboard: React.FC<Props> = ({ onOpenCheckIn, onNavigateWellbeingHistory }) => {
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
            return <ActionCards key={`${w.type}-${idx}`} />;
          case 'gratitudeJar':
            return <GratitudeJarCard key={`${w.type}-${idx}`} />;
          case 'emotionalTrend':
            return <EmotionalTrendCard key={`${w.type}-${idx}`} onNavigateWellbeingHistory={onNavigateWellbeingHistory} />;
          case 'weeklyTrajectory':
            return <WeeklyTrajectoryCard key={`${w.type}-${idx}`} />;
          default:
            return null;
        }
      })}

      {/* Minimal “legend” for what this persona is */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Brain size={16} className="text-blue-400" /> Depression
          </div>
          <div className="text-xs text-neutral-500 mt-1">Tracked morning/evening; chart shows daily average.</div>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Activity size={16} className="text-purple-400" /> Anxiety
          </div>
          <div className="text-xs text-neutral-500 mt-1">Tracked morning/evening; chart shows daily average.</div>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Battery size={16} className="text-emerald-400" /> Energy
          </div>
          <div className="text-xs text-neutral-500 mt-1">Optional; shown for context.</div>
        </div>
      </div>
    </div>
  );
};


