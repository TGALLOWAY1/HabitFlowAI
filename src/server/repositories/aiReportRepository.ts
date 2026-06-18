/**
 * AI Report Repository
 *
 * Stores generated AI insights (Weekly Review, Journal Summary) so users can
 * browse their history. These are generated artifacts — not derived views — so
 * a dedicated collection is appropriate. Soft-deleted via `deletedAt`.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import { requireScope, scopeFilter } from '../lib/scoping';
import {
  buildReportPreview,
  type AIReport,
  type AIReportKind,
  type AIReportListItem,
  type AIReportPayload,
} from '../../shared/aiReport';

const COLLECTION = MONGO_COLLECTIONS.AI_REPORTS;

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.createIndex(
    { householdId: 1, userId: 1, kind: 1, createdAt: -1 },
    { name: 'by_scope_kind_created' },
  );
  await col.createIndex({ householdId: 1, userId: 1, id: 1 }, { name: 'by_scope_id' });
  indexesEnsured = true;
}

export interface SaveAIReportInput {
  kind: AIReportKind;
  periodStart: string;
  periodEnd: string;
  payload: AIReportPayload;
}

/** Persist a freshly generated AI report and return it. */
export async function saveAIReport(
  householdId: string,
  userId: string,
  input: SaveAIReportInput,
): Promise<AIReport> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);

  const report: AIReport = {
    id: crypto.randomUUID(),
    userId: scope.userId,
    kind: input.kind,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    preview: buildReportPreview(input.kind, input.payload),
    createdAt: new Date().toISOString(),
    payload: input.payload,
  };

  await col.insertOne({ ...report, householdId: scope.householdId } as any);
  return report;
}

/** List archived reports (newest first), optionally filtered by kind. */
export async function listAIReports(
  householdId: string,
  userId: string,
  opts: { kind?: AIReportKind; limit?: number } = {},
): Promise<AIReportListItem[]> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);

  const extra: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (opts.kind) extra.kind = opts.kind;

  const limit = Math.max(1, Math.min(200, opts.limit ?? 50));

  const docs = await col
    .find(scopeFilter(scope.householdId, scope.userId, extra))
    .project({ _id: 0, id: 1, kind: 1, periodStart: 1, periodEnd: 1, preview: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs as unknown as AIReportListItem[];
}

/** Fetch a single archived report (with full payload). */
export async function getAIReport(
  householdId: string,
  userId: string,
  id: string,
): Promise<AIReport | null> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);

  const doc = await col.findOne(
    scopeFilter(scope.householdId, scope.userId, { id, deletedAt: { $exists: false } }),
  );
  if (!doc) return null;

  const { _id, householdId: _householdId, ...report } = doc as any;
  return report as AIReport;
}

/** Soft-delete an archived report. Returns true if a report was deleted. */
export async function deleteAIReport(
  householdId: string,
  userId: string,
  id: string,
): Promise<boolean> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);

  const result = await col.updateOne(
    scopeFilter(scope.householdId, scope.userId, { id, deletedAt: { $exists: false } }),
    { $set: { deletedAt: new Date().toISOString() } },
  );
  return result.modifiedCount > 0;
}
