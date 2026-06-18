import React, { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, Wand2, History } from 'lucide-react';
import { hasGeminiApiKey, fetchWeeklyAIReview } from '../../lib/geminiClient';
import type { WeeklyAIReview } from '../../shared/weeklyAiReview';
import { WeeklyReviewBody } from './WeeklyReviewBody';
import { AIReportHistoryModal } from './AIReportHistoryModal';

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

export const WeeklyAIReviewCard: React.FC = () => {
  const [review, setReview] = useState<WeeklyAIReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState<WeekChoice>('this');
  const [showHistory, setShowHistory] = useState(false);

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

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-400" />
          <h3 className="text-lg font-semibold text-white">Weekly AI Review</h3>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => handleGenerate()}
            disabled={loading}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
            aria-label="Generate weekly review"
            title="Generate review"
          >
            <Wand2 size={16} />
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="View review history"
            title="History"
          >
            <History size={16} />
          </button>
        </div>
      </div>

      {showHistory && (
        <AIReportHistoryModal
          kind="weekly_review"
          title="Weekly Review"
          onClose={() => setShowHistory(false)}
        />
      )}

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
          <WeeklyReviewBody review={review} />

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
