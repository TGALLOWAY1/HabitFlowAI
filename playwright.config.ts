/**
 * Playwright config for the mobile e2e screenshot suite (e2e/).
 *
 * Renders the app in a real iPhone-sized Chromium viewport (390×844, touch,
 * mobile UA) against the seeded demo environment started by e2e/serve.ts.
 * Not a pass/fail regression suite — its output is the screenshot set under
 * e2e/screenshots/ used as a reference for the native iPhone app.
 *
 * Run: npm run screenshots:mobile
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Sandboxed environments ship a pre-installed Chromium that may not match the
// npm-installed Playwright's pinned browser build; prefer it when present.
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';

const iphone = devices['iPhone 14'];

export default defineConfig({
  testDir: './e2e',
  testMatch: /mobile-screenshots\.spec\.ts/,
  timeout: 90_000,
  // Screenshots are captured in a deliberate, numbered order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...iphone,
    // Fail fast on a missed selector instead of eating the whole test timeout.
    actionTimeout: 15_000,
    browserName: 'chromium',
    // Full app viewport (Playwright's device preset subtracts Safari chrome).
    viewport: { width: 390, height: 844 },
    // DPR 2 keeps PNGs half the size of true iPhone DPR 3 with no layout change.
    deviceScaleFactor: 2,
    baseURL: 'http://localhost:5176',
    launchOptions: existsSync(PREINSTALLED_CHROMIUM) ? { executablePath: PREINSTALLED_CHROMIUM } : {},
  },
  webServer: {
    command: 'npx tsx e2e/serve.ts',
    url: 'http://localhost:5176',
    reuseExistingServer: true,
    // First run may download a MongoDB binary.
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
