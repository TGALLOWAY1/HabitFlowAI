/**
 * HabitEntry CRUD Persona Regression Tests
 *
 * Persona must be view-only and must never affect HabitEntry create/edit/delete.
 *
 * We simulate "persona switching" by sending persona hints (header/query/body)
 * and assert the backend behavior and responses are identical.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { createHabitEntryRoute, updateHabitEntryRoute, deleteHabitEntryRoute } from '../habitEntries';
import { getDb, closeConnection } from '../../lib/mongoClient';
import { createHabit } from '../../repositories/habitRepository';
import { createCategory } from '../../repositories/categoryRepository';

const TEST_DB_NAME = 'test_habitflow_persona_regression';
const TEST_USER_ID = 'test-user-persona-regression';

let app: Express;
let testHabitId: string;

beforeAll(async () => {
  // Ensure we use a test DB
  process.env.MONGODB_DB_NAME = TEST_DB_NAME;
  process.env.USE_MONGO_PERSISTENCE = 'true';

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).userId = TEST_USER_ID;
    next();
  });

  app.post('/api/entries', createHabitEntryRoute);
  app.patch('/api/entries/:id', updateHabitEntryRoute);
  app.delete('/api/entries/:id', deleteHabitEntryRoute);
});

afterAll(async () => {
  await closeConnection();
});

beforeEach(async () => {
  const db = await getDb();
  await db.collection('categories').deleteMany({ userId: TEST_USER_ID });
  await db.collection('habits').deleteMany({ userId: TEST_USER_ID });
  await db.collection('habitEntries').deleteMany({ userId: TEST_USER_ID });

  const category = await createCategory({ name: 'Test Category', color: '#000000' }, TEST_USER_ID);
  const habit = await createHabit({ name: 'Test Habit', categoryId: category.id, type: 'boolean' } as any, TEST_USER_ID);
  testHabitId = habit.id;
});

async function runCrudFlow(personaHints: { header?: string; query?: any; bodyExtra?: any }) {
  // Create
  const createRes = await request(app)
    .post('/api/entries')
    .set(personaHints.header ? { 'X-Persona': personaHints.header } : {})
    .query(personaHints.query || {})
    .send({
      habitId: testHabitId,
      dayKey: '2025-02-01',
      value: 1,
      source: 'manual',
      ...(personaHints.bodyExtra || {}),
    });

  expect(createRes.status).toBe(201);
  expect(createRes.body.entry).toBeDefined();
  const entryId = createRes.body.entry.id;

  // Update
  const updateRes = await request(app)
    .patch(`/api/entries/${entryId}`)
    .set(personaHints.header ? { 'X-Persona': personaHints.header } : {})
    .query(personaHints.query || {})
    .send({
      value: 2,
      ...(personaHints.bodyExtra || {}),
    });

  expect(updateRes.status).toBe(200);
  expect(updateRes.body.entry.value).toBe(2);

  // Delete
  const deleteRes = await request(app)
    .delete(`/api/entries/${entryId}`)
    .set(personaHints.header ? { 'X-Persona': personaHints.header } : {})
    .query(personaHints.query || {})
    .send(personaHints.bodyExtra || {});

  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.success).toBe(true);

  return { createRes: createRes.body, updateRes: updateRes.body, deleteRes: deleteRes.body };
}

describe('HabitEntry CRUD is identical regardless of persona hints', () => {
  it('should behave the same with no persona hints vs emotional_wellbeing hints', async () => {
    const baseline = await runCrudFlow({ header: undefined, query: undefined, bodyExtra: undefined });

    const withHints = await runCrudFlow({
      header: 'emotional_wellbeing',
      query: { persona: 'emotional_wellbeing' },
      bodyExtra: { personaId: 'emotional_wellbeing', activePersonaId: 'emotional_wellbeing' },
    });

    // Core schema expectations should be identical (ignore IDs/timestamps)
    expect(!!baseline.createRes.entry.habitId).toBe(true);
    expect(baseline.createRes.entry.habitId).toBe(withHints.createRes.entry.habitId);
    expect(baseline.createRes.entry.dayKey).toBe(withHints.createRes.entry.dayKey);
    expect(baseline.updateRes.entry.value).toBe(withHints.updateRes.entry.value);
    expect(baseline.deleteRes.success).toBe(withHints.deleteRes.success);

    // Ensure no persona fields are persisted on the entry object (guarded/stripped)
    expect((withHints.createRes.entry as any).personaId).toBeUndefined();
    expect((withHints.createRes.entry as any).activePersonaId).toBeUndefined();
  });
});


