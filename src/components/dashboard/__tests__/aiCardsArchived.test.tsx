import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AIReport } from '../../../shared/aiReport';

// Mock the reports client so the cards can load an archived report without a
// backend. Reading history needs no Gemini key, so with no key set the cards
// should still render the archived report inline (the read-only demo path).
const listAIReports = vi.fn();
const getAIReport = vi.fn();
vi.mock('../../../lib/aiReportsClient', () => ({
  listAIReports: (...args: unknown[]) => listAIReports(...args),
  getAIReport: (...args: unknown[]) => getAIReport(...args),
  deleteAIReport: vi.fn(),
}));

import { InsightsAIReviewCard } from '../InsightsAIReviewCard';
import { WeeklyAIReviewCard } from '../WeeklyAIReviewCard';
import { JournalReviewPanel } from '../../Journal/JournalReviewPanel';

function archived(kind: AIReport['kind'], payload: AIReport['payload']): AIReport {
  return {
    id: `${kind}-1`,
    userId: 'demo',
    kind,
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    preview: 'preview',
    createdAt: '2026-06-30T12:00:00.000Z',
    payload,
  };
}

describe('AI hub cards render the latest archived report inline (keyless demo)', () => {
  beforeEach(() => {
    listAIReports.mockReset();
    getAIReport.mockReset();
    localStorage.clear(); // no Gemini key => keyless branch
  });

  it('Wellbeing Summary shows the archived insights review', async () => {
    const report = archived('insights_review', {
      review: {
        rangeDays: 45,
        rangeStart: '2026-06-01',
        rangeEnd: '2026-06-30',
        summary: 'WELLBEING_SUMMARY_MARKER wind-down nights slept better.',
        keyFindings: ['finding one'],
        patterns: [],
        outlook: [],
        recommendations: [],
        dataLimitations: [],
      },
    });
    listAIReports.mockResolvedValue([{ id: report.id, kind: report.kind, periodStart: report.periodStart, periodEnd: report.periodEnd, preview: report.preview, createdAt: report.createdAt }]);
    getAIReport.mockResolvedValue(report);

    render(<InsightsAIReviewCard />);
    expect(await screen.findByText(/WELLBEING_SUMMARY_MARKER/)).toBeInTheDocument();
  });

  it('Weekly Review shows the archived weekly review', async () => {
    const report = archived('weekly_review', {
      review: {
        weekStart: '2026-06-22',
        weekEnd: '2026-06-28',
        summary: 'WEEKLY_MARKER a steady, well-balanced week.',
        facts: ['3 runs logged'],
        patterns: [],
        journalThemes: [],
        wins: [],
        areasForAttention: [],
        recommendations: [],
        dataLimitations: [],
      },
    });
    listAIReports.mockResolvedValue([{ id: report.id, kind: report.kind, periodStart: report.periodStart, periodEnd: report.periodEnd, preview: report.preview, createdAt: report.createdAt }]);
    getAIReport.mockResolvedValue(report);

    render(<WeeklyAIReviewCard />);
    expect(await screen.findByText(/WEEKLY_MARKER/)).toBeInTheDocument();
  });

  it('Journal Review shows the archived journal review', async () => {
    const report = archived('journal_review', {
      review: {
        rangeStart: '2026-06-01',
        rangeEnd: '2026-06-30',
        overview: 'JOURNAL_MARKER a month of protecting mornings.',
        emotionalThemes: [],
        recurringStressors: [],
        wins: [],
        selfTalkPatterns: [],
        reflectionQuestions: [],
        suggestedNextSteps: [],
        dataLimitations: [],
      },
    });
    listAIReports.mockResolvedValue([{ id: report.id, kind: report.kind, periodStart: report.periodStart, periodEnd: report.periodEnd, preview: report.preview, createdAt: report.createdAt }]);
    getAIReport.mockResolvedValue(report);

    render(<JournalReviewPanel />);
    expect(await screen.findByText(/JOURNAL_MARKER/)).toBeInTheDocument();
  });

  it('Journal Review shows the archived review in demo mode even when a Gemini key is stored', async () => {
    // The tour iframe shares localStorage with the parent origin, so a visitor
    // with a key stored must still get the read-only saved review — not the
    // generate UI — while browsing the demo.
    localStorage.setItem('habitflow_gemini_api_key', 'test-key');
    localStorage.setItem('habitflow_active_user_mode', 'demo');

    const report = archived('journal_review', {
      review: {
        rangeStart: '2026-06-01',
        rangeEnd: '2026-06-30',
        overview: 'JOURNAL_DEMO_MARKER a month of protecting mornings.',
        emotionalThemes: [],
        recurringStressors: [],
        wins: [],
        selfTalkPatterns: [],
        reflectionQuestions: [],
        suggestedNextSteps: [],
        dataLimitations: [],
      },
    });
    listAIReports.mockResolvedValue([{ id: report.id, kind: report.kind, periodStart: report.periodStart, periodEnd: report.periodEnd, preview: report.preview, createdAt: report.createdAt }]);
    getAIReport.mockResolvedValue(report);

    render(<JournalReviewPanel />);
    expect(await screen.findByText(/JOURNAL_DEMO_MARKER/)).toBeInTheDocument();
    expect(screen.queryByText('Generate Review')).not.toBeInTheDocument();
  });
});
