import { describe, expect, it } from 'vitest';
import { calculateCategoryMomentum, calculateGlobalMomentum } from './momentumService';

describe('momentumService DayKey boundaries', () => {
  it('anchors the seven-day window to the caller-supplied local day', () => {
    const logs = [
      { habitId: 'habit-1', date: '2026-08-02', completed: true },
      { habitId: 'habit-1', date: '2026-08-01', completed: true },
      { habitId: 'habit-1', date: '2026-07-27', completed: true },
      { habitId: 'habit-1', date: '2026-07-26', completed: true },
    ];

    expect(calculateGlobalMomentum(logs, '2026-08-02')).toEqual({
      state: 'Building',
      activeDays: 3,
    });
    expect(calculateGlobalMomentum(logs, '2026-08-01')).toEqual({
      state: 'Building',
      activeDays: 3,
    });
  });

  it('applies the same local boundary to category momentum', () => {
    const logs = [
      { habitId: 'included', date: '2026-08-02', completed: true },
      { habitId: 'excluded', date: '2026-08-01', completed: true },
      { habitId: 'included', date: '2026-07-26', completed: true },
    ];

    expect(calculateCategoryMomentum(logs, ['included'], '2026-08-02')).toEqual({
      state: 'Building',
      activeDays: 1,
    });
  });
});
