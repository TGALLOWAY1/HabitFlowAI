/**
 * Reminder Scheduler Tests
 *
 * Drives runReminderTick() with fixed Dates against memory Mongo, with the
 * web-push sender mocked. Covers timezone matching, the catch-up window,
 * schedule/completion/enablement exclusions, dedup, gone-endpoint cleanup,
 * transient-error retry, local-midnight windows, and multi-device fan-out.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';

vi.mock('../../lib/webPush', async () => {
  const actual = await vi.importActual<typeof import('../../lib/webPush')>('../../lib/webPush');
  return {
    ...actual,
    sendPush: vi.fn(async () => 'sent' as const),
  };
});

import { sendPush } from '../../lib/webPush';
import { runReminderTick, formatLocalHHmm } from '../reminderScheduler';
import { upsertPushSubscription, getActivePushSubscriptions } from '../../repositories/pushSubscriptionRepository';
import { createHabit } from '../../repositories/habitRepository';

const HH = 'sched-household';
const USER = 'sched-user';
const OTHER_USER = 'sched-other-user';
const ENDPOINT = 'https://push.example.com/send/sched-1';
const ENDPOINT_2 = 'https://push.example.com/send/sched-2';

// 2026-07-16 is a Thursday. 12:00 UTC = 08:00 in New York (EDT, UTC-4).
const NY = 'America/New_York';
const TOKYO = 'Asia/Tokyo';

function utc(iso: string): Date {
  return new Date(iso);
}

async function subscribe(overrides: Partial<{ endpoint: string; timeZone: string; userId: string }> = {}) {
  return upsertPushSubscription(HH, overrides.userId ?? USER, {
    endpoint: overrides.endpoint ?? ENDPOINT,
    keys: { p256dh: 'k', auth: 'a' },
    timeZone: overrides.timeZone ?? NY,
  });
}

async function makeHabit(overrides: Partial<Record<string, unknown>> = {}, userId = USER) {
  return createHabit(
    {
      name: (overrides.name as string) ?? 'Meditate',
      categoryId: 'cat-1',
      goal: { type: 'boolean', frequency: 'daily' },
      reminderTime: '08:00',
      ...overrides,
    } as any,
    HH,
    userId
  );
}

describe('reminderScheduler', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('pushSubscriptions').deleteMany({});
    await db.collection('pushSendLog').deleteMany({});
    await db.collection('habits').deleteMany({});
    await db.collection('habitEntries').deleteMany({});
    vi.mocked(sendPush).mockClear();
    vi.mocked(sendPush).mockResolvedValue('sent');
  });

  describe('formatLocalHHmm', () => {
    it('formats 24h local time in a timezone', () => {
      expect(formatLocalHHmm(utc('2026-07-16T12:00:00Z'), NY)).toBe('08:00');
      expect(formatLocalHHmm(utc('2026-07-16T12:00:00Z'), TOKYO)).toBe('21:00');
      expect(formatLocalHHmm(utc('2026-07-16T00:05:00Z'), 'UTC')).toBe('00:05');
    });
  });

  it('sends when the local minute matches reminderTime in the sub timezone', async () => {
    await subscribe();
    const habit = await makeHabit();

    await runReminderTick(utc('2026-07-16T12:00:10Z')); // 08:00 NY

    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(1);
    const [target, payload] = vi.mocked(sendPush).mock.calls[0];
    expect(target.endpoint).toBe(ENDPOINT);
    expect(payload.title).toBe('Meditate');
    expect(payload.tag).toBe(`habit-${habit.id}-2026-07-16`);
    expect(payload.data?.url).toBe('/?view=tracker');
  });

  it('does not send for non-matching minutes', async () => {
    await subscribe();
    await makeHabit({ reminderTime: '09:30' });

    await runReminderTick(utc('2026-07-16T12:00:10Z')); // 08:00 NY

    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  it('catches up reminders a few minutes in the past (delayed tick)', async () => {
    await subscribe();
    await makeHabit({ reminderTime: '08:00' });

    // Tick fires at 08:03 local — 08:00 is inside the 5-minute window
    await runReminderTick(utc('2026-07-16T12:03:00Z'));

    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(1);
  });

  it('does not catch up beyond the window', async () => {
    await subscribe();
    await makeHabit({ reminderTime: '08:00' });

    await runReminderTick(utc('2026-07-16T12:06:00Z')); // 08:06 local

    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  it('dedups across consecutive ticks (at most one send per habit/day/device)', async () => {
    await subscribe();
    await makeHabit();

    await runReminderTick(utc('2026-07-16T12:00:10Z'));
    await runReminderTick(utc('2026-07-16T12:01:10Z')); // 08:00 still in window
    await runReminderTick(utc('2026-07-16T12:02:10Z'));

    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(1);
  });

  it('respects assignedDays (2026-07-16 is a Thursday=4)', async () => {
    await subscribe();
    await makeHabit({ name: 'WeekendOnly', assignedDays: [0, 6] });
    await makeHabit({ name: 'ThursdayHabit', assignedDays: [4] });

    await runReminderTick(utc('2026-07-16T12:00:10Z'));

    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendPush).mock.calls[0][1].title).toBe('ThursdayHabit');
  });

  it('skips reminderEnabled=false, archived, and bundle habits', async () => {
    await subscribe();
    await makeHabit({ name: 'Disabled', reminderEnabled: false });
    await makeHabit({ name: 'Bundle', type: 'bundle' });
    const db = await getTestDb();
    await makeHabit({ name: 'Archived' });
    await db.collection('habits').updateOne({ name: 'Archived' }, { $set: { archived: true } });

    await runReminderTick(utc('2026-07-16T12:00:10Z'));

    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  it('skips habits already completed for the local day', async () => {
    await subscribe();
    const habit = await makeHabit();
    const db = await getTestDb();
    await db.collection('habitEntries').insertOne({
      id: 'entry-1',
      householdId: HH,
      userId: USER,
      habitId: habit.id,
      dayKey: '2026-07-16',
      createdAt: new Date().toISOString(),
    });

    await runReminderTick(utc('2026-07-16T12:00:10Z'));

    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  it('disables the subscription when the push service reports it gone', async () => {
    await subscribe();
    await makeHabit();
    vi.mocked(sendPush).mockResolvedValueOnce('gone');

    await runReminderTick(utc('2026-07-16T12:00:10Z'));
    expect(await getActivePushSubscriptions()).toHaveLength(0);

    // Next day: nothing to send to
    vi.mocked(sendPush).mockClear();
    await runReminderTick(utc('2026-07-17T12:00:10Z'));
    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  it('retries after a transient error (claim released, still in window)', async () => {
    await subscribe();
    await makeHabit();
    vi.mocked(sendPush).mockResolvedValueOnce('error');

    await runReminderTick(utc('2026-07-16T12:00:10Z'));
    await runReminderTick(utc('2026-07-16T12:01:10Z'));

    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(2);
    // Second attempt succeeded; a third tick must not send again
    await runReminderTick(utc('2026-07-16T12:02:10Z'));
    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(2);
  });

  it('handles the catch-up window across local midnight', async () => {
    await subscribe({ timeZone: 'UTC' });
    await makeHabit({ reminderTime: '23:59' });

    // 00:02 UTC on the 17th: 23:59 belongs to the 16th's dayKey
    await runReminderTick(utc('2026-07-17T00:02:00Z'));

    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendPush).mock.calls[0][1].tag).toContain('2026-07-16');
  });

  it('fans out to multiple devices of the same user', async () => {
    await subscribe({ endpoint: ENDPOINT });
    await subscribe({ endpoint: ENDPOINT_2 });
    await makeHabit();

    await runReminderTick(utc('2026-07-16T12:00:10Z'));

    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(2);
    const endpoints = vi.mocked(sendPush).mock.calls.map(([t]) => t.endpoint).sort();
    expect(endpoints).toEqual([ENDPOINT, ENDPOINT_2].sort());
  });

  it('only fires for the local minute of each subscription timezone', async () => {
    await subscribe({ endpoint: ENDPOINT, timeZone: NY });
    await subscribe({ endpoint: ENDPOINT_2, timeZone: TOKYO, userId: OTHER_USER });
    await makeHabit({ name: 'NY habit', reminderTime: '08:00' }, USER);
    await makeHabit({ name: 'Tokyo habit', reminderTime: '21:00' }, OTHER_USER);

    // 12:00 UTC = 08:00 NY = 21:00 Tokyo → both fire, each exactly once
    await runReminderTick(utc('2026-07-16T12:00:10Z'));
    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(2);

    // An hour later neither local minute matches
    vi.mocked(sendPush).mockClear();
    await runReminderTick(utc('2026-07-16T13:00:10Z'));
    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });

  it('does not cross-fire habits between users', async () => {
    await subscribe({ endpoint: ENDPOINT, userId: USER });
    // OTHER_USER has the habit but no subscription
    await makeHabit({ name: 'Other user habit' }, OTHER_USER);

    await runReminderTick(utc('2026-07-16T12:00:10Z'));

    expect(vi.mocked(sendPush)).not.toHaveBeenCalled();
  });
});
