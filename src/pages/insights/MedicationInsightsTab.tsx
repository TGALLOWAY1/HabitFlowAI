import React, { useEffect, useState } from 'react';
import { Pill, Flame } from 'lucide-react';
import { fetchInsightsMedications, type MedicationInsights } from '../../lib/insightsClient';
import { CorrelationCard, CorrelationCaveat, SectionTitle, TabLoading, TabError, TabEmpty } from './insightsShared';

function adherenceColor(percent: number | null): string {
  if (percent === null) return 'text-neutral-400';
  if (percent >= 90) return 'text-emerald-400';
  if (percent >= 70) return 'text-amber-400';
  return 'text-rose-400';
}

export const MedicationInsightsTab: React.FC<{ days: number }> = ({ days }) => {
  const [data, setData] = useState<MedicationInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchInsightsMedications(days)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load medication insights');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) return <TabLoading label="Analyzing medications…" />;
  if (error) return <TabError message={error} />;

  if (!data || (data.adherence.length === 0 && data.correlations.length === 0)) {
    return (
      <TabEmpty
        title="No medication data yet"
        message="Add medications in the Health Hub and log them daily to see adherence and how they relate to your wellbeing."
      />
    );
  }

  return (
    <div className="space-y-8">
      {data.adherence.length > 0 && (
        <section>
          <SectionTitle icon={<Pill size={15} className="text-sky-400" />} hint="How consistently you've taken each medication this window.">
            Adherence
          </SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.adherence.map((a) => (
              <div key={a.medicationId} className="rounded-xl border border-white/5 bg-neutral-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{a.name}</div>
                    {a.dosage && <div className="text-[11px] text-neutral-500">{a.dosage}</div>}
                  </div>
                  <div className={`text-2xl font-bold ${adherenceColor(a.adherencePercent)}`}>
                    {a.adherencePercent === null ? '—' : `${a.adherencePercent}%`}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-neutral-500">
                  <span>
                    {a.takenDays}/{a.loggedDays} days taken
                  </span>
                  {a.currentTakenStreak > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Flame size={11} /> {a.currentTakenStreak}d streak
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle hint="How taking your medications relates to how you feel.">Medications ↔ wellbeing</SectionTitle>
        {data.correlations.length > 0 ? (
          <div className="space-y-4">
            <CorrelationCaveat />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.correlations.map((c) => (
                <CorrelationCard key={`${c.factorId}-${c.outcomeKey}`} correlation={c} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-neutral-500">
            Not enough variation yet to link medications to wellbeing. This needs days both with and without each
            medication logged.
          </div>
        )}
      </section>
    </div>
  );
};
