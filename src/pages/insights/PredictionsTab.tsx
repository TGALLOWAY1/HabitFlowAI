import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchInsightsPredictions, type MetricPrediction } from '../../lib/insightsClient';
import { SectionTitle, TabLoading, TabError, TabEmpty } from './insightsShared';

/** Minimal inline sparkline for a metric's observed daily values. */
const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  if (values.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const confidenceBadge: Record<MetricPrediction['confidence'], string> = {
  high: 'bg-emerald-500/10 text-emerald-300',
  medium: 'bg-amber-500/10 text-amber-300',
  low: 'bg-neutral-700/40 text-neutral-400',
};

const PredictionCard: React.FC<{ prediction: MetricPrediction }> = ({ prediction: p }) => {
  const improving = p.direction === 'improving';
  const declining = p.direction === 'declining';
  const Icon = improving ? TrendingUp : declining ? TrendingDown : Minus;
  const accent = improving ? 'text-emerald-400' : declining ? 'text-rose-400' : 'text-neutral-400';
  const strokeColor = improving ? '#34d399' : declining ? '#fb7185' : '#a3a3a3';

  return (
    <div className="rounded-xl border border-white/5 bg-neutral-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className={accent} />
          <div className="text-sm font-semibold text-white capitalize">{p.label}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${confidenceBadge[p.confidence]}`}>
          {p.confidence} confidence
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{p.currentValue ?? '—'}</span>
            {p.predictedValue !== null && (
              <span className="text-sm text-neutral-400">
                <span className="text-neutral-600">→</span> {p.predictedValue}
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            now → projected in {p.horizonDays}d
            {p.slopePerWeek !== null && p.slopePerWeek !== 0 && (
              <> · {p.slopePerWeek > 0 ? '+' : ''}{p.slopePerWeek}/week</>
            )}
          </div>
        </div>
        <Sparkline values={p.trend.map((t) => t.value)} color={strokeColor} />
      </div>

      <div className="mt-2 text-[10px] text-neutral-600">{p.sampleSize} days of data</div>
    </div>
  );
};

export const PredictionsTab: React.FC<{ days: number }> = ({ days }) => {
  const [predictions, setPredictions] = useState<MetricPrediction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchInsightsPredictions(days)
      .then((data) => {
        if (!cancelled) setPredictions(data.predictions);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load predictions');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) return <TabLoading label="Projecting trends…" />;
  if (error) return <TabError message={error} />;

  const usable = (predictions ?? []).filter((p) => p.predictedValue !== null);
  if (usable.length === 0) {
    return (
      <TabEmpty
        title="Not enough data to predict"
        message="Predictions need at least a handful of logged days for a metric. Keep checking in and trends will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-neutral-800/40 border border-white/5 p-3 text-[11px] text-neutral-500">
        Simple linear projections from your recent check-ins — a guide to where things are heading, not a guarantee.
      </div>
      <SectionTitle hint="Projected value if your current trend continues.">Trend projections</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {usable.map((p) => (
          <PredictionCard key={p.metricKey} prediction={p} />
        ))}
      </div>
    </div>
  );
};
