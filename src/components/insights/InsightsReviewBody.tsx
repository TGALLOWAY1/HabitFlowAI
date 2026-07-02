import React from 'react';
import { Sparkles, LineChart, Lightbulb, Info, ClipboardList, Telescope } from 'lucide-react';
import type { InsightsAIReview } from '../../shared/insightsAiReview';
import type { ReviewConfidence } from '../../shared/weeklyAiReview';

const CONFIDENCE_STYLES: Record<ReviewConfidence, string> = {
  high: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
};

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h4 className="text-sm font-semibold text-white">{title}</h4>
    </div>
    {children}
  </div>
);

const Bullets: React.FC<{ items: string[]; dot?: string }> = ({ items, dot = 'text-neutral-500' }) => (
  <ul className="space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2 text-sm text-neutral-300">
        <span className={`${dot} mt-0.5`}>•</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

/** Renders a generated Insights AI Review. Reused by the AI Review tab, the AI hub card, and history. */
export const InsightsReviewBody: React.FC<{ review: InsightsAIReview }> = ({ review }) => (
  <div className="space-y-5">
    <p className="text-[11px] text-neutral-500">
      {review.rangeStart} to {review.rangeEnd} · {review.rangeDays}-day window
    </p>

    {review.summary && (
      <Section icon={<Sparkles size={15} className="text-indigo-400" />} title="Summary">
        <div className="space-y-2">
          {review.summary
            .split('\n')
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
            .map((p, i) => (
              <p key={i} className="text-sm text-neutral-200 leading-relaxed">
                {p}
              </p>
            ))}
        </div>
      </Section>
    )}

    {review.keyFindings.length > 0 && (
      <Section icon={<ClipboardList size={15} className="text-neutral-300" />} title="Key Findings">
        <Bullets items={review.keyFindings} />
      </Section>
    )}

    {review.patterns.length > 0 && (
      <Section icon={<LineChart size={15} className="text-sky-400" />} title="Patterns">
        <div className="space-y-2.5">
          {review.patterns.map((p, i) => (
            <div key={i} className="rounded-lg bg-white/5 border border-white/10 p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-white">{p.title}</span>
                <span className={`shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${CONFIDENCE_STYLES[p.confidence]}`}>
                  {p.confidence}
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{p.evidence}</p>
            </div>
          ))}
        </div>
      </Section>
    )}

    {review.outlook.length > 0 && (
      <Section icon={<Telescope size={15} className="text-purple-400" />} title="Outlook">
        <Bullets items={review.outlook} dot="text-purple-400" />
      </Section>
    )}

    {review.recommendations.length > 0 && (
      <Section icon={<Lightbulb size={15} className="text-indigo-400" />} title="Recommendations">
        <div className="space-y-2.5">
          {review.recommendations.map((r, i) => (
            <div key={i} className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-sm font-medium text-white mb-0.5">{r.title}</p>
              {r.reason && <p className="text-xs text-neutral-400 leading-relaxed">{r.reason}</p>}
              {r.suggestedAction && <p className="text-xs text-indigo-300 mt-1 leading-relaxed">→ {r.suggestedAction}</p>}
            </div>
          ))}
        </div>
      </Section>
    )}

    {review.dataLimitations.length > 0 && (
      <Section icon={<Info size={15} className="text-neutral-400" />} title="Data Limitations">
        <ul className="space-y-1.5">
          {review.dataLimitations.map((d, i) => (
            <li key={i} className="flex gap-2 text-xs text-neutral-400">
              <span className="text-neutral-500 mt-0.5">•</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </Section>
    )}
  </div>
);
