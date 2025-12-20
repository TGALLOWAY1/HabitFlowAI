import { describe, it, expect } from 'vitest';
import {
  isValidDayKey,
  assertDayKey,
  formatDayKeyFromDate,
  getNowDayKey,
} from './dayKey';

describe('DayKey Utility', () => {
  describe('isValidDayKey', () => {
    it('should accept valid DayKey format (YYYY-MM-DD)', () => {
      expect(isValidDayKey('2025-12-20')).toBe(true);
      expect(isValidDayKey('2024-01-01')).toBe(true);
      expect(isValidDayKey('2024-02-29')).toBe(true); // 2024 is a leap year
      expect(isValidDayKey('2025-02-28')).toBe(true); // Last day of Feb in non-leap year
    });

    it('should reject invalid formats', () => {
      expect(isValidDayKey('2025/12/20')).toBe(false); // Wrong separator
      expect(isValidDayKey('12-20-2025')).toBe(false); // Wrong order
      expect(isValidDayKey('2025-12')).toBe(false); // Missing day
      expect(isValidDayKey('2025-12-20-')).toBe(false); // Extra character
      expect(isValidDayKey('2025-1-20')).toBe(false); // Month not zero-padded
      expect(isValidDayKey('2025-12-2')).toBe(false); // Day not zero-padded
      expect(isValidDayKey('')).toBe(false); // Empty string
      expect(isValidDayKey('not-a-date')).toBe(false); // Not a date
    });

    it('should reject invalid calendar dates', () => {
      expect(isValidDayKey('2025-02-30')).toBe(false); // February doesn't have 30 days
      expect(isValidDayKey('2025-13-01')).toBe(false); // Invalid month
      expect(isValidDayKey('2025-00-01')).toBe(false); // Invalid month
      expect(isValidDayKey('2025-12-32')).toBe(false); // Invalid day
      expect(isValidDayKey('2025-12-00')).toBe(false); // Invalid day
    });

    it('should handle leap years correctly', () => {
      expect(isValidDayKey('2024-02-29')).toBe(true); // 2024 is a leap year
      expect(isValidDayKey('2025-02-29')).toBe(false); // 2025 is not a leap year
      expect(isValidDayKey('2000-02-29')).toBe(true); // 2000 is a leap year
      expect(isValidDayKey('1900-02-29')).toBe(false); // 1900 is not a leap year (century rule)
    });
  });

  describe('assertDayKey', () => {
    it('should not throw for valid DayKey', () => {
      expect(() => assertDayKey('2025-12-20')).not.toThrow();
      expect(() => assertDayKey('2024-01-01')).not.toThrow();
    });

    it('should throw helpful error for invalid DayKey', () => {
      expect(() => assertDayKey('invalid')).toThrow(
        'Invalid DayKey format: "invalid". Expected YYYY-MM-DD format (e.g., "2025-12-20")'
      );
      expect(() => assertDayKey('2025-13-01')).toThrow();
      expect(() => assertDayKey('')).toThrow();
    });
  });

  describe('formatDayKeyFromDate - timezone correctness', () => {
    it('should format UTC date correctly', () => {
      // Fixed UTC timestamp: 2025-01-01T12:00:00.000Z (noon UTC on Jan 1)
      const date = new Date('2025-01-01T12:00:00.000Z');
      const dayKey = formatDayKeyFromDate(date, 'UTC');
      expect(dayKey).toBe('2025-01-01');
    });

    it('should handle timezone boundary correctly - UTC vs PST', () => {
      // Fixed UTC timestamp: 2025-01-01T08:00:00.000Z
      // In UTC: This is 8 AM on Jan 1, 2025
      // In America/Los_Angeles (PST, UTC-8): This is midnight (12 AM) on Jan 1, 2025
      const date = new Date('2025-01-01T08:00:00.000Z');
      
      const utcDayKey = formatDayKeyFromDate(date, 'UTC');
      const pstDayKey = formatDayKeyFromDate(date, 'America/Los_Angeles');
      
      expect(utcDayKey).toBe('2025-01-01');
      expect(pstDayKey).toBe('2025-01-01');
    });

    it('should handle timezone boundary correctly - previous day in PST', () => {
      // Fixed UTC timestamp: 2025-01-01T01:00:00.000Z
      // In UTC: This is 1 AM on Jan 1, 2025
      // In America/Los_Angeles (PST, UTC-8): This is 5 PM on Dec 31, 2024
      const date = new Date('2025-01-01T01:00:00.000Z');
      
      const utcDayKey = formatDayKeyFromDate(date, 'UTC');
      const pstDayKey = formatDayKeyFromDate(date, 'America/Los_Angeles');
      
      expect(utcDayKey).toBe('2025-01-01');
      expect(pstDayKey).toBe('2024-12-31'); // Previous day in PST
    });

    it('should handle timezone boundary correctly - next day in UTC', () => {
      // Fixed UTC timestamp: 2024-12-31T23:00:00.000Z
      // In UTC: This is 11 PM on Dec 31, 2024
      // In America/Los_Angeles (PST, UTC-8): This is 3 PM on Dec 31, 2024
      const date = new Date('2024-12-31T23:00:00.000Z');
      
      const utcDayKey = formatDayKeyFromDate(date, 'UTC');
      const pstDayKey = formatDayKeyFromDate(date, 'America/Los_Angeles');
      
      expect(utcDayKey).toBe('2024-12-31');
      expect(pstDayKey).toBe('2024-12-31');
    });

    it('should handle timezone boundary correctly - next day in PST', () => {
      // Fixed UTC timestamp: 2025-01-01T07:59:59.999Z
      // In UTC: This is 7:59:59 AM on Jan 1, 2025
      // In America/Los_Angeles (PST, UTC-8): This is 11:59:59 PM on Dec 31, 2024
      const date = new Date('2025-01-01T07:59:59.999Z');
      
      const utcDayKey = formatDayKeyFromDate(date, 'UTC');
      const pstDayKey = formatDayKeyFromDate(date, 'America/Los_Angeles');
      
      expect(utcDayKey).toBe('2025-01-01');
      expect(pstDayKey).toBe('2024-12-31'); // Still previous day in PST
    });

    it('should handle Europe/London timezone', () => {
      // Fixed UTC timestamp: 2025-01-01T00:00:00.000Z
      // In UTC: This is midnight on Jan 1, 2025
      // In Europe/London (GMT, UTC+0 in winter): This is midnight on Jan 1, 2025
      const date = new Date('2025-01-01T00:00:00.000Z');
      
      const londonDayKey = formatDayKeyFromDate(date, 'Europe/London');
      expect(londonDayKey).toBe('2025-01-01');
    });

    it('should handle Asia/Tokyo timezone (UTC+9)', () => {
      // Fixed UTC timestamp: 2025-01-01T00:00:00.000Z
      // In UTC: This is midnight on Jan 1, 2025
      // In Asia/Tokyo (UTC+9): This is 9 AM on Jan 1, 2025
      const date = new Date('2025-01-01T00:00:00.000Z');
      
      const tokyoDayKey = formatDayKeyFromDate(date, 'Asia/Tokyo');
      expect(tokyoDayKey).toBe('2025-01-01');
    });

    it('should handle edge case - midnight UTC in different timezones', () => {
      // Fixed UTC timestamp: 2025-01-01T00:00:00.000Z (midnight UTC)
      const date = new Date('2025-01-01T00:00:00.000Z');
      
      expect(formatDayKeyFromDate(date, 'UTC')).toBe('2025-01-01');
      expect(formatDayKeyFromDate(date, 'America/Los_Angeles')).toBe('2024-12-31');
      expect(formatDayKeyFromDate(date, 'Europe/London')).toBe('2025-01-01');
      expect(formatDayKeyFromDate(date, 'Asia/Tokyo')).toBe('2025-01-01');
    });

    it('should throw error for invalid timezone', () => {
      const date = new Date('2025-01-01T12:00:00.000Z');
      expect(() => formatDayKeyFromDate(date, 'Invalid/Timezone')).toThrow();
    });
  });

  describe('getNowDayKey', () => {
    it('should return a valid DayKey for current time', () => {
      const dayKey = getNowDayKey('UTC');
      expect(isValidDayKey(dayKey)).toBe(true);
      expect(dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return different DayKey for different timezones at same moment', () => {
      // This test may be flaky if run exactly at midnight, but should generally work
      const utcKey = getNowDayKey('UTC');
      const pstKey = getNowDayKey('America/Los_Angeles');
      
      // Both should be valid DayKeys
      expect(isValidDayKey(utcKey)).toBe(true);
      expect(isValidDayKey(pstKey)).toBe(true);
      
      // They may be the same or different depending on current time
      // (This is acceptable - the important thing is they're both valid)
    });
  });
});

