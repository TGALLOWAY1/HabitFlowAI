/**
 * AI Reports history routes
 *
 *   GET    /api/ai/reports          — list archived reports (newest first)
 *   GET    /api/ai/reports/:id      — fetch a single report (full payload)
 *   DELETE /api/ai/reports/:id      — soft-delete a report
 *
 * Reports are the persisted archive of generated AI insights (Weekly Review,
 * Journal Summary). Reading history requires no Gemini key.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import {
  deleteAIReport,
  getAIReport,
  listAIReports,
} from '../repositories/aiReportRepository';
import type { AIReportKind } from '../../shared/aiReport';

const VALID_KINDS: AIReportKind[] = [
  'weekly_review',
  'journal_summary',
  'insights_review',
  'journal_review',
];

function parseKind(value: unknown): AIReportKind | undefined {
  return typeof value === 'string' && (VALID_KINDS as string[]).includes(value)
    ? (value as AIReportKind)
    : undefined;
}

/** GET /api/ai/reports?kind=&limit= */
export async function getAIReportsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { userId, householdId } = getRequestIdentity(req);
    const kind = parseKind(req.query.kind);
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;

    const reports = await listAIReports(householdId, userId, { kind, limit });
    res.status(200).json({ reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Reports] list error:', message);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load AI report history' },
    });
  }
}

/** GET /api/ai/reports/:id */
export async function getAIReportRoute(req: Request, res: Response): Promise<void> {
  try {
    const { userId, householdId } = getRequestIdentity(req);
    const report = await getAIReport(householdId, userId, req.params.id);
    if (!report) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
      return;
    }
    res.status(200).json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Reports] get error:', message);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load AI report' },
    });
  }
}

/** DELETE /api/ai/reports/:id */
export async function deleteAIReportRoute(req: Request, res: Response): Promise<void> {
  try {
    const { userId, householdId } = getRequestIdentity(req);
    const deleted = await deleteAIReport(householdId, userId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
      return;
    }
    res.status(204).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Reports] delete error:', message);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete AI report' },
    });
  }
}
