#!/usr/bin/env tsx

import express, { type Express } from 'express';
import request from 'supertest';
import { requestContextMiddleware } from '../src/server/middleware/requestContext';
import { getDayView } from '../src/server/routes/dayView';
import { getDaySummary } from '../src/server/routes/daySummary';
import { getProgressOverview } from '../src/server/routes/progress';
import { getGoalsWithProgress, getGoalProgress } from '../src/server/routes/goals';

type DiffItem = {
  path: string;
  canonical: unknown;
  legacy: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectDiffs(canonical: unknown, legacy: unknown, path: string = '$'): DiffItem[] {
  if (canonical === legacy) {
    return [];
  }

  if (Array.isArray(canonical) && Array.isArray(legacy)) {
    const diffs: DiffItem[] = [];
    const maxLength = Math.max(canonical.length, legacy.length);
    for (let index = 0; index < maxLength; index += 1) {
      diffs.push(...collectDiffs(canonical[index], legacy[index], `${path}[${index}]`));
    }
    return diffs;
  }

  if (isObject(canonical) && isObject(legacy)) {
    const diffs: DiffItem[] = [];
    const keys = new Set([...Object.keys(canonical), ...Object.keys(legacy)]);
    for (const key of keys) {
      diffs.push(...collectDiffs(canonical[key], legacy[key], `${path}.${key}`));
    }
    return diffs;
  }

  return [{ path, canonical, legacy }];
}

function buildApp(userId: string): Express {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use((req, _res, next) => {
    (req as any).userId = userId;
    next();
  });

  app.get('/api/dayView', getDayView);
  app.get('/api/daySummary', getDaySummary);
  app.get('/api/progress/overview', getProgressOverview);
  app.get('/api/goals-with-progress', getGoalsWithProgress);
  app.get('/api/goals/:id/progress', getGoalProgress);

  return app;
}

async function fetchWithLegacyFlag(
  app: Express,
  endpoint: string,
  enabled: boolean
): Promise<{ status: number; body: unknown }> {
  process.env.LEGACY_DAYLOG_READS = enabled ? 'true' : 'false';
  const response = await request(app).get(endpoint);
  return {
    status: response.status,
    body: response.body,
  };
}

async function main(): Promise<void> {
  const endpoint = process.argv[2] ?? '/api/progress/overview?timeZone=UTC';
  const userId = process.env.COMPARE_USER_ID || 'anonymous-user';
  const originalFlag = process.env.LEGACY_DAYLOG_READS;
  const app = buildApp(userId);

  try {
    const canonical = await fetchWithLegacyFlag(app, endpoint, false);
    const legacy = await fetchWithLegacyFlag(app, endpoint, true);

    if (canonical.status !== legacy.status) {
      console.log('[compare] Status mismatch');
      console.log(JSON.stringify({ endpoint, canonicalStatus: canonical.status, legacyStatus: legacy.status }, null, 2));
      return;
    }

    const diffs = collectDiffs(canonical.body, legacy.body);
    if (diffs.length === 0) {
      console.log(`[compare] No differences for ${endpoint}`);
      return;
    }

    console.log(`[compare] Differences for ${endpoint}`);
    console.log(JSON.stringify(diffs.slice(0, 200), null, 2));
    if (diffs.length > 200) {
      console.log(`[compare] ... truncated ${diffs.length - 200} additional differences`);
    }
  } finally {
    if (originalFlag === undefined) {
      delete process.env.LEGACY_DAYLOG_READS;
    } else {
      process.env.LEGACY_DAYLOG_READS = originalFlag;
    }
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[compare] Failed: ${message}`);
  process.exitCode = 1;
});
