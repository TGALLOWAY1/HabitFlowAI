/**
 * Mobile e2e screenshot suite.
 *
 * Walks the entire app at an iPhone viewport (390×844) against the seeded
 * read-only demo dataset (started by e2e/serve.ts) and captures a reference
 * screenshot of every page, tab, modal, habit type (boolean, numeric, weekly,
 * checklist bundle, choice bundle), and major flow. The output under
 * e2e/screenshots/ is the visual spec handed to the native iPhone app team.
 *
 * Conventions:
 * - Navigation uses the demo boot params (`/?demo=1&embed=1&view=…`). `embed=1`
 *   keeps demo mode out of localStorage and hides the demo banner so shots
 *   show clean app chrome.
 * - Each test is independent (fresh page + URL); modals are reached by real
 *   taps, exactly like a user would.
 * - Screenshots are named `<section>/<nn>-<name>.png`; a manifest README is
 *   generated at the end of the run.
 */
import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');

interface ManifestEntry {
  section: string;
  file: string;
  title: string;
  description: string;
}
const manifest: ManifestEntry[] = [];

// Tests run in order (workers=1) but stay independent — one failed screenshot
// must not skip the rest of the suite, so no serial mode here.

/** Navigate to an app view in demo mode and wait for data to render. */
async function openApp(page: Page, params = ''): Promise<void> {
  await page.goto(`/?demo=1&embed=1${params}`);
  await page.waitForLoadState('networkidle');
  // Let lazy chunks, charts, and entry data settle.
  await page.waitForTimeout(1200);
}

async function snap(page: Page, section: string, name: string, title: string, description: string): Promise<void> {
  const dir = join(OUT_DIR, section);
  mkdirSync(dir, { recursive: true });
  const file = `${name}.png`;
  await page.screenshot({
    path: join(dir, file),
    fullPage: true,
    animations: 'disabled',
    // Full-page capture stitches beyond the viewport, which would paint the
    // fixed header/tab-bar mid-page — pin them to the document edges instead.
    style: 'body { position: relative; } header { position: absolute !important; } nav { position: absolute !important; }',
  });
  manifest.push({ section, file: `${section}/${file}`, title, description });
}

/** Viewport-only screenshot — used for modals/overlays. */
async function snapViewport(page: Page, section: string, name: string, title: string, description: string): Promise<void> {
  const dir = join(OUT_DIR, section);
  mkdirSync(dir, { recursive: true });
  const file = `${name}.png`;
  await page.screenshot({ path: join(dir, file), animations: 'disabled' });
  manifest.push({ section, file: `${section}/${file}`, title, description });
}

/**
 * Open the tracker in a given sub-view. The tracker defaults to the Today view
 * while habits load, so the target mode is always clicked explicitly ("All" is
 * the grid).
 */
async function openTracker(page: Page, mode: 'All' | 'Today' | 'Schedule' = 'All'): Promise<void> {
  await openApp(page, '&view=tracker');
  await page.getByRole('button', { name: mode, exact: true }).first().click();
  await page.waitForTimeout(800);
}

/** Select a tracker grid category pill by name. */
async function selectCategory(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.waitForTimeout(600);
}

/**
 * The innermost row container for a habit in the tracker grid — used to scope
 * that row's inline action buttons (View History / Edit Habit / …).
 */
function habitRow(page: Page, habitName: string) {
  return page
    .locator('div')
    .filter({ has: page.getByText(habitName, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Edit Habit' }) })
    .last();
}

// ---------------------------------------------------------------------------
// 00 · Warm-up (no screenshots) — let Vite pre-bundle the lazy chunks so later
// shots aren't taken mid-reload.
// ---------------------------------------------------------------------------
test('warm up the dev server', async ({ page }) => {
  test.setTimeout(300_000);
  for (const params of ['', '&view=tracker', '&view=goals', '&view=routines', '&view=journal', '&view=tasks', '&view=wellbeing-history', '&view=analytics', '&view=roadmap']) {
    await openApp(page, params);
  }
  await expect(page.getByText('HabitFlow').first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// 01 · Authentication
// ---------------------------------------------------------------------------
test('auth: login page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await snap(page, '01-auth', '01-login', 'Login', 'Email + password sign-in, forgot-password link, invite-code entry, and tour CTA. Default screen for unauthenticated users.');
});

test('auth: forgot password page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /forgot password/i }).click();
  await page.waitForTimeout(600);
  await snap(page, '01-auth', '02-forgot-password', 'Forgot Password', 'Email input; always shows a non-committal success message (no account enumeration).');
});

test('auth: invite redeem page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.waitForTimeout(600);
  await snap(page, '01-auth', '03-invite-redeem', 'Invite Redeem', 'Account creation with an invite code.');
});

// ---------------------------------------------------------------------------
// 02 · Dashboard
// ---------------------------------------------------------------------------
test('dashboard: main page', async ({ page }) => {
  await openApp(page);
  await page.waitForTimeout(1500); // heatmap + progress ring data
  await snap(page, '02-dashboard', '01-dashboard', 'Dashboard', 'Overview hub: Daily Habits completion ring, Wellbeing card (Morning/Evening/Health), Tasks and Journal cards, pinned routines, pinned goals, activity heatmap.');
});

test('dashboard: wellbeing overview modal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /^Wellbeing$/ }).first().click();
  await page.waitForTimeout(800);
  await snapViewport(page, '02-dashboard', '02-wellbeing-overview', 'Wellbeing Overview', "Today's check-in status (Morning/Evening/Sleep), 7-day trends, quick actions. Opened from the Wellbeing card chevron.");
});

test('dashboard: morning check-in modal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Morning' }).first().click();
  await page.waitForTimeout(800);
  await snapViewport(page, '02-dashboard', '03-morning-checkin', 'Morning Check-in', '"How do I feel right now?" — 5-point sliders (Mood, Energy, Anxiety, Motivation, Focus), notes, and Medications Taken Today.');
});

test('dashboard: evening check-in modal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Evening' }).first().click();
  await page.waitForTimeout(800);
  await snapViewport(page, '02-dashboard', '04-evening-checkin', 'Evening Check-in', '"How did today go?" — 5-point sliders (Satisfaction, Productivity, Mood, Stress, Enjoyment), reflection, day-impact tags.');
});

test('dashboard: health hub modal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Health', exact: true }).first().click();
  await page.waitForTimeout(600);
  await snapViewport(page, '02-dashboard', '05-health-hub', 'Health Hub', 'Entry points for Sleep, Medications, Supplements, Symptoms, Weight, and Caffeine logging.');
});

async function openHealthHubEntry(page: Page, label: string): Promise<void> {
  await openApp(page);
  await page.getByRole('button', { name: 'Health', exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: new RegExp(label) }).first().click();
  await page.waitForTimeout(700);
}

test('dashboard: sleep entry modal', async ({ page }) => {
  await openHealthHubEntry(page, 'Sleep');
  await snapViewport(page, '02-dashboard', '06-log-sleep', 'Log Sleep', 'Apple Watch sleep score + sub-scores, bedtime/wake pickers, duration, quality, last-night habit toggles, "Night of" date picker.');
});

test('dashboard: medication manager modal', async ({ page }) => {
  await openHealthHubEntry(page, 'Medications');
  await snapViewport(page, '02-dashboard', '07-medication-manager', 'Medication Manager', 'Add/edit/delete medications (dose, schedule), toggle active. Seeded with Loratadine 10mg.');
});

test('dashboard: supplement manager modal', async ({ page }) => {
  await openHealthHubEntry(page, 'Supplements');
  await snapViewport(page, '02-dashboard', '08-supplement-manager', 'Supplement Manager', "User-defined supplements (dose, schedule) + today's taken/not-taken toggle. Seeded with Vitamin D3 and Magnesium glycinate.");
});

test('dashboard: symptom manager modal', async ({ page }) => {
  await openHealthHubEntry(page, 'Symptoms');
  await snapViewport(page, '02-dashboard', '09-symptom-manager', 'Symptom Manager', "User-defined symptoms + today's 1–5 severity log. Seeded with Headache.");
});

test('dashboard: weight log modal', async ({ page }) => {
  await openHealthHubEntry(page, 'Weight');
  await snapViewport(page, '02-dashboard', '10-weight-log', 'Weight Log', 'Generic once-per-day numeric health factor logger (lbs).');
});

test('dashboard: caffeine log modal', async ({ page }) => {
  await openHealthHubEntry(page, 'Caffeine');
  await snapViewport(page, '02-dashboard', '11-caffeine-log', 'Caffeine Log', 'Additive caffeine logger with quick-add presets (Coffee 95mg, Espresso 63mg, Tea 47mg, Soda 40mg).');
});

// ---------------------------------------------------------------------------
// 03 · Global header: AI hub, settings, info, user menu
// ---------------------------------------------------------------------------
test('header: AI hub modal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'AI', exact: true }).click();
  await page.waitForTimeout(1200);
  await snapViewport(page, '03-header', '01-ai-hub', 'AI Hub', 'Wellbeing Summary, Weekly Review, and Journal Insights cards. Without a Gemini key each card shows the latest archived report inline (seeded sample reports).');
});

test('header: AI report history modal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'AI', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'View summary history' }).click();
  await page.waitForTimeout(800);
  await snapViewport(page, '03-header', '02-ai-report-history', 'AI Report History', 'Browse/open/delete archived AI reports of one kind.');
});

test('header: settings modal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(800);
  await snapViewport(page, '03-header', '03-settings', 'Settings', 'Preferences, API keys, notifications, data management, archived habits, and the "How HabitFlow works" tutorial entry.');
});

test('header: info modal — basics tab', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'How HabitFlow works' }).click();
  await page.waitForTimeout(600);
  await snapViewport(page, '03-header', '04-info-basics', 'How HabitFlow Works — Basics', 'User-facing reference for habit tracking types and core concepts.');
});

test('header: info modal — advanced tab', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'How HabitFlow works' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await page.waitForTimeout(400);
  await snapViewport(page, '03-header', '05-info-advanced', 'How HabitFlow Works — Advanced', 'Goal types, bundles, and advanced behaviors.');
});

test('header: info modal — AI tab', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'How HabitFlow works' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'AI', exact: true }).last().click();
  await page.waitForTimeout(400);
  await snapViewport(page, '03-header', '06-info-ai', 'How HabitFlow Works — AI', 'AI features reference (BYOK Gemini).');
});

test('header: archived habits modal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /View archived habits/ }).click();
  await page.waitForTimeout(600);
  await snapViewport(page, '03-header', '07-archived-habits', 'Archived Habits', 'Restore or permanently delete archived habits; archive preserves entry history.');
});

test('header: user menu', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.waitForTimeout(400);
  await snapViewport(page, '03-header', '08-user-menu', 'User Menu', 'Display name, hide/show streaks, analytics (beta), sign out / exit demo.');
});

// ---------------------------------------------------------------------------
// 04 · Habits tracker — grid, categories, habit types, bundles
// ---------------------------------------------------------------------------
test('tracker: grid — Health category (boolean, numeric, checklist bundle)', async ({ page }) => {
  await openTracker(page);
  await snap(page, '04-tracker', '01-grid-health', 'Tracker Grid — Health', 'Habit grid with day columns. Shows a boolean habit (Morning walk), numeric habit with target (Drink water, 8 glasses), and the Wind-Down Checklist bundle.');
});

test('tracker: today view — checklist bundle with children', async ({ page }) => {
  await openTracker(page, 'Today');
  // The Health section collapses once complete — expand it to show the bundle.
  await page.getByRole('button', { name: /^Health/ }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await snap(page, '04-tracker', '02-checklist-bundle', 'Checklist Bundle', 'Wind-Down Checklist bundle with child habits (No screens after 10pm, Evening stretch). Bundle completes when its success rule is met.');
});

test('tracker: grid — Fitness category (weekly habits, choice bundle)', async ({ page }) => {
  await openTracker(page);
  await selectCategory(page, 'Fitness');
  await snap(page, '04-tracker', '03-grid-fitness', 'Tracker Grid — Fitness', 'Weekly-frequency habits (Run 3×/week, Strength training 3×/week) and the Daily Movement choice bundle.');
});

test('tracker: today view — choice bundle options', async ({ page }) => {
  await openTracker(page, 'Today');
  // Day-view sections start expanded (completed ones collapse), so the
  // Fitness section with the choice bundle is already open.
  await page.getByText('Daily Movement').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await snap(page, '04-tracker', '04-choice-bundle', 'Choice Bundle', 'Daily Movement choice bundle — "Pick one" of Yoga session / Bike ride / Swim satisfies the habit for the day.');
});

test('tracker: grid — Mind and Productivity categories', async ({ page }) => {
  await openTracker(page);
  await selectCategory(page, 'Mind');
  await snap(page, '04-tracker', '05-grid-mind', 'Tracker Grid — Mind', 'Daily boolean habits (Read 20 minutes, Meditate) with streak display.');
  await selectCategory(page, 'Productivity');
  await snap(page, '04-tracker', '06-grid-productivity', 'Tracker Grid — Productivity', 'Deep work block: numeric habit (target 3 hours) scheduled on weekdays only (assigned days).');
});

test('tracker: numeric input popover', async ({ page }) => {
  await openTracker(page, 'Today');
  await page.getByRole('button', { name: /Edit quantity for/ }).first().click();
  await page.waitForTimeout(600);
  await snapViewport(page, '04-tracker', '07-numeric-popover', 'Numeric Entry Popover', 'Tapping a numeric habit opens quantity entry with quick-select chips and save/clear actions.');
});

test('tracker: habit history modal', async ({ page }) => {
  await openTracker(page);
  await habitRow(page, 'Morning walk').getByRole('button', { name: 'View History' }).click();
  await page.waitForTimeout(900);
  await snapViewport(page, '04-tracker', '09-habit-history', 'Habit History', 'Scrollable month calendar with entry markers plus per-date entry list; select a date to edit/create entries.');
});

test('tracker: edit habit modal (numeric habit)', async ({ page }) => {
  await openTracker(page);
  await habitRow(page, 'Drink water').getByRole('button', { name: 'Edit Habit' }).click();
  await page.waitForTimeout(800);
  await snapViewport(page, '04-tracker', '10-edit-habit-numeric', 'Edit Habit — Numeric', 'Add/Edit Habit modal in edit mode for a numeric habit: name, target value + unit, frequency, schedule, category, goal links.');
});

test('tracker: move to category modal', async ({ page }) => {
  await openTracker(page);
  await habitRow(page, 'Morning walk').getByRole('button', { name: 'Move to Category' }).click();
  await page.waitForTimeout(600);
  await snapViewport(page, '04-tracker', '11-category-picker', 'Category Picker', 'Move a habit to a different category.');
});

test('tracker: add to bundle modal', async ({ page }) => {
  await openTracker(page);
  await habitRow(page, 'Morning walk').getByRole('button', { name: 'Add to Bundle' }).click();
  await page.waitForTimeout(600);
  await snapViewport(page, '04-tracker', '12-bundle-picker', 'Bundle Picker', 'Select an existing bundle to add this habit to.');
});

test('tracker: add habit modal — regular habit', async ({ page }) => {
  await openTracker(page);
  await page.getByRole('button', { name: 'Add Habit' }).click();
  await page.waitForTimeout(700);
  await snapViewport(page, '04-tracker', '13-add-habit', 'Add Habit — Regular', 'Habit creation: Regular Habit vs Habit Bundle toggle, name, goal type (boolean/numeric), schedule & streak options, category, reminder.');
});

test('tracker: add habit modal — bundle modes', async ({ page }) => {
  await openTracker(page);
  await page.getByRole('button', { name: 'Add Habit' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Habit Bundle' }).click();
  await page.waitForTimeout(400);
  await snapViewport(page, '04-tracker', '14-add-habit-bundle', 'Add Habit — Bundle Modes', 'Bundle creation: Checklist ("do multiple items") vs Choice ("any one option satisfies") with sub-habit management.');
});

test('tracker: today view', async ({ page }) => {
  await openTracker(page, 'Today');
  await snap(page, '04-tracker', '15-today-view', 'Today View', 'Single-day view grouped by category with per-habit completion state.');
});

test('tracker: schedule view', async ({ page }) => {
  await openTracker(page, 'Schedule');
  await snap(page, '04-tracker', '16-schedule-view', 'Schedule (Weekly) View', 'Week-at-a-glance overview of scheduled habits.');
});

// ---------------------------------------------------------------------------
// 05 · Routines
// ---------------------------------------------------------------------------
test('routines: list page', async ({ page }) => {
  await openApp(page, '&view=routines');
  await snap(page, '05-routines', '01-routine-list', 'Routines List', 'Routine cards grouped by category; expanding a card reveals variants, start, edit, and delete.');
});

test('routines: card expanded with variants', async ({ page }) => {
  await openApp(page, '&view=routines');
  await page.getByText('Morning Kickstart').first().click();
  await page.waitForTimeout(600);
  await snap(page, '05-routines', '02-routine-expanded', 'Routine Card Expanded', 'Morning Kickstart expanded: Quick and Standard variants with step counts and estimated durations.');
});

test('routines: preview modal', async ({ page }) => {
  await openApp(page, '&view=routines');
  await page.getByText('Morning Kickstart').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Quick|Start Routine/ }).first().click();
  await page.waitForTimeout(700);
  await snapViewport(page, '05-routines', '03-routine-preview', 'Routine Preview', 'Read-only step list with timers and linked habits before starting the run.');
});

test('routines: runner modal', async ({ page }) => {
  await openApp(page, '&view=routines');
  await page.getByText('Morning Kickstart').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Quick|Start Routine/ }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Start/ }).first().click();
  await page.waitForTimeout(800);
  await snapViewport(page, '05-routines', '04-routine-runner', 'Routine Runner', 'Step-by-step execution: instructions, timer (countdown/stopwatch), linked habit logging, next/previous/skip.');
});

test('routines: editor modal', async ({ page }) => {
  await openApp(page, '&view=routines');
  await page.getByText('Morning Kickstart').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.waitForTimeout(800);
  await snapViewport(page, '05-routines', '05-routine-editor', 'Routine Editor', 'Title, category, image, variant tabs, step list with summary badges, and "Suggest with AI" (in demo: pre-authored drafts).');
});

test('routines: step editor panel', async ({ page }) => {
  await openApp(page, '&view=routines');
  await page.getByText('Morning Kickstart').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.getByText('Glass of water').first().click();
  await page.waitForTimeout(600);
  await snapViewport(page, '05-routines', '06-step-editor', 'Step Editor Panel', 'Per-step editing: title, instructions, timer mode, linked habit chips, image, tracking fields.');
});

// ---------------------------------------------------------------------------
// 06 · Goals
// ---------------------------------------------------------------------------
/** Expand a collapsed goals category stack ("Fitness (3)" etc.). */
async function expandGoalCategory(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${name} \\(`) }).first().click();
  await page.waitForTimeout(700);
}

test('goals: all (category stacks)', async ({ page }) => {
  await openApp(page, '&view=goals');
  await snap(page, '06-goals', '01-goals-all-collapsed', 'Goals — All (Collapsed)', 'Collapsible category stacks with goal counts. "New Track" and "+" create actions in header.');
  await expandGoalCategory(page, 'Fitness');
  await snap(page, '06-goals', '01b-goals-all-expanded', 'Goals — All (Fitness Expanded)', 'Fitness stack expanded: goal cards with progress bars plus the Distance Milestones track.');
});

test('goals: schedule calendar', async ({ page }) => {
  await openApp(page, '&view=goals');
  await page.getByRole('button', { name: 'Schedule' }).click();
  await page.waitForTimeout(1000);
  await snap(page, '06-goals', '02-goals-schedule', 'Goals — Schedule', 'Insight calendar with deadline/forecast/milestone event dots, category filter, and date detail panel.');
});

test('goals: achievements gallery', async ({ page }) => {
  await openApp(page, '&view=goals');
  await page.getByRole('button', { name: 'Achievements' }).click();
  await page.waitForTimeout(1000);
  await snap(page, '06-goals', '03-goals-achievements', 'Goals — Achievements', 'Three-section gallery: Single wins, Progressive iteration chains with milestone nodes, and Track rows with locked stubs.');
});

test('goals: detail — cumulative with milestones', async ({ page }) => {
  await openApp(page, '&view=goals');
  await expandGoalCategory(page, 'Productivity');
  await page.getByText('Log 150 hours of deep work').first().click();
  await page.waitForTimeout(1500);
  await snap(page, '06-goals', '04-goal-detail-cumulative', 'Goal Detail — Cumulative', 'Cumulative goal with milestone markers: progress charts, entry list, linked habits, deadline forecast.');
});

test('goals: detail — completed one-time goal', async ({ page }) => {
  await openApp(page, '&view=goals');
  await page.getByRole('button', { name: 'Achievements' }).click();
  await page.waitForTimeout(800);
  await page.getByText('Finish a 10K race').first().click();
  await page.waitForTimeout(1200);
  await snap(page, '06-goals', '05-goal-detail-onetime', 'Goal Detail — One-time (Completed)', 'A completed one-time goal (Finish a 10K race).');
});

test('goals: track detail', async ({ page }) => {
  await openApp(page, '&view=goals');
  await expandGoalCategory(page, 'Fitness');
  await page.getByText('Distance Milestones').first().click();
  await page.waitForTimeout(1200);
  await snap(page, '06-goals', '06-goal-track-detail', 'Goal Track Detail', 'Ordered stage goals (Run 40 → 80 → 150 miles) with per-stage states and progress.');
});

test('goals: create goal — step 1 cumulative', async ({ page }) => {
  await openApp(page, '&view=goals');
  await page.getByRole('button', { name: 'Create Goal' }).click();
  await page.waitForTimeout(700);
  await snapViewport(page, '06-goals', '07-create-goal-cumulative', 'Create Goal — Cumulative', 'Step 1: title, Cumulative/One-time type, milestone rows + final target, unit, deadline, category.');
});

test('goals: create goal — one-time type', async ({ page }) => {
  await openApp(page, '&view=goals');
  await page.getByRole('button', { name: 'Create Goal' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /One.?time/i }).click();
  await page.waitForTimeout(400);
  await snapViewport(page, '06-goals', '08-create-goal-onetime', 'Create Goal — One-time', 'One-time goal variant: title, event date, category.');
});

test('goals: edit goal modal', async ({ page }) => {
  await openApp(page, '&view=goals');
  await expandGoalCategory(page, 'Productivity');
  await page.getByRole('button', { name: 'Edit Goal' }).first().click();
  await page.waitForTimeout(800);
  await snapViewport(page, '06-goals', '09-edit-goal', 'Edit Goal', 'Modify goal title, milestones, target, deadline, and linked habits.');
});

test('goals: delete goal confirmation', async ({ page }) => {
  await openApp(page, '&view=goals');
  await expandGoalCategory(page, 'Productivity');
  await page.getByText('Log 150 hours of deep work').first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Delete goal' }).click();
  await page.waitForTimeout(600);
  await snapViewport(page, '06-goals', '11-delete-goal-confirm', 'Delete Goal Confirmation', 'Soft-delete confirmation dialog from the goal detail page.');
});

test('goals: create track modal', async ({ page }) => {
  await openApp(page, '&view=goals');
  await page.getByRole('button', { name: 'New Track' }).click();
  await page.waitForTimeout(600);
  await snapViewport(page, '06-goals', '10-create-track', 'Create Goal Track', 'Create an ordered track of staged goals.');
});

// ---------------------------------------------------------------------------
// 07 · Journal
// ---------------------------------------------------------------------------
test('journal: free write tab', async ({ page }) => {
  await openApp(page, '&view=journal&tab=free');
  await snap(page, '07-journal', '01-free-write', 'Journal — Free Write', 'Freeform journal entry editor.');
});

test('journal: templates tab', async ({ page }) => {
  await openApp(page, '&view=journal&tab=templates');
  await snap(page, '07-journal', '02-templates', 'Journal — Templates', 'Template-based guided journaling.');
});

test('journal: history tab', async ({ page }) => {
  await openApp(page, '&view=journal&tab=history');
  await snap(page, '07-journal', '03-history', 'Journal — History', 'Past entries list (seeded with ~10 entries).');
});

test('journal: AI review tab', async ({ page }) => {
  await openApp(page, '&view=journal&tab=review');
  await page.waitForTimeout(800);
  await snap(page, '07-journal', '04-ai-review', 'Journal — AI Review', 'AI journal insights (seeded sample report shown inline in demo).');
});

// ---------------------------------------------------------------------------
// 08 · Tasks
// ---------------------------------------------------------------------------
test('tasks: page', async ({ page }) => {
  await openApp(page, '&view=tasks');
  await snap(page, '08-tasks', '01-tasks', 'Tasks', 'Today and Inbox columns with inline rename, complete, move, and delete actions.');
});

// ---------------------------------------------------------------------------
// 09 · Insights (Wellbeing analytics)
// ---------------------------------------------------------------------------
const INSIGHTS_TABS: Array<{ label: string; name: string; description: string }> = [
  { label: 'AI Review', name: '01-ai-review', description: 'Gemini narrative over wellbeing data (seeded sample shown in demo).' },
  { label: 'Overview', name: '02-overview', description: 'Discoveries, top correlations, metric averages, heatmap/weekly/multiples.' },
  { label: 'Correlations', name: '03-correlations', description: "What's helping / what's holding you back (Cohen's d cross-domain correlations)." },
  { label: 'Habits', name: '04-habits', description: 'Habit stats and habit↔wellbeing correlations.' },
  { label: 'Medications', name: '05-medications', description: 'Adherence and medication↔wellbeing correlations.' },
  { label: 'Predictions', name: '06-predictions', description: 'Linear-trend projections.' },
];

for (const tab of INSIGHTS_TABS) {
  test(`insights: ${tab.label} tab`, async ({ page }) => {
    await openApp(page, '&view=wellbeing-history');
    await page.getByRole('button', { name: tab.label, exact: true }).first().click();
    await page.waitForTimeout(1500);
    await snap(page, '09-insights', tab.name, `Insights — ${tab.label}`, tab.description);
  });
}

// ---------------------------------------------------------------------------
// 10 · Analytics (beta)
// ---------------------------------------------------------------------------
const ANALYTICS_TABS: Array<{ tab: string; name: string; title: string; description: string }> = [
  { tab: 'habits', name: '01-habits', title: 'Analytics — Habits', description: 'Habit completion statistics and trends.' },
  { tab: 'routines', name: '02-routines', title: 'Analytics — Routines', description: 'Routine completion history and stats.' },
  { tab: 'goals', name: '03-goals', title: 'Analytics — Goals', description: 'Goal progress analytics.' },
  { tab: 'sleep', name: '04-sleep', title: 'Analytics — Sleep', description: 'Sleep score, consistency, bedtime/wake trends, correlation factors, weekly summary, "Edit a night" list.' },
];

for (const t of ANALYTICS_TABS) {
  test(`analytics: ${t.tab} tab`, async ({ page }) => {
    await openApp(page, `&view=analytics&tab=${t.tab}`);
    await page.waitForTimeout(1500);
    await snap(page, '10-analytics', t.name, t.title, t.description);
  });
}

// ---------------------------------------------------------------------------
// 11 · Other pages
// ---------------------------------------------------------------------------
test('misc: roadmap page', async ({ page }) => {
  await openApp(page, '&view=roadmap');
  await snap(page, '11-misc', '01-roadmap', 'Roadmap', 'Future functionality with status chips (In Development / Planned / Exploring); shipped features never appear here.');
});

test('misc: tour page', async ({ page }) => {
  await openApp(page, '&view=tour');
  await page.waitForTimeout(2500); // embedded live preview iframe boots the app
  await snap(page, '11-misc', '02-tour', 'Take a Tour', 'Guided walkthrough pairing narrative panels with a live read-only preview of the real app.');
});

// ---------------------------------------------------------------------------
// Manifest generation
// ---------------------------------------------------------------------------
test.afterAll(() => {
  if (manifest.length === 0) return;
  mkdirSync(OUT_DIR, { recursive: true });

  // Merge with the manifest from previous runs so a filtered run (`-g …`)
  // refreshes its own entries without dropping the rest of the gallery.
  const manifestPath = join(OUT_DIR, 'manifest.json');
  const existing: ManifestEntry[] = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestEntry[])
    : [];
  const byFile = new Map(existing.map((m) => [m.file, m]));
  for (const entry of manifest) byFile.set(entry.file, entry);
  const merged = [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file));
  writeFileSync(manifestPath, JSON.stringify(merged, null, 2));

  const sections = [...new Set(merged.map((m) => m.section))];
  const lines: string[] = [
    '# HabitFlow — Mobile Screenshot Reference',
    '',
    'Full-app screenshot set captured at iPhone size (390×844 @2x, mobile Chromium) from the',
    'seeded demo dataset. Regenerate with `npm run screenshots:mobile` (see `e2e/README.md`).',
    '',
    'Intended audience: developers building the native iPhone app — every page, tab, modal,',
    'habit type (boolean, numeric, weekly-frequency, checklist bundle, choice bundle), and',
    'major flow is captured below.',
    '',
  ];
  for (const section of sections) {
    const pretty = section.replace(/^\d+-/, '');
    lines.push(`## ${pretty.charAt(0).toUpperCase()}${pretty.slice(1)}`, '');
    for (const entry of merged.filter((m) => m.section === section)) {
      lines.push(`### ${entry.title}`, '', entry.description, '', `![${entry.title}](${entry.file})`, '');
    }
  }
  writeFileSync(join(OUT_DIR, 'README.md'), lines.join('\n'));
});
