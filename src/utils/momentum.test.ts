
import { describe, it, expect } from 'vitest';
import { calculateCategoryMomentum, calculateActiveDays, getMomentumState } from './momentum';
import type { DayLog } from '../types';

describe('Momentum Utility', () => {
    describe('calculateActiveDays', () => {
        const today = new Date('2025-01-01T12:00:00Z'); // Fixed reference date
        const habitId = 'habit-1';

        const createLog = (dateStr: string, completed: boolean = true): DayLog => ({
            habitId,
            date: dateStr,
            value: 1,
            completed
        });

        it('should count 0 active days if no logs exist', () => {
            const result = calculateActiveDays([], [habitId], today);
            expect(result).toBe(0);
        });

        it('should count 1 active day for a single completion today', () => {
            const logs = [createLog('2025-01-01')];
            const result = calculateActiveDays(logs, [habitId], today);
            expect(result).toBe(1);
        });

        it('should count multiple completions on the same day as 1 active day', () => {
            const logs = [
                createLog('2025-01-01'),
                createLog('2025-01-01'), // Duplicate/Multiple habits same day? 
                // Wait, logic filters by habitIds. If we have multiple habits in category:
                { habitId: 'habit-2', date: '2025-01-01', value: 1, completed: true }
            ];
            const result = calculateActiveDays(logs, [habitId, 'habit-2'], today);
            expect(result).toBe(1);
        });

        it('should count past 6 days + today (7 day window)', () => {
            // Window: Dec 26, 27, 28, 29, 30, 31, Jan 1
            const logs = [
                createLog('2025-01-01'), // Day 0 (Today)
                createLog('2024-12-31'), // Day -1
                createLog('2024-12-25'), // Day -7 (Outside window of 7 days: 0..6)
            ];
            // 7 days window: 0,1,2,3,4,5,6 days ago.
            // 0=Jan1, 6=Dec26. Dec25 is 7 days ago, so outside.

            const result = calculateActiveDays(logs, [habitId], today);
            expect(result).toBe(2);
        });

        it('should ignore uncompleted logs', () => {
            const logs = [createLog('2025-01-01', false)];
            const result = calculateActiveDays(logs, [habitId], today);
            expect(result).toBe(0);
        });
    });

    describe('getMomentumState', () => {
        it('0 days -> Paused', () => {
            expect(getMomentumState(0)).toBe('Paused');
        });
        it('1 day -> Building', () => {
            expect(getMomentumState(1)).toBe('Building');
        });
        it('2 days -> Building', () => {
            expect(getMomentumState(2)).toBe('Building');
        });
        it('3 days -> Steady', () => {
            expect(getMomentumState(3)).toBe('Steady');
        });
        it('4 days -> Steady', () => {
            expect(getMomentumState(4)).toBe('Steady');
        });
        it('5 days -> Strong', () => {
            expect(getMomentumState(5)).toBe('Strong');
        });
        it('6 days -> Strong', () => {
            expect(getMomentumState(6)).toBe('Strong');
        });
        it('7 days -> Strong', () => {
            expect(getMomentumState(7)).toBe('Strong');
        });
    });

    describe('calculateCategoryMomentum', () => {
        it('should return correct state and phrase', () => {
            const result = calculateCategoryMomentum([], ['habit-1'], 'test-category');
            expect(result.state).toBe('Paused');
            expect(result.phrase).toBeDefined();
            expect(result.activeDays).toBe(0);
        });
    });
});
