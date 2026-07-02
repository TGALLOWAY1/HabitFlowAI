import React, { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, History } from 'lucide-react';
import { hasGeminiApiKey, fetchJournalReview } from '../../lib/geminiClient';
import type { AIJournalReview } from '../../shared/aiJournalReview';
import { JournalReviewBody } from './JournalReviewBody';
import { AIReportHistoryModal } from '../dashboard/AIReportHistoryModal';
import { LastGeneratedLine, useLastGenerated } from '../dashboard/lastGenerated';

/** Local YYYY-MM-DD for today, optionally going back `daysAgo` days. */
function dayKey(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

type RangePreset = '7' | '30' | 'custom';

export const JournalReviewPanel: React.FC = () => {
  const [review, setReview] = useState<AIJournalReview | null>(null);
  const [lowData, setLowData] = useState(false);
  const [entriesCount, setEntriesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<RangePreset>('7');
  const [start, setStart] = useState(() => dayKey(6));
  const [end, setEnd] = useState(() => dayKey(0));
  const [showHistory, setShowHistory] = useState(false);
  const [genCount, setGenCount] = useState(0);

  const hasKey = hasGeminiApiKey();
  const lastGenerated = useLastGenerated('journal_review', genCount);

  const applyPreset = (next: RangePreset) => {
    setPreset(next);
    setReview(null);
    setError(null);
    if (next === '7') {
      setStart(dayKey(6));
      setEnd(dayKey(0));
    } else if (next === '30') {
      setStart(dayKey(29));
      setEnd(dayKey(0));
    }
  };

  const handleGenerate = async () => {
    if (!start || !end) {
      setError('Please choose a start and end date.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJournalReview(start, end);
      setReview(result.review);
      setLowData(result.meta.lowData);
      setEntriesCount(result.meta.journalEntriesCount);
      if (result.meta.journalEntriesCount > 0) setGenCount((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate journal review');
    } finally {
      setLoading(false);
    }
  };

  const historyButton = (
    <button
      onClick={() => setShowHistory(true)}
      className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
      aria-label="View journal review history"
      title="History"
    >
      <History size={16} />
    </button>
  );

  const historyModal = showHistory && (
    <AIReportHistoryModal
      kind="journal_review"
      title="Journal Insights"
      onClose={() => setShowHistory(false)}
    />
  );

  // ---- No API key ----
  if (!hasKey) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">AI Journal Review</h3>
          </div>
          {historyButton}
        </div>
        <LastGeneratedLine createdAt={lastGenerated} />
        <p className="text-sm text-neutral-400 mt-1">
          Add your Gemini API key in Settings to generate a grounded, supportive review of your
          journal entries over any date range. Past reviews stay readable from the history{' '}
          <History size={12} className="inline" aria-hidden="true" /> at any time.
        </p>
        {historyModal}
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 sm:p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-400" />
          <h3 className="text-lg font-semibold text-white">AI Journal Review</h3>
        </div>
        {historyButton}
      </div>
      <LastGeneratedLine createdAt={lastGenerated} />
      <p className="text-sm text-neutral-400 mb-4 mt-1">
        A grounded look at emotional themes, recurring stressors, wins, and self-talk across your own
        entries — with reflection questions and small next steps. Supportive, not clinical.
      </p>
      {historyModal}

      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
          {([
            ['7', 'Last 7 days'],
            ['30', 'Last 30 days'],
            ['custom', 'Custom'],
          ] as [RangePreset, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => applyPreset(value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                preset === value ? 'bg-indigo-600/80 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => {
              setStart(e.target.value);
              setReview(null);
            }}
            className="bg-neutral-800 text-xs text-neutral-300 border border-white/5 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <span className="text-neutral-400 text-xs">to</span>
          <input
            type="date"
            value={end}
            min={start || undefined}
            max={dayKey(0)}
            onChange={(e) => {
              setEnd(e.target.value);
              setReview(null);
            }}
            className="bg-neutral-800 text-xs text-neutral-300 border border-white/5 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
        </div>
      )}

      {/* Generate button (hidden once a review is shown — Regenerate lives at the bottom) */}
      {!review && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600/80 text-white hover:bg-indigo-600 text-sm font-medium transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Analyzing your entries…' : 'Generate Review'}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 space-y-3">
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

      {/* Result */}
      {review && (
        <div className="mt-4 space-y-5">
          <JournalReviewBody review={review} entriesCount={entriesCount} lowData={lowData} />

          {/* Regenerate */}
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {loading ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
