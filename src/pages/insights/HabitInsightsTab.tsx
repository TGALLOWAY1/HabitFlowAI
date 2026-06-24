import React, { useEffect, useState } from 'react';
import { Flame, Target, CheckCircle2, Trophy } from 'lucide-react';
import { fetchInsightsHabits, type InsightsCorrelation } from '../../lib/insightsClient';
import { fetchHabitSummary, type HabitAnalyticsSummary } from '../../lib/analyticsClient';
import { CorrelationCard, CorrelationCaveat, SectionTitle, TabLoading, TabError, TabEmpty } from './insightsShared';

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
  <div className="rounded-xl border border-white/5 bg-neutral-900/40 p-3">
    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
      {icon}
      {label}
    </div>
    <div className="text-xl font-bold text-white mt-1">{value}</div>
  </div>
);

export const HabitInsightsTab: React.FC<{ days: number }> = ({ days }) => {
  const [summary, setSummary] = useState<HabitAnalyticsSummary | null>(null);
  const [correlations, setCorrelations] = useState<InsightsCorrelation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchHabitSummary(days), fetchInsightsHabits(days)])
      .then(([s, h]) => {
        if (!cancelled) {
          setSummary(s);
          setCorrelations(h.correlations);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load habit insights');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) return <TabLoading label="Analyzing habits…" />;
  if (error) return <TabError message={error} />;

  return (
    <div className="space-y-8">
      {summary && (
        <section>
          <SectionTitle hint="Your habit performance over this window.">Habit performance</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Target size={12} />} label="Consistency" value={`${summary.consistencyScore}%`} />
            <StatCard icon={<CheckCircle2 size={12} />} label="Completion" value={`${summary.completionRate}%`} />
            <StatCard icon={<Flame size={12} />} label="Current streak" value={`${summary.currentStreak}d`} />
            <StatCard icon={<Trophy size={12} />} label="Longest streak" value={`${summary.longestStreak}d`} />
          </div>
        </section>
      )}

      <section>
        <SectionTitle hint="How your habits relate to how you feel.">Habits ↔ wellbeing</SectionTitle>
        {correlations && correlations.length > 0 ? (
          <div className="space-y-4">
            <CorrelationCaveat />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {correlations.map((c) => (
                <CorrelationCard key={`${c.factorId}-${c.outcomeKey}`} correlation={c} />
              ))}
            </div>
          </div>
        ) : (
          <TabEmpty
            title="No habit↔wellbeing links yet"
            message="Keep logging habits alongside your check-ins and the relationships will show up here."
          />
        )}
      </section>
    </div>
  );
};
