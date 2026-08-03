// Ad-hoc DOM probe for selector debugging (not part of the suite).
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page.goto('http://localhost:5176/?demo=1&embed=1&view=goals');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /^Productivity \(/ }).first().click();
await page.waitForTimeout(1000);
console.log('==== productivity expanded ====');
console.log(await page.locator('body').ariaSnapshot());
await page.getByText('Log 150 hours of deep work').first().click();
await page.waitForTimeout(1800);
console.log('==== goal detail ====');
console.log(await page.locator('body').ariaSnapshot());
await browser.close();
