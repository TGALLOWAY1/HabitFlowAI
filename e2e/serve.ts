/**
 * Screenshot environment launcher.
 *
 * Boots the full HabitFlow stack against a throwaway MongoDB with the public
 * read-only demo enabled, then seeds the showcase dataset (plus screenshot
 * extras, e.g. a choice bundle) so every screen has realistic data:
 *
 *   1. MongoDB       — `e2e/.cache/mongod` if present (see e2e/fetch-mongod.mjs),
 *                      otherwise mongodb-memory-server (downloads a binary).
 *   2. Express API   — port 3001, PUBLIC_DEMO_ENABLED so `/?demo=1` works.
 *   3. Vite frontend — port 5176 (proxies /api to 3001, per vite.config.ts).
 *
 * Readiness contract: Vite only starts listening after the seed completes, so
 * "port 5176 responds" (Playwright's webServer check) implies the API is up
 * and the demo data exists.
 *
 * Run directly: `npx tsx e2e/serve.ts` — or let `npm run screenshots:mobile`
 * start it via Playwright's webServer.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const API_PORT = 3001;
const VITE_PORT = 5176;
const MONGO_PORT = 27333;

interface MongoHandle {
  uri: string;
  stop: () => Promise<void>;
}

async function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ok = await new Promise<boolean>((resolve) => {
      const sock = net.connect(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(true); });
      sock.once('error', () => resolve(false));
    });
    if (ok) return;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for port ${port}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** Start mongod from the local cache, or fall back to mongodb-memory-server. */
async function startMongo(): Promise<MongoHandle> {
  const cachedMongod = process.env.MONGOD_BIN ?? join(HERE, '.cache', 'mongod');
  if (existsSync(cachedMongod)) {
    const dbPath = mkdtempSync(join(tmpdir(), 'habitflow-screens-db-'));
    console.log(`[screenshot-env] starting ${cachedMongod} on port ${MONGO_PORT}`);
    const child: ChildProcess = spawn(
      cachedMongod,
      ['--dbpath', dbPath, '--port', String(MONGO_PORT), '--bind_ip', '127.0.0.1', '--quiet'],
      { stdio: ['ignore', 'ignore', 'inherit'] }
    );
    child.on('exit', (code) => {
      if (code !== null && code !== 0) console.error(`[screenshot-env] mongod exited with code ${code}`);
    });
    await waitForPort(MONGO_PORT);
    return {
      uri: `mongodb://127.0.0.1:${MONGO_PORT}`,
      stop: async () => {
        child.kill('SIGTERM');
        rmSync(dbPath, { recursive: true, force: true });
      },
    };
  }

  console.log('[screenshot-env] no cached mongod — using mongodb-memory-server');
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  return { uri: mem.getUri(), stop: () => mem.stop().then(() => undefined) };
}

async function main(): Promise<void> {
  const mongo = await startMongo();

  // Must be set before any server module is imported (config reads env eagerly).
  process.env.MONGODB_URI = mongo.uri;
  process.env.MONGODB_DB_NAME = 'habitflow_screenshots';
  process.env.PUBLIC_DEMO_ENABLED = 'true';
  process.env.PORT = String(API_PORT);

  const { createApp } = await import('../src/server/app');
  const app = createApp();
  const apiServer = app.listen(API_PORT, () => {
    console.log(`[screenshot-env] API listening on http://localhost:${API_PORT}`);
  });

  const { seedDemoShowcase } = await import('../src/server/demo/seedShowcase');
  const seedResult = await seedDemoShowcase({ force: true });
  console.log(`[screenshot-env] showcase seed: ${seedResult.reason}`);
  const { seedScreenshotExtras } = await import('./seedExtras');
  await seedScreenshotExtras();
  console.log('[screenshot-env] screenshot extras seeded');

  // Serve a production build rather than the dev server: dev mode injects
  // dev-only chrome (identity panel, demo seed buttons) that crowds the
  // 390px header and doesn't represent the shipped UI. SKIP_BUILD=1 reuses
  // the existing dist/ during spec iteration.
  const { build, preview } = await import('vite');
  if (process.env.SKIP_BUILD !== '1' || !existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.log('[screenshot-env] building frontend (vite build)…');
    await build({ configFile: join(ROOT, 'vite.config.ts'), root: ROOT, logLevel: 'warn' });
  }
  const vite = await preview({
    configFile: join(ROOT, 'vite.config.ts'),
    root: ROOT,
    preview: {
      port: VITE_PORT,
      proxy: {
        '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
        '/uploads': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
      },
    },
  });
  console.log(`[screenshot-env] ready — app at http://localhost:${VITE_PORT}/?demo=1`);

  const shutdown = async (): Promise<void> => {
    console.log('[screenshot-env] shutting down…');
    await vite.close();
    apiServer.close();
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[screenshot-env] failed to start:', err);
  process.exit(1);
});
