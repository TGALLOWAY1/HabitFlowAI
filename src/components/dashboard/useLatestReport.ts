import { useEffect, useState } from 'react';
import { listAIReports, getAIReport } from '../../lib/aiReportsClient';
import type { AIReport, AIReportKind } from '../../shared/aiReport';

/**
 * Loads the most recent archived report of `kind` (with its full payload).
 *
 * Reading history needs no Gemini key, so this is what surfaces a report in the
 * read-only demo — where live generation is blocked — and lets returning users
 * see their last report inline without spending another Gemini call. Refetches
 * whenever `refreshKey` changes so a card can update after generating anew.
 */
export function useLatestReport(
  kind: AIReportKind,
  refreshKey: unknown = 0,
): { report: AIReport | null; loading: boolean } {
  const [report, setReport] = useState<AIReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const items = await listAIReports(kind, 1);
        if (cancelled) return;
        if (items.length === 0) {
          setReport(null);
          return;
        }
        const full = await getAIReport(items[0].id);
        if (!cancelled) setReport(full);
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, refreshKey]);

  return { report, loading };
}
