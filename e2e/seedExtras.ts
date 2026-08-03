/**
 * Screenshot-only seed extras, layered on top of the public showcase seed.
 *
 * The showcase dataset (src/server/demo/seedShowcase.ts) covers boolean,
 * numeric, and weekly habits plus a checklist bundle — but not a choice
 * bundle. The screenshot suite must show every habit type, so this adds a
 * "Daily Movement" choice bundle (pick one of Yoga / Bike ride / Swim) with
 * two weeks of entries. Kept out of the showcase seed on purpose: this data
 * exists only for the screenshot environment, never for the production demo.
 */
import { DEMO_USER_ID, PUBLIC_DEMO_HOUSEHOLD_ID } from '../src/shared/demo';
import { MONGO_COLLECTIONS } from '../src/models/persistenceTypes';
import { getDb } from '../src/server/lib/mongoClient';
import { createHabit } from '../src/server/repositories/habitRepository';
import { upsertHabitEntry } from '../src/server/repositories/habitEntryRepository';

const HH = PUBLIC_DEMO_HOUSEHOLD_ID;
const UID = DEMO_USER_ID;

/** DayKey (YYYY-MM-DD, UTC) for `daysAgo` days before today — matches the showcase seed. */
function dayKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function seedScreenshotExtras(): Promise<void> {
  const db = await getDb();
  const habits = db.collection(MONGO_COLLECTIONS.HABITS);
  if (await habits.findOne({ userId: UID, name: 'Daily Movement', deletedAt: { $exists: false } })) {
    return; // already seeded
  }

  const fitness = await db
    .collection(MONGO_COLLECTIONS.CATEGORIES)
    .findOne<{ id: string }>({ userId: UID, name: 'Fitness', deletedAt: { $exists: false } });
  if (!fitness) {
    throw new Error('seedScreenshotExtras must run after seedDemoShowcase (Fitness category missing)');
  }

  // Choice bundle children — each a real habit, hidden under the parent.
  const options = ['Yoga session', 'Bike ride', 'Swim'];
  const children = [];
  for (let i = 0; i < options.length; i++) {
    children.push(
      await createHabit(
        { categoryId: fitness.id, name: options[i], goal: { type: 'boolean', frequency: 'daily' }, type: 'boolean', order: 10 + i },
        HH,
        UID
      )
    );
  }
  const bundle = await createHabit(
    {
      categoryId: fitness.id,
      name: 'Daily Movement',
      goal: { type: 'boolean', frequency: 'daily' },
      type: 'bundle',
      bundleType: 'choice',
      subHabitIds: children.map((c) => c.id),
      order: 2,
    },
    HH,
    UID
  );
  await habits.updateMany(
    { userId: UID, id: { $in: children.map((c) => c.id) } },
    { $set: { bundleParentId: bundle.id } }
  );

  // Two weeks of choices (skip every third day so the grid shows misses too).
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    if (daysAgo % 3 === 2) continue;
    const child = children[daysAgo % children.length];
    await upsertHabitEntry(bundle.id, dayKeyDaysAgo(daysAgo), HH, UID, {
      value: 1,
      choiceChildHabitId: child.id,
      timestamp: `${dayKeyDaysAgo(daysAgo)}T14:00:00.000Z`,
      source: 'manual',
    });
  }
}
