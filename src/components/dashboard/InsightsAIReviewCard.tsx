import React, { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, Wand2, History } from 'lucide-react';
import { hasGeminiApiKey } from '../../lib/geminiClient';
import { fetchInsightsAIReview } from '../../lib/insightsClient';
import type { InsightsAIReview } from '../../shared/insightsAiReview';
import { InsightsReviewBody } from '../insights/InsightsReviewBody';
import { AIReportHistoryModal } from './AIReportHistoryModal';
import { LastGeneratedLine, useLastGenerated } from './lastGenerated';

/** Days of cross-domain data the review analyzes. */
const REVIEW_WINDOW_DAYS = 90;

/**
 * Wellbeing Summary — the Insights AI Review as a self-contained card.
 * Mirrors WeeklyAIReviewCard so it slots into the AI hub modal alongside it.
 */
export const InsightsAIReviewCard: React.FC = () => {
  const [review, setReview] = useState<InsightsAIReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [genCount, setGenCount] = useState(0);

  const hasKey = hasGeminiApiKey();
  const lastGenerated = useLastGenerated('insights_review', genCount);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchInsightsAIReview(REVIEW_WINDOW_DAYS);
      setReview(result.review);
      setGenCount((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate wellbeing summary');
    } finally {
      setLoading(false);
    }
  };

  const header = (
    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-indigo-400" />
        <h3 className="text-lg font-semibold text-white">Wellbeing Summary</h3>
      </div>
      <div className="flex items-center gap-2">
        {hasKey && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
            aria-label="Generate wellbeing summary"
            title="Generate summary"
          >
            <Wand2 size={16} />
          </button>
        )}
        <button
          onClick={() => setShowHistory(true)}
          className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label="View summary history"
          title="History"
        >
          <History size={16} />
        </button>
      </div>
    </div>
  );

  const historyModal = showHistory && (
    <AIReportHistoryModal
      kind="insights_review"
      title="Wellbeing Summary"
      onClose={() => setShowHistory(false)}
    />
  );

  if (!hasKey) {
    // Reading archived reports never needs an API key — keep history reachable.
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
        {header}
        <LastGeneratedLine createdAt={lastGenerated} />
        <p className="text-sm text-neutral-400 mt-1">
          Add your Gemini API key in Settings to generate a grounded summary of your correlations,
          trends, and wellbeing patterns. Past summaries stay readable from the history{' '}
          <History size={12} className="inline" aria-hidden="true" /> at any time.
        </p>
        {historyModal}
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
      {header}
      <LastGeneratedLine createdAt={lastGenerated} />
      {historyModal}

      {!review && !loading && !error && (
        <div className="mt-1">
          <p className="text-sm text-neutral-400 mb-4">
            Turn your computed correlations and trend predictions into a clear, forward-looking
            narrative — grounded in your data, framed as correlation (never causation), with small,
            realistic suggestions.
          </p>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600/80 text-white hover:bg-indigo-600 text-sm font-medium transition-colors"
          >
            <Sparkles size={14} />
            Generate Wellbeing Summary
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
        <div className="space-y-3 mt-1">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button
            onClick={handleGenerate}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {review && (
        <div className="space-y-5 mt-3">
          <InsightsReviewBody review={review} />

          <div className="pt-2 border-t border-white/5">
            <button
              onClick={handleGenerate}
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
