import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Loader2, Trash2, X } from 'lucide-react';
import {
  listAIReports,
  getAIReport,
  deleteAIReport,
} from '../../lib/aiReportsClient';
import type {
  AIReport,
  AIReportKind,
  AIReportListItem,
  InsightsReviewPayload,
  JournalReviewPayload,
  JournalSummaryPayload,
  WeeklyReviewPayload,
} from '../../shared/aiReport';
import { WeeklyReviewBody } from './WeeklyReviewBody';
import { JournalSummaryBody } from '../Journal/JournalSummaryBody';
import { InsightsReviewBody } from '../insights/InsightsReviewBody';
import { JournalReviewBody } from '../Journal/JournalReviewBody';

interface AIReportHistoryModalProps {
  kind: AIReportKind;
  title: string;
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
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

export const AIReportHistoryModal: React.FC<AIReportHistoryModalProps> = ({
  kind,
  title,
  onClose,
}) => {
  const [items, setItems] = useState<AIReportListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AIReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadList = async () => {
    setError(null);
    try {
      setItems(await listAIReports(kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setItems([]);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const openReport = async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      setSelected(await getAIReport(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAIReport(id);
      setItems((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    }
  };

  return (
    <div
      className="modal-overlay fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            {selected && (
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 -ml-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Back to history"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <Clock size={16} className="text-indigo-400 shrink-0" />
            <h3 className="text-sm font-semibold text-white truncate">
              {selected ? `${title} — ${selected.periodStart} to ${selected.periodEnd}` : `${title} history`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Detail view */}
          {selected ? (
            loadingDetail ? (
              <div className="flex items-center gap-3 py-6">
                <Loader2 size={18} className="text-indigo-400 animate-spin" />
                <span className="text-sm text-neutral-400">Loading…</span>
              </div>
            ) : selected.kind === 'weekly_review' ? (
              <WeeklyReviewBody review={(selected.payload as WeeklyReviewPayload).review} />
            ) : selected.kind === 'insights_review' ? (
              <InsightsReviewBody review={(selected.payload as InsightsReviewPayload).review} />
            ) : selected.kind === 'journal_review' ? (
              <JournalReviewBody review={(selected.payload as JournalReviewPayload).review} />
            ) : (
              <JournalSummaryBody summary={(selected.payload as JournalSummaryPayload).summary} />
            )
          ) : items === null ? (
            <div className="flex items-center gap-3 py-6">
              <Loader2 size={18} className="text-indigo-400 animate-spin" />
              <span className="text-sm text-neutral-400">Loading history…</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-neutral-400 py-6 text-center">
              No saved reports yet. Generate one and it will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="group flex items-start gap-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <button
                    onClick={() => openReport(item.id)}
                    className="flex-1 text-left p-3 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-white">
                        {item.periodStart} to {item.periodEnd}
                      </span>
                      <span className="text-[10px] text-neutral-500 shrink-0">
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2">{item.preview}</p>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 mt-1 mr-1 text-neutral-600 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Delete report"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
