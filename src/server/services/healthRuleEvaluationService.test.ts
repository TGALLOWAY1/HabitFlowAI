import { describe, it, expect } from 'vitest';
import { evaluateHealthRule } from './healthRuleEvaluationService';
import type { HabitHealthRule, HealthMetricDaily } from '../../models/persistenceTypes';

function makeRule(overrides: Partial<HabitHealthRule> = {}): HabitHealthRule {
  return {
    id: 'rule-1',
    userId: 'user-1',
    habitId: 'habit-1',
    sourceType: 'apple_health',
    metricType: 'steps',
    operator: '>=',
    thresholdValue: 10000,
    behavior: 'auto_log',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMetric(overrides: Partial<HealthMetricDaily> = {}): HealthMetricDaily {
  return {
    id: 'metric-1',
    userId: 'user-1',
    dayKey: '2026-03-15',
    source: 'apple_health',
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-03-15T00:00:00Z',
    ...overrides,
  };
}

describe('evaluateHealthRule', () => {
  describe('>= operator', () => {
    it('satisfied when value meets threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'steps', operator: '>=', thresholdValue: 10000 }),
        makeMetric({ steps: 10000 })
      );
      expect(result).toEqual({ satisfied: true, metricValue: 10000 });
    });

    it('satisfied when value exceeds threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'steps', operator: '>=', thresholdValue: 10000 }),
        makeMetric({ steps: 12000 })
      );
      expect(result).toEqual({ satisfied: true, metricValue: 12000 });
    });

    it('not satisfied when value below threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'steps', operator: '>=', thresholdValue: 10000 }),
        makeMetric({ steps: 5000 })
      );
      expect(result).toEqual({ satisfied: false, metricValue: 5000 });
    });
  });

  describe('<= operator', () => {
    it('satisfied when value at threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'weight', operator: '<=', thresholdValue: 180 }),
        makeMetric({ weight: 180 })
      );
      expect(result).toEqual({ satisfied: true, metricValue: 180 });
    });

    it('satisfied when value below threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'weight', operator: '<=', thresholdValue: 180 }),
        makeMetric({ weight: 175 })
      );
      expect(result).toEqual({ satisfied: true, metricValue: 175 });
    });

    it('not satisfied when value above threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'weight', operator: '<=', thresholdValue: 180 }),
        makeMetric({ weight: 185 })
      );
      expect(result).toEqual({ satisfied: false, metricValue: 185 });
    });
  });

  describe('> operator', () => {
    it('not satisfied when value equals threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'active_calories', operator: '>', thresholdValue: 500 }),
        makeMetric({ activeCalories: 500 })
      );
      expect(result).toEqual({ satisfied: false, metricValue: 500 });
    });

    it('satisfied when value exceeds threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'active_calories', operator: '>', thresholdValue: 500 }),
        makeMetric({ activeCalories: 501 })
      );
      expect(result).toEqual({ satisfied: true, metricValue: 501 });
    });
  });

  describe('< operator', () => {
    it('not satisfied when value equals threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'sleep_hours', operator: '<', thresholdValue: 8 }),
        makeMetric({ sleepHours: 8 })
      );
      expect(result).toEqual({ satisfied: false, metricValue: 8 });
    });

    it('satisfied when value below threshold', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'sleep_hours', operator: '<', thresholdValue: 8 }),
        makeMetric({ sleepHours: 6 })
      );
      expect(result).toEqual({ satisfied: true, metricValue: 6 });
    });
  });

  describe('exists operator', () => {
    it('satisfied when value is present and > 0', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'workout_minutes', operator: 'exists' }),
        makeMetric({ workoutMinutes: 30 })
      );
      expect(result).toEqual({ satisfied: true, metricValue: 30 });
    });

    it('not satisfied when value is null', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'workout_minutes', operator: 'exists' }),
        makeMetric({ workoutMinutes: null })
      );
      expect(result).toEqual({ satisfied: false, metricValue: null });
    });

    it('not satisfied when value is undefined', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'workout_minutes', operator: 'exists' }),
        makeMetric({})
      );
      expect(result).toEqual({ satisfied: false, metricValue: null });
    });

    it('not satisfied when value is 0', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'workout_minutes', operator: 'exists' }),
        makeMetric({ workoutMinutes: 0 })
      );
      expect(result).toEqual({ satisfied: false, metricValue: 0 });
    });
  });

  describe('null/undefined metric values', () => {
    it('returns not satisfied with null metricValue for comparison operators', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'steps', operator: '>=', thresholdValue: 10000 }),
        makeMetric({ steps: null })
      );
      expect(result).toEqual({ satisfied: false, metricValue: null });
    });

    it('returns not satisfied when metric field missing', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'steps', operator: '>=', thresholdValue: 10000 }),
        makeMetric({})
      );
      expect(result).toEqual({ satisfied: false, metricValue: null });
    });

    it('returns not satisfied when threshold is null', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'steps', operator: '>=', thresholdValue: null }),
        makeMetric({ steps: 10000 })
      );
      expect(result).toEqual({ satisfied: false, metricValue: 10000 });
    });
  });

  describe('all metric types', () => {
    it('evaluates steps', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'steps', operator: '>=', thresholdValue: 5000 }),
        makeMetric({ steps: 7000 })
      );
      expect(result.satisfied).toBe(true);
      expect(result.metricValue).toBe(7000);
    });

    it('evaluates sleep_hours', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'sleep_hours', operator: '>=', thresholdValue: 7 }),
        makeMetric({ sleepHours: 8.5 })
      );
      expect(result.satisfied).toBe(true);
      expect(result.metricValue).toBe(8.5);
    });

    it('evaluates workout_minutes', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'workout_minutes', operator: '>=', thresholdValue: 30 }),
        makeMetric({ workoutMinutes: 45 })
      );
      expect(result.satisfied).toBe(true);
      expect(result.metricValue).toBe(45);
    });

    it('evaluates active_calories', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'active_calories', operator: '>=', thresholdValue: 400 }),
        makeMetric({ activeCalories: 450 })
      );
      expect(result.satisfied).toBe(true);
      expect(result.metricValue).toBe(450);
    });

    it('evaluates weight', () => {
      const result = evaluateHealthRule(
        makeRule({ metricType: 'weight', operator: '<=', thresholdValue: 180 }),
        makeMetric({ weight: 175.5 })
      );
      expect(result.satisfied).toBe(true);
      expect(result.metricValue).toBe(175.5);
    });
  });
});
