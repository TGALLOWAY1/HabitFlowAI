import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { InsightsAIReviewCard } from './InsightsAIReviewCard';
import { WeeklyAIReviewCard } from './WeeklyAIReviewCard';
import { JournalReviewPanel } from '../Journal/JournalReviewPanel';

interface AIStudioModalProps {
  onClose: () => void;
}

/**
 * The AI hub: one place, opened from the header, that gathers the three
 * primary AI artifacts as full inline generators —
 *   1. Wellbeing Summary (Insights AI Review)
 *   2. Weekly Review
 *   3. Journal Insights (AI Journal Review)
 * Each card carries its own explanation, last-generated date, and history.
 */
export const AIStudioModal: React.FC<AIStudioModalProps> = ({ onClose }) => {
  return (
    <div
      className="modal-overlay fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="modal-scroll bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl my-8 max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">AI</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body — the three artifact cards */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <InsightsAIReviewCard />
          <WeeklyAIReviewCard />
          <JournalReviewPanel />
        </div>
      </div>
    </div>
  );
};
