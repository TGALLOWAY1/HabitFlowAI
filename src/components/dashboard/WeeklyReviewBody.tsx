import React from 'react';
import {
  Sparkles,
  Trophy,
  AlertTriangle,
  LineChart,
  Lightbulb,
  Info,
  ClipboardList,
  BookOpen,
} from 'lucide-react';
import type { WeeklyAIReview, ReviewConfidence } from '../../shared/weeklyAiReview';

const CONFIDENCE_STYLES: Record<ReviewConfidence, string> = {
  high: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
};

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h4 className="text-sm font-semibold text-white">{title}</h4>
    </div>
    {children}
  </div>
);

function isEmpty(review: WeeklyAIReview): boolean {
  return (
    !review.summary &&
    review.facts.length === 0 &&
    review.wins.length === 0 &&
    review.areasForAttention.length === 0 &&
    review.patterns.length === 0 &&
    review.journalThemes.length === 0 &&
    review.recommendations.length === 0
  );
}

/**
 * Presentational rendering of a Weekly AI Review. Shared by the dashboard card
 * (live generation) and the history modal (archived reports) so both stay in sync.
 */
export const WeeklyReviewBody: React.FC<{ review: WeeklyAIReview }> = ({ review }) => {
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-neutral-500">
        {review.weekStart} to {review.weekEnd}
      </p>

      {isEmpty(review) ? (
        <div className="rounded-lg bg-white/5 border border-white/10 p-4">
          <p className="text-sm text-neutral-300">
            There isn’t enough data this week to produce a confident review.
          </p>
        </div>
      ) : (
        <>
          {review.summary && (
            <Section
              icon={<Sparkles size={15} className="text-indigo-400" />}
              title="Week at a Glance"
            >
              <div className="space-y-2">
                {review.summary
                  .split('\n')
                  .map((para) => para.trim())
                  .filter((para) => para.length > 0)
                  .map((para, i) => (
                    <p key={i} className="text-sm text-neutral-200 leading-relaxed">
                      {para}
                    </p>
                  ))}
              </div>
            </Section>
          )}

          {review.facts.length > 0 && (
            <Section icon={<ClipboardList size={15} className="text-neutral-300" />} title="Facts">
              <ul className="space-y-1.5">
                {review.facts.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-neutral-300">
                    <span className="text-neutral-500 mt-0.5">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {review.patterns.length > 0 && (
            <Section icon={<LineChart size={15} className="text-sky-400" />} title="Patterns">
              <div className="space-y-2.5">
                {review.patterns.map((p, i) => (
                  <div key={i} className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{p.title}</span>
                      <span
                        className={`shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${CONFIDENCE_STYLES[p.confidence]}`}
                      >
                        {p.confidence}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{p.evidence}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {review.journalThemes.length > 0 && (
            <Section icon={<BookOpen size={15} className="text-purple-400" />} title="Journal Themes">
              <ul className="space-y-1.5">
                {review.journalThemes.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-neutral-300">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {review.wins.length > 0 && (
            <Section icon={<Trophy size={15} className="text-emerald-400" />} title="Wins">
              <ul className="space-y-1.5">
                {review.wins.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-neutral-300">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {review.areasForAttention.length > 0 && (
            <Section
              icon={<AlertTriangle size={15} className="text-amber-400" />}
              title="Areas for Attention"
            >
              <ul className="space-y-1.5">
                {review.areasForAttention.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-neutral-300">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {review.recommendations.length > 0 && (
            <Section
              icon={<Lightbulb size={15} className="text-indigo-400" />}
              title="Recommendations for Next Week"
            >
              <div className="space-y-2.5">
                {review.recommendations.map((r, i) => (
                  <div key={i} className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <p className="text-sm font-medium text-white mb-0.5">{r.title}</p>
                    {r.reason && (
                      <p className="text-xs text-neutral-400 leading-relaxed">{r.reason}</p>
                    )}
                    {r.suggestedAction && (
                      <p className="text-xs text-indigo-300 mt-1 leading-relaxed">
                        → {r.suggestedAction}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
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
};
