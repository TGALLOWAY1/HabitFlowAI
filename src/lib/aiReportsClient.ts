/**
 * AI Reports history client
 *
 * Reads the persisted archive of generated AI insights. Unlike generation,
 * reading history needs no Gemini key — only identity headers.
 */

import { API_BASE_URL } from './persistenceConfig';
import { getIdentityHeaders } from './persistenceClient';
import type { AIReport, AIReportKind, AIReportListItem } from '../shared/aiReport';

/** List archived reports (newest first), optionally filtered by kind. */
export async function listAIReports(
  kind?: AIReportKind,
  limit?: number,
): Promise<AIReportListItem[]> {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();

  const response = await fetch(`${API_BASE_URL}/ai/reports${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'include',
    headers: { ...getIdentityHeaders() },
  });

  if (!response.ok) {
    throw new Error(`Failed to load report history (${response.status})`);
  }
  const data = (await response.json()) as { reports: AIReportListItem[] };
  return data.reports;
}

/** Fetch a single archived report with its full payload. */
export async function getAIReport(id: string): Promise<AIReport> {
  const response = await fetch(`${API_BASE_URL}/ai/reports/${encodeURIComponent(id)}`, {
    method: 'GET',
    credentials: 'include',
    headers: { ...getIdentityHeaders() },
  });

  if (!response.ok) {
    throw new Error(`Failed to load report (${response.status})`);
  }
  const data = (await response.json()) as { report: AIReport };
  return data.report;
}

/** Soft-delete an archived report. */
export async function deleteAIReport(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/ai/reports/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { ...getIdentityHeaders() },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete report (${response.status})`);
  }
}
