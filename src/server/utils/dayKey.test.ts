/**
 * Canonical server dayKey utility tests.
 * - Fixed UTC timestamp near midnight => dayKey differs correctly by timezone.
 * - Missing or invalid timezone => uses America/New_York.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DAYKEY_TIMEZONE,
  resolveTimeZone,
  getDayKeyForDate,
  getNowDayKey,
  getDayKeyForTimestamp,
} from './dayKey';

describe('resolveTimeZone', () => {
  it('returns America/New_York when input is missing', () => {
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_DAYKEY_TIMEZONE);
    expect(resolveTimeZone(null)).toBe(DEFAULT_DAYKEY_TIMEZONE);
    expect(resolveTimeZone('')).toBe(DEFAULT_DAYKEY_TIMEZONE);
  });

  it('returns America/New_York when input is invalid', () => {
    expect(resolveTimeZone('Invalid/Timezone/123')).toBe(DEFAULT_DAYKEY_TIMEZONE);
  });

  it('returns input when valid IANA timezone', () => {
    expect(resolveTimeZone('UTC')).toBe('UTC');
    expect(resolveTimeZone('America/New_York')).toBe('America/New_York');
    expect(resolveTimeZone('America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(resolveTimeZone('Europe/London')).toBe('Europe/London');
  });
});

describe('getDayKeyForDate / getDayKeyForTimestamp', () => {
  it('given a fixed UTC timestamp close to midnight, dayKey differs correctly by timezone', () => {
    // 2025-01-02 00:30:00 UTC = still Jan 1 in US Pacific, Jan 2 in UTC
    const utcTimestamp = '2025-01-02T00:30:00.000Z';
    const date = new Date(utcTimestamp);

    expect(getDayKeyForDate(date, 'UTC')).toBe('2025-01-02');
    expect(getDayKeyForDate(date, 'America/Los_Angeles')).toBe('2025-01-01'); // 16:30 Jan 1 PST
    expect(getDayKeyForDate(date, 'America/New_York')).toBe('2025-01-01');   // 19:30 Jan 1 EST

    expect(getDayKeyForTimestamp(utcTimestamp, 'UTC')).toBe('2025-01-02');
    expect(getDayKeyForTimestamp(utcTimestamp, 'America/Los_Angeles')).toBe('2025-01-01');
  });

  it('uses America/New_York when timezone is missing', () => {
    // 2025-01-01 05:00:00 UTC = midnight EST (Jan 1 in New York)
    const utcTimestamp = '2025-01-01T05:00:00.000Z';
    expect(getDayKeyForTimestamp(utcTimestamp, undefined)).toBe('2025-01-01');
    expect(getDayKeyForTimestamp(utcTimestamp, null)).toBe('2025-01-01');

    // 2025-01-01 04:59:00 UTC = 23:59 Dec 31 in New York => dayKey 2024-12-31
    const lateNight = '2025-01-01T04:59:00.000Z';
    expect(getDayKeyForTimestamp(lateNight, undefined)).toBe('2024-12-31');
  });

  it('throws on invalid timestamp', () => {
    expect(() => getDayKeyForTimestamp('not-a-date', 'UTC')).toThrow('Invalid timestamp');
  });
});

describe('getNowDayKey', () => {
  it('returns YYYY-MM-DD format', () => {
    const key = getNowDayKey('UTC');
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses America/New_York when timezone is missing', () => {
    const key = getNowDayKey(undefined);
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const keyNull = getNowDayKey(null);
    expect(keyNull).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
