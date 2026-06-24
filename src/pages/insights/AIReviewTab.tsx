import React, { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, LineChart, Lightbulb, Info, ClipboardList, Telescope } from 'lucide-react';
import { hasGeminiApiKey } from '../../lib/geminiClient';
import { fetchInsightsAIReview } from '../../lib/insightsClient';
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

const ReviewBody: React.FC<{ review: InsightsAIReview }> = ({ review }) => (
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

export const AIReviewTab: React.FC<{ days: number }> = ({ days }) => {
  const [review, setReview] = useState<InsightsAIReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasKey = hasGeminiApiKey();

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchInsightsAIReview(days);
      setReview(result.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights review');
    } finally {
      setLoading(false);
    }
  };

  if (!hasKey) {
    return (
      <div className="rounded-xl border border-white/5 bg-neutral-900/40 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-indigo-400" />
          <h3 className="text-base font-semibold text-white">AI Review</h3>
        </div>
        <p className="text-sm text-neutral-400">
          Add your Gemini API key in Settings to generate a grounded, plain-language review of your insights.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!review && !loading && !error && (
        <div className="rounded-xl border border-white/5 bg-neutral-900/40 p-6">
          <p className="text-sm text-neutral-400 mb-4">
            Turn your computed correlations and trend predictions into a clear, forward-looking narrative — grounded in
            your data, framed as correlation (never causation), with small, realistic suggestions.
          </p>
          <button
            onClick={generate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600/80 text-white hover:bg-indigo-600 text-sm font-medium transition-colors"
          >
            <Sparkles size={14} />
            Generate AI Review
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-4">
          <Loader2 size={18} className="text-indigo-400 animate-spin" />
          <span className="text-sm text-neutral-400">Analyzing your insights…</span>
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button onClick={generate} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Try again
          </button>
        </div>
      )}

      {review && (
        <>
          <ReviewBody review={review} />
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={generate}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  );
};
