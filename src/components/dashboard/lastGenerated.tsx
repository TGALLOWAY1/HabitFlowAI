import React, { useEffect, useState } from 'react';
import { listAIReports } from '../../lib/aiReportsClient';
import type { AIReportKind } from '../../shared/aiReport';

/** Human-friendly timestamp for a report's generation time. */
export function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Returns the ISO `createdAt` of the most recent archived report of `kind`,
 * or null when none exists (or history couldn't be read). Refetches whenever
 * `refreshKey` changes so cards can update after generating a fresh report.
 */
export function useLastGenerated(kind: AIReportKind, refreshKey: unknown = 0): string | null {
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    listAIReports(kind, 1)
      .then((items) => {
        if (!cancelled) setCreatedAt(items[0]?.createdAt ?? null);
      })
      .catch(() => {
        if (!cancelled) setCreatedAt(null);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, refreshKey]);
  return createdAt;
}

/** Small "Last generated …" line, hidden when there is no prior report. */
export const LastGeneratedLine: React.FC<{ createdAt: string | null }> = ({ createdAt }) =>
  createdAt ? (
    <p className="text-[11px] text-neutral-500">Last generated {formatGeneratedAt(createdAt)}</p>
  ) : null;
