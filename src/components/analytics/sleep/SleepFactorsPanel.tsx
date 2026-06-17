import React from 'react';
import { Lightbulb, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { SleepAnalyticsSummary } from '../../../lib/analyticsClient';

interface Props {
  data: SleepAnalyticsSummary | null;
  loading: boolean;
}

export const SleepFactorsPanel: React.FC<Props> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Top Factors Impacting Sleep</h3>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-neutral-800 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const factors = data.topFactors;
  const maxEffect = factors.reduce((m, f) => Math.max(m, Math.abs(f.effectSize)), 0) || 1;

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={16} className="text-amber-400" />
        <h3 className="text-sm font-medium text-neutral-200">Top Factors Impacting Sleep</h3>
      </div>

      {factors.length === 0 ? (
        <p className="text-neutral-500 text-sm">
          Not enough overlapping data yet. Keep logging your nightly habits — factors appear once a habit has at least 5 nights in each group.
        </p>
      ) : (
        <div className="space-y-3">
          {factors.map((f) => {
            const improves = f.direction === 'improves';
            const color = improves ? 'bg-emerald-500' : 'bg-red-500';
            const textColor = improves ? 'text-emerald-400' : 'text-red-400';
            const width = `${Math.max(8, Math.round((Math.abs(f.effectSize) / maxEffect) * 100))}%`;
            return (
              <div key={`${f.factorId}-${f.outcome}`} className="bg-neutral-800/40 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white flex items-center gap-1.5">
                    {improves ? <ArrowUpRight size={14} className={textColor} /> : <ArrowDownRight size={14} className={textColor} />}
                    {f.factorName}
                  </span>
                  <span className="text-[11px] text-neutral-500 shrink-0">n={f.nPresent} vs {f.nAbsent}</span>
                </div>
                <div className="h-1.5 bg-neutral-700/50 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width }} />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1.5 leading-snug">{f.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
