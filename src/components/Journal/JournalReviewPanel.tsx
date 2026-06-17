import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Heart,
  AlertTriangle,
  Trophy,
  MessageCircle,
  HelpCircle,
  Lightbulb,
  Info,
  RefreshCw,
  BookOpen,
  LifeBuoy,
} from 'lucide-react';
import { hasGeminiApiKey, fetchJournalReview } from '../../lib/geminiClient';
import type { AIJournalReview, ReviewConfidence } from '../../shared/aiJournalReview';

/** Local YYYY-MM-DD for today, optionally going back `daysAgo` days. */
function dayKey(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
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

const ConfidenceBadge: React.FC<{ confidence: ReviewConfidence }> = ({ confidence }) => (
  <span
    className={`shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${CONFIDENCE_STYLES[confidence]}`}
  >
    {confidence}
  </span>
);

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div>
    <div className="flex items-center gap-2 mb-2.5">
      {icon}
      <h4 className="text-sm font-semibold text-white">{title}</h4>
    </div>
    {children}
  </div>
);

const EvidenceCard: React.FC<{
  title: string;
  badge?: React.ReactNode;
  evidence: string;
  footer?: React.ReactNode;
}> = ({ title, badge, evidence, footer }) => (
  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
    <div className="flex items-start justify-between gap-2 mb-1">
      <span className="text-sm font-medium text-white">{title}</span>
      {badge}
    </div>
    {evidence && <p className="text-xs text-neutral-400 leading-relaxed">{evidence}</p>}
    {footer}
  </div>
);

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

  const hasKey = hasGeminiApiKey();

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate journal review');
    } finally {
      setLoading(false);
    }
  };

  // ---- No API key ----
  if (!hasKey) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-indigo-400" />
          <h3 className="text-lg font-semibold text-white">AI Journal Review</h3>
        </div>
        <p className="text-sm text-neutral-400">
          Add your Gemini API key in Settings to generate a grounded, supportive review of your
          journal entries over any date range.
        </p>
      </div>
    );
  }

  const isEmpty = review && entriesCount === 0;

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 sm:p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-indigo-400" />
        <h3 className="text-lg font-semibold text-white">AI Journal Review</h3>
      </div>
      <p className="text-sm text-neutral-400 mb-4">
        A grounded look at emotional themes, recurring stressors, wins, and self-talk across your own
        entries — with reflection questions and small next steps. Supportive, not clinical.
      </p>

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
          <p className="text-[11px] text-neutral-500">
            {review.rangeStart} to {review.rangeEnd}
            {entriesCount > 0 && ` · ${entriesCount} entr${entriesCount === 1 ? 'y' : 'ies'}`}
          </p>

          {/* Crisis notice — shown first and prominently when present */}
          {review.crisisNotice && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <LifeBuoy size={16} className="text-rose-300" />
                <h4 className="text-sm font-semibold text-rose-200">A note of care</h4>
              </div>
              <p className="text-sm text-rose-100/90 leading-relaxed">{review.crisisNotice}</p>
            </div>
          )}

          {isEmpty ? (
            /* Empty state */
            <div className="flex flex-col items-center text-center py-8">
              <div className="w-14 h-14 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                <BookOpen size={26} className="text-neutral-500" />
              </div>
              <h4 className="text-base font-semibold text-white mb-1">No entries in this range</h4>
              <p className="text-sm text-neutral-400 max-w-sm leading-relaxed">
                Try a wider date range, or write a few journal entries first — the review is built
                entirely from your own writing.
              </p>
            </div>
          ) : (
            <>
              {/* Low-data warning */}
              {lowData && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    There are only a few entries in this range, so these insights are tentative.
                    Pick a wider range or add more entries for stronger patterns.
                  </p>
                </div>
              )}

              {/* Overview */}
              {review.overview && (
                <p className="text-sm text-neutral-200 leading-relaxed">{review.overview}</p>
              )}

              {/* Emotional Themes */}
              {review.emotionalThemes.length > 0 && (
                <Section icon={<Heart size={15} className="text-rose-400" />} title="Emotional Themes">
                  <div className="space-y-2.5">
                    {review.emotionalThemes.map((t, i) => (
                      <EvidenceCard
                        key={i}
                        title={t.theme}
                        badge={<ConfidenceBadge confidence={t.confidence} />}
                        evidence={t.evidence}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Recurring Stressors */}
              {review.recurringStressors.length > 0 && (
                <Section
                  icon={<AlertTriangle size={15} className="text-amber-400" />}
                  title="Recurring Stressors"
                >
                  <div className="space-y-2.5">
                    {review.recurringStressors.map((s, i) => (
                      <EvidenceCard
                        key={i}
                        title={s.stressor}
                        badge={<ConfidenceBadge confidence={s.confidence} />}
                        evidence={s.evidence}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Wins */}
              {review.wins.length > 0 && (
                <Section icon={<Trophy size={15} className="text-emerald-400" />} title="Wins & Positive Signals">
                  <div className="space-y-2.5">
                    {review.wins.map((w, i) => (
                      <EvidenceCard key={i} title={w.title} evidence={w.evidence} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Self-Talk Patterns */}
              {review.selfTalkPatterns.length > 0 && (
                <Section
                  icon={<MessageCircle size={15} className="text-sky-400" />}
                  title="Self-Talk Patterns"
                >
                  <div className="space-y-2.5">
                    {review.selfTalkPatterns.map((p, i) => (
                      <EvidenceCard
                        key={i}
                        title={p.pattern}
                        evidence={p.evidence}
                        footer={
                          p.suggestion ? (
                            <p className="text-xs text-indigo-300 mt-1.5 leading-relaxed">
                              → {p.suggestion}
                            </p>
                          ) : undefined
                        }
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Reflection Questions */}
              {review.reflectionQuestions.length > 0 && (
                <Section
                  icon={<HelpCircle size={15} className="text-violet-400" />}
                  title="Reflection Questions"
                >
                  <ul className="space-y-1.5">
                    {review.reflectionQuestions.map((q, i) => (
                      <li key={i} className="flex gap-2 text-sm text-neutral-300">
                        <span className="text-violet-400 mt-0.5">•</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Suggested Next Steps */}
              {review.suggestedNextSteps.length > 0 && (
                <Section
                  icon={<Lightbulb size={15} className="text-indigo-400" />}
                  title="Suggested Next Steps"
                >
                  <div className="space-y-2.5">
                    {review.suggestedNextSteps.map((s, i) => (
                      <EvidenceCard
                        key={i}
                        title={s.title}
                        evidence={s.rationale}
                        footer={
                          s.action ? (
                            <p className="text-xs text-indigo-300 mt-1.5 leading-relaxed">
                              → {s.action}
                            </p>
                          ) : undefined
                        }
                      />
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

          <p className="text-[11px] text-neutral-600 leading-relaxed">
            This review is generated by AI from your entries and is a reflection aid, not medical or
            mental-health advice.
          </p>

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
