import React from 'react';
import { TrendingUp, TrendingDown, Sparkles, Trophy, Info, Loader2 } from 'lucide-react';
import type { InsightsCorrelation, Discovery } from '../../lib/insightsClient';

/** Map |Cohen's d| to a plain-language strength label. */
export function effectSizeLabel(d: number): 'small' | 'moderate' | 'strong' {
  const abs = Math.abs(d);
  if (abs >= 0.8) return 'strong';
  if (abs >= 0.5) return 'moderate';
  return 'small';
}

/** Friendly label for a factor's source. */
export function sourceLabel(source: string): string {
  switch (source) {
    case 'habit':
      return 'Habit';
    case 'medication':
      return 'Medication';
    case 'supplement':
      return 'Supplement';
    case 'symptom':
      return 'Symptom';
    case 'wellbeingFactor':
      return 'Factor';
    default:
      return source;
  }
}

export const TabLoading: React.FC<{ label?: string }> = ({ label = 'Loading insights…' }) => (
  <div className="flex items-center gap-3 py-8 text-sm text-neutral-400">
    <Loader2 size={18} className="animate-spin text-emerald-400" />
    {label}
  </div>
);

export const TabError: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-300">{message}</div>
);

export const TabEmpty: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className="rounded-xl border border-white/5 bg-neutral-900/40 p-8 text-center">
    <div className="text-sm font-semibold text-white">{title}</div>
    <div className="mt-1 text-xs text-neutral-500">{message}</div>
  </div>
);

/** A single factor↔outcome correlation, rendered as a card. */
export const CorrelationCard: React.FC<{ correlation: InsightsCorrelation }> = ({ correlation: c }) => {
  const improves = c.direction === 'improves';
  const Icon = improves ? TrendingUp : TrendingDown;
  const accent = improves ? 'text-emerald-400' : 'text-rose-400';
  const ring = improves ? 'border-emerald-500/20' : 'border-rose-500/20';
  return (
    <div className={`rounded-xl border ${ring} bg-neutral-900/40 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={`${accent} shrink-0`} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {c.factorName} <span className="text-neutral-500 font-normal">→</span> {c.outcomeLabel}
            </div>
            <div className="text-[11px] text-neutral-500">{sourceLabel(c.factorSource)}</div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${improves ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
          {effectSizeLabel(c.effectSize)} {improves ? 'improvement' : 'decline'}
        </span>
      </div>
      <p className="mt-2 text-xs text-neutral-400 leading-relaxed">{c.message}</p>
    </div>
  );
};

/** A single discovery / milestone, rendered as a card. */
export const DiscoveryCard: React.FC<{ discovery: Discovery }> = ({ discovery: d }) => {
  const config = {
    positive: { Icon: TrendingUp, color: 'text-emerald-400', ring: 'border-emerald-500/20' },
    negative: { Icon: TrendingDown, color: 'text-rose-400', ring: 'border-rose-500/20' },
    milestone: { Icon: Trophy, color: 'text-amber-400', ring: 'border-amber-500/20' },
    info: { Icon: Info, color: 'text-sky-400', ring: 'border-sky-500/20' },
  }[d.type];
  const { Icon, color, ring } = config;
  return (
    <div className={`rounded-xl border ${ring} bg-neutral-900/40 p-4`}>
      <div className="flex items-center gap-2">
        <Icon size={16} className={color} />
        <div className="text-sm font-semibold text-white">{d.title}</div>
      </div>
      <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed">{d.message}</p>
    </div>
  );
};

/** Section heading used across tabs. */
export const SectionTitle: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; hint?: string }> = ({
  icon,
  children,
  hint,
}) => (
  <div className="mb-3">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-semibold text-white">{children}</h3>
    </div>
    {hint && <div className="text-[11px] text-neutral-500 mt-0.5">{hint}</div>}
  </div>
);

export const CorrelationCaveat: React.FC = () => (
  <div className="flex items-start gap-2 rounded-lg bg-neutral-800/40 border border-white/5 p-3 text-[11px] text-neutral-500">
    <Sparkles size={13} className="mt-0.5 shrink-0 text-neutral-400" />
    <span>
      These are statistical correlations from your own check-ins, not proof of cause and effect. More data means
      sharper signals.
    </span>
  </div>
);
