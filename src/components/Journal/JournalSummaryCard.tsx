import { useState } from 'react';
import { Sparkles, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { hasGeminiApiKey, fetchJournalSummary } from '../../lib/geminiClient';

interface JournalSummaryCardProps {
  compact?: boolean;
}

export function JournalSummaryCard({ compact }: JournalSummaryCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [entryCount, setEntryCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const hasKey = hasGeminiApiKey();

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJournalSummary();
      setSummary(result.summary);
      setPeriod(result.period);
      setEntryCount(result.journalEntriesCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate journal summary');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setSummary(null);
    setPeriod(null);
    setError(null);
  };

  // No key — show setup prompt in full mode, hide in compact (dashboard)
  if (!hasKey) {
    if (compact) return null;
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Journal Summary</h3>
        </div>
        <p className="text-sm text-neutral-400">
          Add your Gemini API key in Settings to unlock AI-powered weekly journal summaries with themes, highlights, and actionable feedback.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-purple-400" />
          <h3 className={`font-semibold text-white ${compact ? 'text-base' : 'text-lg'}`}>
            {compact ? 'Journal Summary' : 'Weekly Journal Summary'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          {summary && (
            <button
              onClick={handleDismiss}
              className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Idle state */}
      {!summary && !loading && !error && (
        <div>
          <p className="text-sm text-neutral-400 mb-4">
            {compact
              ? 'Get AI-powered insights from your recent journal entries.'
              : 'Generate a personalized summary of your past week\'s journal entries — themes, highlights, feedback, and follow-up reminders.'}
          </p>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600/80 text-white hover:bg-purple-600 text-sm font-medium transition-colors"
          >
            <Sparkles size={14} />
            Generate Journal Summary
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-4">
          <Loader2 size={18} className="text-purple-400 animate-spin" />
          <span className="text-sm text-neutral-400">Analyzing your journal entries...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="space-y-3">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button
            onClick={handleGenerate}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary result */}
      {summary && expanded && (
        <div className="space-y-3">
          {period && (
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-neutral-500">
                {period.start} to {period.end}
              </p>
              {entryCount > 0 && (
                <p className="text-[11px] text-neutral-500">
                  {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                </p>
              )}
            </div>
          )}
          <div className="prose prose-sm prose-invert max-w-none text-neutral-300 leading-relaxed [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-white [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-neutral-200 [&_strong]:text-white [&_ul]:space-y-1 [&_li]:text-sm">
            {summary.split('\n').map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              const formatted = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/^### (.*)/, '<h3>$1</h3>')
                .replace(/^## (.*)/, '<h2>$1</h2>')
                .replace(/^# (.*)/, '<h1>$1</h1>')
                .replace(/^[*-] (.*)/, '<li>$1</li>');
              return (
                <div key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
              );
            })}
          </div>
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={handleGenerate}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
