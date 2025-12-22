/**
 * Dev-only Demo Seed/Reset Routes: Emotional Wellbeing
 *
 * Guardrails (MANDATORY):
 * - Refuse if NODE_ENV === "production"
 * - Refuse if DEMO_MODE_ENABLED !== "true"
 * - Refuse if request userId !== DEMO_USER_ID
 * - Never accept arbitrary userId from client
 */

import type { Request, Response } from 'express';
import { getDb } from '../lib/mongoClient';
import { assertDemoSeedAllowed, DEMO_USER_ID } from '../config/demo';
import { MONGO_COLLECTIONS, type DailyWellbeing } from '../../models/persistenceTypes';
import { formatDayKeyFromDate } from '../../domain/time/dayKey';
import { upsertWellbeingLog } from '../repositories/wellbeingLogRepository';
import { createWellbeingEntries } from '../repositories/wellbeingEntryRepository';
import { createEntry as createJournalEntry } from '../repositories/journal';

function assertDemoRequest(req: Request): string {
  assertDemoSeedAllowed();

  const userId = (req as any).userId || 'anonymous-user';
  if (userId !== DEMO_USER_ID) {
    throw new Error('Forbidden: demo seed/reset may only run for DEMO_USER_ID');
  }
  return userId;
}

async function resetDemoData(userId: string): Promise<{ deleted: Record<string, number> }> {
  if (userId !== DEMO_USER_ID) {
    throw new Error('Hard guardrail: resetDemoData may only run for DEMO_USER_ID');
  }

  const db = await getDb();

  const wellbeingEntriesResult = await db
    .collection(MONGO_COLLECTIONS.WELLBEING_ENTRIES)
    .deleteMany({ userId });

  const wellbeingLogsResult = await db
    .collection(MONGO_COLLECTIONS.WELLBEING_LOGS)
    .deleteMany({ userId });

  const journalEntriesResult = await db
    .collection(MONGO_COLLECTIONS.JOURNAL_ENTRIES)
    .deleteMany({ userId });

  return {
    deleted: {
      wellbeingEntries: wellbeingEntriesResult.deletedCount || 0,
      wellbeingLogs: wellbeingLogsResult.deletedCount || 0,
      journalEntries: journalEntriesResult.deletedCount || 0,
    },
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function seededRng(dayOffset: number): number {
  // Deterministic pseudo-random in [0,1)
  const x = Math.sin(dayOffset * 999) * 10000;
  return x - Math.floor(x);
}

export async function resetDemoEmotionalWellbeingRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = assertDemoRequest(req);
    const result = await resetDemoData(userId);
    res.status(200).json({ ok: true, userId, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(403).json({ ok: false, error: message });
  }
}

export async function seedDemoEmotionalWellbeingRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = assertDemoRequest(req);

    // Idempotency: reset first, then insert
    const reset = await resetDemoData(userId);

    const today = new Date();
    const dayKeys: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      dayKeys.push(formatDayKeyFromDate(d, 'UTC'));
    }

    // Seed 30 days of wellbeing (both legacy container + canonical entries)
    const canonicalEntries: Parameters<typeof createWellbeingEntries>[0] = [];

    for (let i = 0; i < dayKeys.length; i++) {
      const dayKey = dayKeys[i];
      const wave = Math.sin((i / 30) * Math.PI * 2); // [-1,1]
      const noise = seededRng(i);

      const depressionMorning = clamp(Math.round(3 + wave * 1 + (noise - 0.5) * 1), 1, 5);
      const depressionEvening = clamp(Math.round(3 + wave * 1.2 + (seededRng(i + 1) - 0.5) * 1), 1, 5);
      const anxietyMorning = clamp(Math.round(3 + wave * 0.8 + (seededRng(i + 2) - 0.5) * 1), 1, 5);
      const anxietyEvening = clamp(Math.round(3 + wave * 0.9 + (seededRng(i + 3) - 0.5) * 1), 1, 5);
      const energyEvening = clamp(Math.round(3 - wave * 0.9 + (seededRng(i + 4) - 0.5) * 1), 1, 5);
      const sleepScoreMorning = clamp(Math.round(78 + wave * 10 + (seededRng(i + 5) - 0.5) * 8), 55, 95);

      const morningTimestampUtc = `${dayKey}T08:00:00.000Z`;
      const eveningTimestampUtc = `${dayKey}T20:00:00.000Z`;

      // Legacy container shape (for existing UI / endpoints)
      const daily: DailyWellbeing = {
        date: dayKey,
        morning: {
          depression: depressionMorning,
          anxiety: anxietyMorning,
          energy: 3,
          sleepScore: sleepScoreMorning,
          ...(i % 9 === 0 ? { notes: 'Slept okay. Intention: be gentle with myself.' } : {}),
        },
        evening: {
          depression: depressionEvening,
          anxiety: anxietyEvening,
          energy: energyEvening,
          sleepScore: sleepScoreMorning,
          ...(i % 11 === 0 ? { notes: 'Noticing progress. One thing I’m proud of today.' } : {}),
        },
      };

      await upsertWellbeingLog(daily, userId);

      // Canonical entries (timeOfDay + metricKey; no AM/PM key variants)
      canonicalEntries.push(
        { dayKey, timeOfDay: 'morning', metricKey: 'depression', value: depressionMorning, source: 'import', timestampUtc: morningTimestampUtc },
        { dayKey, timeOfDay: 'evening', metricKey: 'depression', value: depressionEvening, source: 'import', timestampUtc: eveningTimestampUtc },
        { dayKey, timeOfDay: 'morning', metricKey: 'anxiety', value: anxietyMorning, source: 'import', timestampUtc: morningTimestampUtc },
        { dayKey, timeOfDay: 'evening', metricKey: 'anxiety', value: anxietyEvening, source: 'import', timestampUtc: eveningTimestampUtc },
        { dayKey, timeOfDay: 'evening', metricKey: 'energy', value: energyEvening, source: 'import', timestampUtc: eveningTimestampUtc },
        { dayKey, timeOfDay: 'morning', metricKey: 'sleepScore', value: sleepScoreMorning, source: 'import', timestampUtc: morningTimestampUtc }
      );

      if (i % 10 === 0) {
        canonicalEntries.push({
          dayKey,
          timeOfDay: 'morning',
          metricKey: 'notes',
          value: 'Grateful for small wins and steady effort.',
          source: 'import',
          timestampUtc: morningTimestampUtc,
        });
      }
    }

    const savedEntries = await createWellbeingEntries(canonicalEntries, userId, { defaultTimeZone: 'UTC' });

    // Seed 12 Gratitude Jar journal entries (not tied to HabitEntries)
    const gratitudePrompts = [
      'A warm cup of tea and a quiet moment.',
      'A friend who checked in today.',
      'Sunlight through the window in the morning.',
      'Finishing a small task I’ve been avoiding.',
      'A walk that helped me reset.',
      'A meal that nourished me.',
      'A kind thought I had about myself.',
      'Laughing at something silly.',
      'Feeling my body get stronger.',
      'Choosing rest without guilt.',
      'A good song at the right time.',
      'Seeing progress in tiny steps.',
      'Being patient with my emotions.',
      'Asking for help when I needed it.',
      'Ending the day with intention.',
    ];

    const journalCreated: string[] = [];
    for (let i = 0; i < 12; i++) {
      const dayKey = dayKeys[i * 2] || dayKeys[dayKeys.length - 1];
      const entry = await createJournalEntry(
        {
          templateId: 'gratitude-jar',
          mode: 'free',
          persona: 'Demo: Emotional Wellbeing',
          date: dayKey,
          content: {
            'free-write': gratitudePrompts[i] || 'I am grateful for today.',
          },
        },
        userId
      );
      journalCreated.push(entry.id);
    }

    res.status(200).json({
      ok: true,
      userId,
      reset,
      seeded: {
        wellbeingDays: dayKeys.length,
        wellbeingEntries: savedEntries.length,
        journalEntries: journalCreated.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(403).json({ ok: false, error: message });
  }
}


