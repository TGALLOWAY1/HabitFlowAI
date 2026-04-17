import React, { useState } from 'react';
import { Sparkles, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { hasGeminiApiKey, fetchWeeklySummary } from '../../lib/geminiClient';

export const WeeklySummaryCard: React.FC = () => {
  const [summary, setSummary] = useState<string | null>(null);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const hasKey = hasGeminiApiKey();

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWeeklySummary();
      setSummary(result.summary);
      setPeriod(result.period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  // No key configured — hide the card entirely
  if (!hasKey) {
    return null;
  }

  return (
    <div className="bg-surface-0/50 rounded-2xl border border-line-subtle p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-purple-400" />
          <h3 className="text-lg font-semibold text-content-primary">AI Weekly Summary</h3>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-content-muted hover:text-content-primary rounded-lg hover:bg-surface-2 transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          {summary && (
            <button
              onClick={() => {
                setSummary(null);
                setPeriod(null);
                setError(null);
              }}
              className="p-1.5 text-content-muted hover:text-content-primary rounded-lg hover:bg-surface-2 transition-colors"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {!summary && !loading && !error && (
        <div>
          <p className="text-sm text-content-secondary mb-4">
            Generate a personalized summary of your past week's habits and journal entries.
          </p>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600/80 text-content-primary hover:bg-purple-600 text-sm font-medium transition-colors"
          >
            <Sparkles size={14} />
            Generate Weekly Summary
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-4">
          <Loader2 size={18} className="text-purple-400 animate-spin" />
          <span className="text-sm text-content-secondary">Analyzing your week...</span>
        </div>
      )}

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

      {summary && expanded && (
        <div className="space-y-3">
          {period && (
            <p className="text-[11px] text-content-muted">
              {period.start} to {period.end}
            </p>
          )}
          <div className="prose prose-sm prose-invert max-w-none text-content-secondary leading-relaxed [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-content-primary [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-content-primary [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-content-primary [&_strong]:text-content-primary [&_ul]:space-y-1 [&_li]:text-sm">
            {summary.split('\n').map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              // Basic markdown rendering for bold and headers
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
          <div className="pt-2 border-t border-line-subtle">
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
};
