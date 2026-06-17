import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Trophy,
  AlertTriangle,
  LineChart,
  Lightbulb,
  Info,
  RefreshCw,
} from 'lucide-react';
import { hasGeminiApiKey, fetchWeeklyAIReview } from '../../lib/geminiClient';
import type { WeeklyAIReview, ReviewConfidence } from '../../shared/weeklyAiReview';

type WeekChoice = 'this' | 'last';

/** Monday (local) of the current week, optionally going back `weeksAgo` weeks. */
function mondayOf(weeksAgo: number): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday - weeksAgo * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

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

export const WeeklyAIReviewCard: React.FC = () => {
  const [review, setReview] = useState<WeeklyAIReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState<WeekChoice>('this');

  const hasKey = hasGeminiApiKey();

  const handleGenerate = async (choice: WeekChoice = week) => {
    setLoading(true);
    setError(null);
    try {
      const weekStart = mondayOf(choice === 'this' ? 0 : 1);
      const result = await fetchWeeklyAIReview(weekStart);
      setReview(result.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate weekly review');
    } finally {
      setLoading(false);
    }
  };

  const selectWeek = (choice: WeekChoice) => {
    setWeek(choice);
    setReview(null);
    setError(null);
  };

  if (!hasKey) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-indigo-400" />
          <h3 className="text-lg font-semibold text-white">Weekly AI Review</h3>
        </div>
        <p className="text-sm text-neutral-400">
          Add your Gemini API key in Settings to generate a grounded, data-driven review of your week.
        </p>
      </div>
    );
  }

  const isEmptyReview =
    review &&
    review.wins.length === 0 &&
    review.struggles.length === 0 &&
    review.patterns.length === 0 &&
    review.recommendations.length === 0;

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-400" />
          <h3 className="text-lg font-semibold text-white">Weekly AI Review</h3>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
          {(['this', 'last'] as WeekChoice[]).map((choice) => (
            <button
              key={choice}
              onClick={() => selectWeek(choice)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                week === choice ? 'bg-indigo-600/80 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {choice === 'this' ? 'This week' : 'Last week'}
            </button>
          ))}
        </div>
      </div>

      {/* Idle / empty-of-results */}
      {!review && !loading && !error && (
        <div>
          <p className="text-sm text-neutral-400 mb-4">
            Generate a grounded review of your habits, sleep, mood, journaling, and goals. Facts,
            patterns, and recommendations are kept separate so the feedback stays honest.
          </p>
          <button
            onClick={() => handleGenerate()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600/80 text-white hover:bg-indigo-600 text-sm font-medium transition-colors"
          >
            <Sparkles size={14} />
            Generate Weekly Review
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-4">
          <Loader2 size={18} className="text-indigo-400 animate-spin" />
          <span className="text-sm text-neutral-400">Analyzing your week…</span>
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button
            onClick={() => handleGenerate()}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {review && (
        <div className="space-y-5">
          <p className="text-[11px] text-neutral-500">
            {review.weekStart} to {review.weekEnd}
          </p>

          {isEmptyReview ? (
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              <p className="text-sm text-neutral-300">
                There isn’t enough data this week to produce a confident review.
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              {review.summary && (
                <p className="text-sm text-neutral-200 leading-relaxed">{review.summary}</p>
              )}

              {/* Wins */}
              {review.wins.length > 0 && (
                <Section
                  icon={<Trophy size={15} className="text-emerald-400" />}
                  title="Wins"
                >
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

              {/* Struggles */}
              {review.struggles.length > 0 && (
                <Section
                  icon={<AlertTriangle size={15} className="text-amber-400" />}
                  title="Struggles"
                >
                  <ul className="space-y-1.5">
                    {review.struggles.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-neutral-300">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Patterns */}
              {review.patterns.length > 0 && (
                <Section
                  icon={<LineChart size={15} className="text-sky-400" />}
                  title="Patterns Detected"
                >
                  <div className="space-y-2.5">
                    {review.patterns.map((p, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-white/5 border border-white/10 p-3"
                      >
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

              {/* Recommendations */}
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

          {/* Data limitations — always shown when present */}
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

          <div className="pt-2 border-t border-white/5">
            <button
              onClick={() => handleGenerate()}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
