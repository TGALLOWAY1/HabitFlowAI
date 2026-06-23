import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fetchInsightsCorrelations, type InsightsCorrelation } from '../../lib/insightsClient';
import { CorrelationCard, CorrelationCaveat, SectionTitle, TabLoading, TabError, TabEmpty } from './insightsShared';

export const CorrelationsTab: React.FC<{ days: number }> = ({ days }) => {
  const [correlations, setCorrelations] = useState<InsightsCorrelation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchInsightsCorrelations(days)
      .then((data) => {
        if (!cancelled) setCorrelations(data.correlations);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load correlations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) return <TabLoading label="Computing correlations…" />;
  if (error) return <TabError message={error} />;
  if (!correlations || correlations.length === 0) {
    return (
      <TabEmpty
        title="No correlations yet"
        message="Once you've logged enough check-ins alongside habits, medications, or health factors, the strongest relationships will appear here."
      />
    );
  }

  const improving = correlations.filter((c) => c.direction === 'improves');
  const worsening = correlations.filter((c) => c.direction === 'worsens');

  return (
    <div className="space-y-8">
      <CorrelationCaveat />

      {improving.length > 0 && (
        <section>
          <SectionTitle icon={<TrendingUp size={15} className="text-emerald-400" />} hint="Factors linked to better outcomes.">
            What's helping
          </SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {improving.map((c) => (
              <CorrelationCard key={`${c.factorId}-${c.outcomeKey}`} correlation={c} />
            ))}
          </div>
        </section>
      )}

      {worsening.length > 0 && (
        <section>
          <SectionTitle icon={<TrendingDown size={15} className="text-rose-400" />} hint="Factors linked to worse outcomes.">
            What's holding you back
          </SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {worsening.map((c) => (
              <CorrelationCard key={`${c.factorId}-${c.outcomeKey}`} correlation={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
