/**
 * BundleMembership Repository Tests
 *
 * Integration tests for the BundleMembership repository.
 * Uses mongodb-memory-server — no external MongoDB required.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import {
  createMembership,
  endMembership,
  archiveMembership,
  getMembershipById,
  getActiveMemberships,
  getMembershipsForDay,
  getMembershipsByParent,
  getMembershipsByChild,
  deleteMembership,
  hasActiveMembership,
} from '../bundleMembershipRepository';

const TEST_HOUSEHOLD_ID = 'test-household-bm';
const TEST_USER_ID = 'test-user-bm';

describe('BundleMembershipRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('bundleMemberships').deleteMany({});
  });

  describe('createMembership', () => {
    it('should create a membership with required fields', async () => {
      const m = await createMembership(
        'parent-1', 'child-1', '2026-01-01',
        TEST_HOUSEHOLD_ID, TEST_USER_ID
      );

      expect(m.id).toBeDefined();
      expect(m.parentHabitId).toBe('parent-1');
      expect(m.childHabitId).toBe('child-1');
      expect(m.activeFromDayKey).toBe('2026-01-01');
      expect(m.activeToDayKey).toBeNull();
      expect(m.archivedAt).toBeNull();
      expect(m.createdAt).toBeDefined();
      expect(m.updatedAt).toBeDefined();
    });

    it('should create a membership with activeToDayKey', async () => {
      const m = await createMembership(
        'parent-1', 'child-1', '2026-01-01',
        TEST_HOUSEHOLD_ID, TEST_USER_ID, '2026-03-31'
      );

      expect(m.activeToDayKey).toBe('2026-03-31');
    });
  });

  describe('endMembership', () => {
    it('should set activeToDayKey on active membership', async () => {
      const m = await createMembership(
        'parent-1', 'child-1', '2026-01-01',
        TEST_HOUSEHOLD_ID, TEST_USER_ID
      );

      const result = await endMembership(
        'parent-1', 'child-1', '2026-03-31',
        TEST_HOUSEHOLD_ID, TEST_USER_ID
      );
      expect(result).toBe(true);

      const updated = await getMembershipById(m.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(updated?.activeToDayKey).toBe('2026-03-31');
    });

    it('should not end an already-ended membership', async () => {
      await createMembership(
        'parent-1', 'child-1', '2026-01-01',
        TEST_HOUSEHOLD_ID, TEST_USER_ID, '2026-03-31'
      );

      const result = await endMembership(
        'parent-1', 'child-1', '2026-06-30',
        TEST_HOUSEHOLD_ID, TEST_USER_ID
      );
      expect(result).toBe(false);
    });
  });

  describe('archiveMembership', () => {
    it('should set archivedAt', async () => {
      const m = await createMembership(
        'parent-1', 'child-1', '2026-01-01',
        TEST_HOUSEHOLD_ID, TEST_USER_ID
      );

      const result = await archiveMembership(m.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(result).toBe(true);

      const updated = await getMembershipById(m.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(updated?.archivedAt).toBeDefined();
      expect(updated?.archivedAt).not.toBeNull();
    });
  });

  describe('getActiveMemberships', () => {
    it('should return only memberships without activeToDayKey', async () => {
      await createMembership('parent-1', 'child-1', '2026-01-01', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      await createMembership('parent-1', 'child-2', '2026-01-01', TEST_HOUSEHOLD_ID, TEST_USER_ID, '2026-03-31');
      await createMembership('parent-1', 'child-3', '2026-04-01', TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const active = await getActiveMemberships('parent-1', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(active).toHaveLength(2);
      expect(active.map(m => m.childHabitId).sort()).toEqual(['child-1', 'child-3']);
    });
  });

  describe('getMembershipsForDay', () => {
    it('should return memberships active on a specific day', async () => {
      // child-1: Jan-Mar
      await createMembership('parent-1', 'child-1', '2026-01-01', TEST_HOUSEHOLD_ID, TEST_USER_ID, '2026-03-31');
      // child-2: Mar-Jun
      await createMembership('parent-1', 'child-2', '2026-03-01', TEST_HOUSEHOLD_ID, TEST_USER_ID, '2026-06-30');
      // child-3: Jun-present
      await createMembership('parent-1', 'child-3', '2026-06-01', TEST_HOUSEHOLD_ID, TEST_USER_ID);

      // Feb 15: only child-1
      const feb = await getMembershipsForDay('parent-1', '2026-02-15', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(feb).toHaveLength(1);
      expect(feb[0].childHabitId).toBe('child-1');

      // Mar 15: child-1 AND child-2 (overlap)
      const mar = await getMembershipsForDay('parent-1', '2026-03-15', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(mar).toHaveLength(2);
      expect(mar.map(m => m.childHabitId).sort()).toEqual(['child-1', 'child-2']);

      // May 15: only child-2
      const may = await getMembershipsForDay('parent-1', '2026-05-15', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(may).toHaveLength(1);
      expect(may[0].childHabitId).toBe('child-2');

      // Jul 15: only child-3 (no end date)
      const jul = await getMembershipsForDay('parent-1', '2026-07-15', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(jul).toHaveLength(1);
      expect(jul[0].childHabitId).toBe('child-3');

      // Dec 2025: before any membership
      const before = await getMembershipsForDay('parent-1', '2025-12-15', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(before).toHaveLength(0);
    });
  });

  describe('getMembershipsByParent', () => {
    it('should return all memberships for a parent', async () => {
      await createMembership('parent-1', 'child-1', '2026-01-01', TEST_HOUSEHOLD_ID, TEST_USER_ID, '2026-03-31');
      await createMembership('parent-1', 'child-2', '2026-04-01', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      await createMembership('parent-2', 'child-3', '2026-01-01', TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const memberships = await getMembershipsByParent('parent-1', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(memberships).toHaveLength(2);
    });
  });

  describe('getMembershipsByChild', () => {
    it('should return all memberships for a child', async () => {
      await createMembership('parent-1', 'child-1', '2026-01-01', TEST_HOUSEHOLD_ID, TEST_USER_ID, '2026-03-31');
      await createMembership('parent-2', 'child-1', '2026-04-01', TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const memberships = await getMembershipsByChild('child-1', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(memberships).toHaveLength(2);
    });
  });

  describe('deleteMembership', () => {
    it('should hard delete a membership', async () => {
      const m = await createMembership(
        'parent-1', 'child-1', '2026-01-01',
        TEST_HOUSEHOLD_ID, TEST_USER_ID
      );

      const result = await deleteMembership(m.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(result).toBe(true);

      const deleted = await getMembershipById(m.id, TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(deleted).toBeNull();
    });
  });

  describe('hasActiveMembership', () => {
    it('should detect duplicate active membership', async () => {
      await createMembership('parent-1', 'child-1', '2026-01-01', TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const hasDuplicate = await hasActiveMembership('parent-1', 'child-1', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(hasDuplicate).toBe(true);

      const noDuplicate = await hasActiveMembership('parent-1', 'child-2', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(noDuplicate).toBe(false);
    });

    it('should not consider ended membership as active', async () => {
      await createMembership('parent-1', 'child-1', '2026-01-01', TEST_HOUSEHOLD_ID, TEST_USER_ID, '2026-03-31');

      const result = await hasActiveMembership('parent-1', 'child-1', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(result).toBe(false);
    });
  });

  describe('scoping', () => {
    it('should not return memberships from other households', async () => {
      await createMembership('parent-1', 'child-1', '2026-01-01', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      await createMembership('parent-1', 'child-1', '2026-01-01', 'other-household', 'other-user');

      const memberships = await getMembershipsByParent('parent-1', TEST_HOUSEHOLD_ID, TEST_USER_ID);
      expect(memberships).toHaveLength(1);
    });
  });
});
