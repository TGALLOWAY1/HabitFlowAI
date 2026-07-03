import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { hasGeminiApiKey } from '../../lib/geminiClient';
import { fetchInsightsAIReview } from '../../lib/insightsClient';
import { listAIReports, getAIReport } from '../../lib/aiReportsClient';
import type { InsightsAIReview } from '../../shared/insightsAiReview';
import type { InsightsReviewPayload } from '../../shared/aiReport';
import { InsightsReviewBody } from '../../components/insights/InsightsReviewBody';

export const AIReviewTab: React.FC<{ days: number }> = ({ days }) => {
  const [review, setReview] = useState<InsightsAIReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasKey = hasGeminiApiKey();

  // Load the most recent archived Insights review on mount. Reading history
  // needs no Gemini key, so this is what surfaces a review in the read-only
  // demo (where generation is blocked) and lets returning users see their last
  // review without spending another Gemini call.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await listAIReports('insights_review', 1);
        if (cancelled || items.length === 0) return;
        const full = await getAIReport(items[0].id);
        if (!cancelled) setReview((full.payload as InsightsReviewPayload).review);
      } catch {
        // Non-fatal: fall back to the generate/placeholder states below.
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (initialLoading) {
    return (
      <div className="flex items-center gap-3 py-4">
        <Loader2 size={18} className="text-indigo-400 animate-spin" />
        <span className="text-sm text-neutral-400">Loading AI review…</span>
      </div>
    );
  }

  // A review is available (archived or freshly generated) — show it. Regenerate
  // is only offered when a Gemini key is configured (never in the read-only demo).
  if (review) {
    return (
      <div className="space-y-5">
        <InsightsReviewBody review={review} />
        {hasKey && (
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Regenerate
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  // No archived review and no key — nothing we can show without BYOK.
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

  // Has a key but nothing archived yet — offer to generate the first review.
  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex items-center gap-3 py-4">
          <Loader2 size={18} className="text-indigo-400 animate-spin" />
          <span className="text-sm text-neutral-400">Analyzing your insights…</span>
        </div>
      ) : error ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button onClick={generate} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Try again
          </button>
        </div>
      ) : (
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
    </div>
  );
};
