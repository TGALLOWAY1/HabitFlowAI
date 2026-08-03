// Ad-hoc DOM probe for selector debugging (not part of the suite).
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function dump(label, fn) {
  console.log(`\n===== ${label} =====`);
  try {
    await fn();
    console.log(await page.locator('body').ariaSnapshot());
  } catch (err) {
    console.log('PROBE ERROR:', err.message);
  }
}

await dump('tracker ALL (grid)', async () => {
  await page.goto('http://localhost:5176/?demo=1&embed=1&view=tracker');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.waitForTimeout(1000);
});

await dump('goals page', async () => {
  await page.goto('http://localhost:5176/?demo=1&embed=1&view=goals');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
});

await dump('AI hub modal', async () => {
  await page.goto('http://localhost:5176/?demo=1&embed=1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'AI', exact: true }).click();
  await page.waitForTimeout(1200);
});

await browser.close();
