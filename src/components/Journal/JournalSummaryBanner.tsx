import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { hasGeminiApiKey, fetchJournalSummary, fetchLatestJournalSummaryEntry } from '../../lib/geminiClient';
import type { JournalEntry } from '../../models/persistenceTypes';

const DISMISSED_KEY = 'hf_summary_banner_dismissed';

export function JournalSummaryBanner() {
  const [summary, setSummary] = useState<string | null>(null);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [entryCount, setEntryCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [summaryDate, setSummaryDate] = useState<string | null>(null);

  const hasKey = hasGeminiApiKey();

  const populateFromEntry = useCallback((entry: JournalEntry) => {
    setSummary(entry.content.summary ?? null);
    setSummaryDate(entry.date);
    // Period/entryCount not stored on the entry — show what we have
    setPeriod(null);
    setEntryCount(0);
  }, []);

  useEffect(() => {
    if (!hasKey) return;

    // Check if we already dismissed this week's summary
    const dismissedDate = localStorage.getItem(DISMISSED_KEY);

    let cancelled = false;

    async function init() {
      // Check for existing recent summary
      try {
        const existing = await fetchLatestJournalSummaryEntry();
        if (cancelled) return;

        if (existing) {
          // Already have a recent summary — show it (unless dismissed)
          if (dismissedDate === existing.date) {
            setDismissed(true);
            return;
          }
          populateFromEntry(existing);
          return;
        }

        // No recent summary — auto-generate
        setLoading(true);
        const result = await fetchJournalSummary();
        if (cancelled) return;
        setSummary(result.summary);
        setPeriod(result.period);
        setEntryCount(result.journalEntriesCount);
        setSummaryDate(result.period.end);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to generate journal summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [hasKey, populateFromEntry]);

  const handleDismiss = () => {
    if (summaryDate) {
      localStorage.setItem(DISMISSED_KEY, summaryDate);
    }
    setDismissed(true);
  };

  // Don't render if: no API key, dismissed, or nothing to show yet (no loading/error/summary)
  if (!hasKey || (dismissed && !loading)) return null;
  if (!loading && !error && !summary) return null;

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-purple-500/20 p-4 sm:p-5 backdrop-blur-sm mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Weekly Journal Summary</h3>
        </div>
        <div className="flex items-center gap-1">
          {summary && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {(summary || error) && (
            <button
              onClick={handleDismiss}
              className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-2">
          <Loader2 size={16} className="text-purple-400 animate-spin" />
          <span className="text-sm text-neutral-400">Generating your weekly summary...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Summary content */}
      {summary && expanded && !loading && (
        <div className="space-y-2">
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
        </div>
      )}
    </div>
  );
}
