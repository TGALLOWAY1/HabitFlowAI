/**
 * Seed (or force-refresh) the public demo showcase dataset.
 *
 * Usage:
 *   npm run seed:showcase            # seed if missing/stale
 *   npm run seed:showcase -- --force # wipe demo user data and reseed
 *
 * Writes only to the fixed demo identity (see src/shared/demo.ts).
 */
import '../src/server/config/env';
import { seedDemoShowcase } from '../src/server/demo/seedShowcase';
import { closeConnection } from '../src/server/lib/mongoClient';

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const result = await seedDemoShowcase({ force });
  console.log(`[seed-showcase] ${result.seeded ? `Dataset ${result.reason}` : 'Dataset fresh — skipped'}`);
}

main()
  .catch((err) => {
    console.error('[seed-showcase] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeConnection();
  });
