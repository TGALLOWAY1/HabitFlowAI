/**
 * HabitEntry Repository Guardrails Tests
 * 
 * Tests that guardrails prevent storing completion/progress fields.
 */

import { describe, it, expect } from 'vitest';
import { createHabitEntry } from '../habitEntryRepository';

describe('HabitEntry Repository Guardrails', () => {
  it('should throw error when trying to persist completed field', async () => {
    const entry = {
      habitId: 'test-habit',
      dayKey: '2025-01-15',
      timestamp: new Date().toISOString(),
      value: 1,
      source: 'manual' as const,
      completed: true, // Forbidden field
    };

    await expect(
      createHabitEntry(entry, 'test-user')
    ).rejects.toThrow('Cannot persist completion/progress fields');
  });

  it('should throw error when trying to persist isComplete field', async () => {
    const entry = {
      habitId: 'test-habit',
      dayKey: '2025-01-15',
      timestamp: new Date().toISOString(),
      value: 1,
      source: 'manual' as const,
      isComplete: true, // Forbidden field
    };

    await expect(
      createHabitEntry(entry, 'test-user')
    ).rejects.toThrow('Cannot persist completion/progress fields');
  });

  it('should throw error when trying to persist progress field', async () => {
    const entry = {
      habitId: 'test-habit',
      dayKey: '2025-01-15',
      timestamp: new Date().toISOString(),
      value: 1,
      source: 'manual' as const,
      progress: 0.5, // Forbidden field
    };

    await expect(
      createHabitEntry(entry, 'test-user')
    ).rejects.toThrow('Cannot persist completion/progress fields');
  });

  it('should throw error when trying to persist streak field', async () => {
    const entry = {
      habitId: 'test-habit',
      dayKey: '2025-01-15',
      timestamp: new Date().toISOString(),
      value: 1,
      source: 'manual' as const,
      streak: 5, // Forbidden field
    };

    await expect(
      createHabitEntry(entry, 'test-user')
    ).rejects.toThrow('Cannot persist completion/progress fields');
  });
});

