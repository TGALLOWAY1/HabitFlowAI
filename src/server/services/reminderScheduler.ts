/**
 * Reminder Scheduler
 *
 * In-process scheduler for Web Push habit reminders. Every TICK_MS it
 * computes, per subscription timezone, the current local minute plus a small
 * catch-up window of recent minutes (so a delayed/skipped tick after a deploy
 * or restart still delivers), finds habits whose reminderTime matches, and
 * pushes to each subscribed device — unless the habit is already completed
 * for that local day.
 *
 * Idempotency: pushSendLog's unique (habitId, dayKey, endpoint) index with
 * claim-by-insert makes sends at-most-once per habit per day per device, even
 * across overlapping ticks, restarts, and multiple instances. The dayKey is
 * computed per offset minute so the catch-up window behaves correctly across
 * local midnight; dayKey-scoped dedup also makes the DST fall-back repeated
 * hour single-send. (DST spring-forward: 02:xx local times never occur that
 * day, so those reminders are skipped once a year — accepted limitation.)
 *
 * NOTE: this only runs while the process runs. On hosts that idle-sleep
 * (e.g. Render free tier) reminders silently stop — deploy always-on, or
 * adapt runReminderTick() behind a cron-triggered endpoint.
 */

import type { Habit } from '../../models/persistenceTypes';
import {
  getActivePushSubscriptions,
  disablePushSubscriptionByEndpoint,
} from '../repositories/pushSubscriptionRepository';
import { tryClaimSend, markSendResult, releaseClaim } from '../repositories/pushSendLogRepository';
import { findReminderHabitsForScopes, getHabitById } from '../repositories/habitRepository';
import { getHabitEntriesForDay } from '../repositories/habitEntryRepository';
import { isHabitScheduledOnDay } from './scheduleEngine';
import { resolveChildIdsForDay } from './dayViewService';
import { evaluateChecklistSuccess } from './checklistSuccessService';
import { getDayKeyForDate } from '../utils/dayKey';
import { sendPush, isPushConfigured } from '../lib/webPush';
import { deriveDailyHabitCompletion } from '../../domain/habits/completion';

const TICK_MS = 60_000;
/** How many recent minutes each tick re-checks; dedup makes overlap safe. */
const CATCH_UP_MINUTES = 5;

/** Format a Date as local "HH:mm" in an IANA timezone (24h). */
export function formatLocalHHmm(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

interface MinuteCandidate {
  hhmm: string;
  dayKey: string;
}

/**
 * Is this habit already "done" for the day, making its reminder unnecessary?
 *
 * Regular habits: canonical daily completion for the habit type and target.
 * Bundles never have their own entries — completion is derived from the
 * children active that day (temporal memberships, subHabitIds fallback):
 * choice = any child done, checklist = its success rule. Children are
 * checked by same-day entries only; a weekly-quota child satisfied earlier
 * in the week still counts as not-done-today, which errs toward sending
 * the reminder rather than wrongly suppressing it.
 */
async function deriveReminderCompletion(
  habit: Habit & { householdId: string; userId: string },
  dayKey: string
): Promise<boolean> {
  if (habit.type !== 'bundle') {
    const entries = await getHabitEntriesForDay(habit.id, dayKey, habit.householdId, habit.userId);
    const activeEntries = entries.filter(entry => !entry.note?.startsWith('freeze:'));
    return deriveDailyHabitCompletion(habit, activeEntries).isComplete;
  }

  const childIds = await resolveChildIdsForDay(habit, dayKey, habit.householdId, habit.userId);
  if (childIds.length === 0) return false;

  let completedCount = 0;
  for (const childId of childIds) {
    const [child, entries] = await Promise.all([
      getHabitById(childId, habit.householdId, habit.userId),
      getHabitEntriesForDay(childId, dayKey, habit.householdId, habit.userId),
    ]);
    if (!child) continue;
    const activeEntries = entries.filter(entry => !entry.note?.startsWith('freeze:'));
    if (deriveDailyHabitCompletion(child, activeEntries).isComplete) completedCount++;
  }

  if (habit.bundleType === 'checklist') {
    return evaluateChecklistSuccess(completedCount, childIds.length, habit.checklistSuccessRule)
      .meetsSuccessRule;
  }
  // Choice bundles: any child complete = bundle complete
  return completedCount > 0;
}

/**
 * One scheduler pass. Exported (with `now` injected) so tests can drive it
 * deterministically without timers.
 */
export async function runReminderTick(now: Date): Promise<void> {
  const subscriptions = await getActivePushSubscriptions();
  if (subscriptions.length === 0) return;

  // 1. Candidate (local minute, local dayKey) pairs per distinct timezone.
  //    dayKey is computed per offset minute so a window that crosses local
  //    midnight attributes each minute to its own calendar day.
  const tzCandidates = new Map<string, MinuteCandidate[]>();
  for (const sub of subscriptions) {
    if (tzCandidates.has(sub.timeZone)) continue;
    const candidates: MinuteCandidate[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < CATCH_UP_MINUTES; i++) {
      const t = new Date(now.getTime() - i * 60_000);
      const hhmm = formatLocalHHmm(t, sub.timeZone);
      const dayKey = getDayKeyForDate(t, sub.timeZone);
      const key = `${hhmm}|${dayKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ hhmm, dayKey });
    }
    tzCandidates.set(sub.timeZone, candidates);
  }

  // 2. One cross-scope habit query for all subscribed users and all
  //    candidate times (over-fetches across timezones; filtered per sub below).
  const scopeKeys = new Set<string>();
  const scopes: Array<{ householdId: string; userId: string }> = [];
  for (const sub of subscriptions) {
    const key = `${sub.householdId}|${sub.userId}`;
    if (scopeKeys.has(key)) continue;
    scopeKeys.add(key);
    scopes.push({ householdId: sub.householdId, userId: sub.userId });
  }
  const allTimes = [...new Set([...tzCandidates.values()].flat().map((c) => c.hhmm))];
  const habits = await findReminderHabitsForScopes(scopes, allTimes);
  if (habits.length === 0) return;

  // Completion lookups are cached per (habit, dayKey) within the tick.
  const completionCache = new Map<string, boolean>();
  async function isCompleted(
    habit: Habit & { householdId: string; userId: string },
    dayKey: string
  ): Promise<boolean> {
    const cacheKey = `${habit.id}|${dayKey}`;
    const cached = completionCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const completed = await deriveReminderCompletion(habit, dayKey);
    completionCache.set(cacheKey, completed);
    return completed;
  }

  // 3. Match each subscription's local candidate minutes against its user's habits.
  for (const sub of subscriptions) {
    const candidates = tzCandidates.get(sub.timeZone) ?? [];
    for (const habit of habits) {
      if (habit.householdId !== sub.householdId || habit.userId !== sub.userId) continue;
      const candidate = candidates.find((c) => c.hhmm === habit.reminderTime);
      if (!candidate) continue;
      if (!isHabitScheduledOnDay(habit, candidate.dayKey)) continue;
      if (await isCompleted(habit, candidate.dayKey)) continue;

      // 4. Claim-then-send: the unique dedup index makes this at-most-once.
      const claimed = await tryClaimSend(
        habit.id,
        candidate.dayKey,
        sub.endpoint,
        sub.householdId,
        sub.userId
      );
      if (!claimed) continue;

      const result = await sendPush(
        { endpoint: sub.endpoint, keys: sub.keys },
        {
          title: habit.name,
          body: `Time for ${habit.name}`,
          tag: `habit-${habit.id}-${candidate.dayKey}`,
          data: { url: '/?view=tracker' },
        }
      );

      if (result === 'sent') {
        await markSendResult(habit.id, candidate.dayKey, sub.endpoint, 'sent');
      } else if (result === 'gone') {
        await markSendResult(habit.id, candidate.dayKey, sub.endpoint, 'gone');
        await disablePushSubscriptionByEndpoint(sub.householdId, sub.userId, sub.endpoint);
      } else {
        // Transient failure: release the claim so the next tick can retry
        // while the minute is still inside the catch-up window.
        await releaseClaim(habit.id, candidate.dayKey, sub.endpoint);
      }
    }
  }
}

export interface ReminderSchedulerHandle {
  stop: () => void;
}

/**
 * Start the interval scheduler. Call only when isPushConfigured(); returns a
 * handle whose stop() must run during graceful shutdown.
 */
export function startReminderScheduler(): ReminderSchedulerHandle {
  let inFlight = false;

  const safeTick = async (): Promise<void> => {
    if (inFlight) return; // never overlap ticks on a slow DB
    inFlight = true;
    try {
      if (isPushConfigured()) {
        await runReminderTick(new Date());
      }
    } catch (error) {
      // A failed tick must never crash the server; dedup + catch-up window
      // mean the next tick heals anything transient.
      console.error('[PushReminders] tick failed:', error);
    } finally {
      inFlight = false;
    }
  };

  const interval = setInterval(() => void safeTick(), TICK_MS);
  // Warmup tick shortly after boot so reminders in the current minute aren't
  // missed while waiting for the first full interval.
  const warmup = setTimeout(() => void safeTick(), 5_000);

  console.log('[PushReminders] scheduler started (60s tick)');

  return {
    stop: () => {
      clearInterval(interval);
      clearTimeout(warmup);
      console.log('[PushReminders] scheduler stopped');
    },
  };
}
