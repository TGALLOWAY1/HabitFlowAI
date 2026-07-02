import React, { useState } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { hasGeminiApiKey } from '../../lib/geminiClient';
import { fetchInsightsAIReview } from '../../lib/insightsClient';
import type { InsightsAIReview } from '../../shared/insightsAiReview';
import { InsightsReviewBody } from '../../components/insights/InsightsReviewBody';

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
          <InsightsReviewBody review={review} />
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
