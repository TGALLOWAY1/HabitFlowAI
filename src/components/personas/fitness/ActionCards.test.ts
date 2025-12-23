import { describe, it, expect } from 'vitest';
import {
  getLastWeekSameWeekday,
  getRoutinesUsedOnDate,
  orderRoutinesByWeekdayMirroring,
} from './ActionCards';
import type { Routine, RoutineLog } from '../../../models/persistenceTypes';

describe('ActionCards weekday mirroring', () => {
  describe('getLastWeekSameWeekday', () => {
    it('should return last week same weekday for Monday', () => {
      const monday = '2025-01-27'; // Monday
      const result = getLastWeekSameWeekday(monday);
      expect(result).toBe('2025-01-20'); // Previous Monday
    });

    it('should return last week same weekday for Sunday', () => {
      const sunday = '2025-01-26'; // Sunday
      const result = getLastWeekSameWeekday(sunday);
      expect(result).toBe('2025-01-19'); // Previous Sunday
    });

    it('should handle month boundaries', () => {
      const firstOfMonth = '2025-02-03'; // Monday
      const result = getLastWeekSameWeekday(firstOfMonth);
      expect(result).toBe('2025-01-27'); // Previous Monday (previous month)
    });
  });

  describe('getRoutinesUsedOnDate', () => {
    it('should find routines used on specific date', () => {
      const routineLogs: Record<string, RoutineLog> = {
        'routine-1-2025-01-20': {
          routineId: 'routine-1',
          date: '2025-01-20',
          completedAt: '2025-01-20T10:00:00.000Z',
        },
        'routine-2-2025-01-20': {
          routineId: 'routine-2',
          date: '2025-01-20',
          completedAt: '2025-01-20T14:00:00.000Z',
        },
        'routine-1-2025-01-21': {
          routineId: 'routine-1',
          date: '2025-01-21',
          completedAt: '2025-01-21T10:00:00.000Z',
        },
      };

      const result = getRoutinesUsedOnDate(routineLogs, '2025-01-20');
      expect(result).toEqual(new Set(['routine-1', 'routine-2']));
    });

    it('should return empty set when no routines used on date', () => {
      const routineLogs: Record<string, RoutineLog> = {
        'routine-1-2025-01-20': {
          routineId: 'routine-1',
          date: '2025-01-20',
          completedAt: '2025-01-20T10:00:00.000Z',
        },
      };

      const result = getRoutinesUsedOnDate(routineLogs, '2025-01-21');
      expect(result).toEqual(new Set());
    });

    it('should handle empty routine logs', () => {
      const routineLogs: Record<string, RoutineLog> = {};
      const result = getRoutinesUsedOnDate(routineLogs, '2025-01-20');
      expect(result).toEqual(new Set());
    });
  });

  describe('orderRoutinesByWeekdayMirroring', () => {
    const createRoutine = (id: string, title: string): Routine => ({
      id,
      userId: 'test-user',
      title,
      linkedHabitIds: [],
      steps: [],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });

    it('should surface routines used last week on same weekday first', () => {
      const routines = [
        createRoutine('routine-1', 'Routine 1'),
        createRoutine('routine-2', 'Routine 2'),
        createRoutine('routine-3', 'Routine 3'),
      ];

      const routineLogs: Record<string, RoutineLog> = {
        'routine-2-2025-01-20': {
          routineId: 'routine-2',
          date: '2025-01-20', // Monday (last week)
          completedAt: '2025-01-20T10:00:00.000Z',
        },
      };

      const today = '2025-01-27'; // Monday (this week)
      const result = orderRoutinesByWeekdayMirroring(routines, routineLogs, today);

      // routine-2 should be first (used last week on Monday)
      expect(result[0].id).toBe('routine-2');
      expect(result.map((r) => r.id)).toEqual(['routine-2', 'routine-1', 'routine-3']);
    });

    it('should preserve original order within groups', () => {
      const routines = [
        createRoutine('routine-1', 'Routine 1'),
        createRoutine('routine-2', 'Routine 2'),
        createRoutine('routine-3', 'Routine 3'),
        createRoutine('routine-4', 'Routine 4'),
      ];

      const routineLogs: Record<string, RoutineLog> = {
        'routine-3-2025-01-20': {
          routineId: 'routine-3',
          date: '2025-01-20',
          completedAt: '2025-01-20T10:00:00.000Z',
        },
        'routine-1-2025-01-20': {
          routineId: 'routine-1',
          date: '2025-01-20',
          completedAt: '2025-01-20T14:00:00.000Z',
        },
      };

      const today = '2025-01-27';
      const result = orderRoutinesByWeekdayMirroring(routines, routineLogs, today);

      // Used routines first (preserving original order: 1, then 3)
      expect(result.map((r) => r.id)).toEqual(['routine-1', 'routine-3', 'routine-2', 'routine-4']);
    });

    it('should not reorder when no routines used last week', () => {
      const routines = [
        createRoutine('routine-1', 'Routine 1'),
        createRoutine('routine-2', 'Routine 2'),
      ];

      const routineLogs: Record<string, RoutineLog> = {};

      const today = '2025-01-27';
      const result = orderRoutinesByWeekdayMirroring(routines, routineLogs, today);

      // Original order preserved
      expect(result.map((r) => r.id)).toEqual(['routine-1', 'routine-2']);
    });

    it('should handle multiple routines used on same day', () => {
      const routines = [
        createRoutine('routine-1', 'Routine 1'),
        createRoutine('routine-2', 'Routine 2'),
        createRoutine('routine-3', 'Routine 3'),
      ];

      const routineLogs: Record<string, RoutineLog> = {
        'routine-1-2025-01-20': {
          routineId: 'routine-1',
          date: '2025-01-20',
          completedAt: '2025-01-20T10:00:00.000Z',
        },
        'routine-3-2025-01-20': {
          routineId: 'routine-3',
          date: '2025-01-20',
          completedAt: '2025-01-20T14:00:00.000Z',
        },
      };

      const today = '2025-01-27';
      const result = orderRoutinesByWeekdayMirroring(routines, routineLogs, today);

      // Both routine-1 and routine-3 should be first
      expect(result[0].id).toBe('routine-1');
      expect(result[1].id).toBe('routine-3');
      expect(result[2].id).toBe('routine-2');
    });
  });
});

