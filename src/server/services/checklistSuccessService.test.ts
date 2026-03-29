/**
 * Checklist Success Service Tests
 *
 * Unit tests for success rule evaluation logic.
 * No MongoDB or external dependencies required.
 */

import { describe, it, expect } from 'vitest';
import { evaluateChecklistSuccess } from './checklistSuccessService';

describe('evaluateChecklistSuccess', () => {
  describe('default (no rule / full)', () => {
    it('should require all items complete', () => {
      const result = evaluateChecklistSuccess(3, 3);
      expect(result.meetsSuccessRule).toBe(true);
      expect(result.isFullyComplete).toBe(true);
    });

    it('should fail when not all items complete', () => {
      const result = evaluateChecklistSuccess(2, 3);
      expect(result.meetsSuccessRule).toBe(false);
      expect(result.isFullyComplete).toBe(false);
    });

    it('should fail when zero items complete', () => {
      const result = evaluateChecklistSuccess(0, 3);
      expect(result.meetsSuccessRule).toBe(false);
      expect(result.isFullyComplete).toBe(false);
    });

    it('should fail when total is zero', () => {
      const result = evaluateChecklistSuccess(0, 0);
      expect(result.meetsSuccessRule).toBe(false);
      expect(result.isFullyComplete).toBe(false);
    });
  });

  describe('full rule (explicit)', () => {
    it('should match default behavior', () => {
      const result = evaluateChecklistSuccess(3, 3, { type: 'full' });
      expect(result.meetsSuccessRule).toBe(true);
      expect(result.isFullyComplete).toBe(true);
    });

    it('should fail when partial', () => {
      const result = evaluateChecklistSuccess(2, 3, { type: 'full' });
      expect(result.meetsSuccessRule).toBe(false);
    });
  });

  describe('any rule', () => {
    it('should succeed with 1 of many', () => {
      const result = evaluateChecklistSuccess(1, 5, { type: 'any' });
      expect(result.meetsSuccessRule).toBe(true);
      expect(result.isFullyComplete).toBe(false);
    });

    it('should succeed when all complete', () => {
      const result = evaluateChecklistSuccess(5, 5, { type: 'any' });
      expect(result.meetsSuccessRule).toBe(true);
      expect(result.isFullyComplete).toBe(true);
    });

    it('should fail with 0 complete', () => {
      const result = evaluateChecklistSuccess(0, 5, { type: 'any' });
      expect(result.meetsSuccessRule).toBe(false);
    });
  });

  describe('threshold rule', () => {
    it('should succeed when meeting threshold', () => {
      const result = evaluateChecklistSuccess(3, 5, { type: 'threshold', threshold: 3 });
      expect(result.meetsSuccessRule).toBe(true);
    });

    it('should succeed when exceeding threshold', () => {
      const result = evaluateChecklistSuccess(4, 5, { type: 'threshold', threshold: 3 });
      expect(result.meetsSuccessRule).toBe(true);
    });

    it('should fail when below threshold', () => {
      const result = evaluateChecklistSuccess(2, 5, { type: 'threshold', threshold: 3 });
      expect(result.meetsSuccessRule).toBe(false);
    });

    it('should fall back to total when threshold not specified', () => {
      const result = evaluateChecklistSuccess(4, 5, { type: 'threshold' });
      expect(result.meetsSuccessRule).toBe(false);
    });
  });

  describe('percent rule', () => {
    it('should succeed at exactly the percentage', () => {
      const result = evaluateChecklistSuccess(3, 5, { type: 'percent', percent: 60 });
      expect(result.meetsSuccessRule).toBe(true);
    });

    it('should succeed when exceeding percentage', () => {
      const result = evaluateChecklistSuccess(4, 5, { type: 'percent', percent: 60 });
      expect(result.meetsSuccessRule).toBe(true);
    });

    it('should fail when below percentage', () => {
      const result = evaluateChecklistSuccess(2, 5, { type: 'percent', percent: 60 });
      expect(result.meetsSuccessRule).toBe(false);
    });

    it('should handle 100% correctly', () => {
      const result = evaluateChecklistSuccess(5, 5, { type: 'percent', percent: 100 });
      expect(result.meetsSuccessRule).toBe(true);
    });

    it('should fall back to 100% when percent not specified', () => {
      const result = evaluateChecklistSuccess(4, 5, { type: 'percent' });
      expect(result.meetsSuccessRule).toBe(false);
    });
  });

  describe('isFullyComplete is independent of rule', () => {
    it('any rule: isFullyComplete true only when all done', () => {
      expect(evaluateChecklistSuccess(3, 5, { type: 'any' }).isFullyComplete).toBe(false);
      expect(evaluateChecklistSuccess(5, 5, { type: 'any' }).isFullyComplete).toBe(true);
    });

    it('threshold rule: isFullyComplete true only when all done', () => {
      expect(evaluateChecklistSuccess(3, 5, { type: 'threshold', threshold: 3 }).isFullyComplete).toBe(false);
      expect(evaluateChecklistSuccess(5, 5, { type: 'threshold', threshold: 3 }).isFullyComplete).toBe(true);
    });
  });
});
