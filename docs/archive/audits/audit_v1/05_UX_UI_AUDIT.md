# UX/UI Audit (V1 Practical Product)

## Top Pain Points
| Priority | Pain point | Evidence | UX impact |
| --- | --- | --- | --- |
| 1 | Logging affordance is overloaded and ambiguous in grid | Single-click delayed 300ms + double-click delete path (`src/components/TrackerGrid.tsx:1151-1186`) | High friction and accidental behavior, especially on touch devices. |
| 2 | Choice bundle flow is inconsistent between grid and day view | Day view has unresolved choice state TODO (`src/components/day-view/DayCategorySection.tsx:141-143`), grid uses legacy virtual-option logic | Users can see contradictory completion states across views. |
| 3 | Routine completion path blurs "support" vs "completion" | Runner offers "Complete + Log Habits" action (`src/components/RoutineRunnerModal.tsx:266-275`) and backend auto-upserts entries (`src/server/routes/routines.ts:817-838`) | Conceptual confusion; routine feels like tracker instead of helper. |
| 4 | Dashboard/goal views feel jittery and expensive | 100ms polling in `ProgressDashboard` and `useGoalsWithProgress` (`src/components/ProgressDashboard.tsx:113-120`, `src/lib/useGoalsWithProgress.ts:79-81`) | UI feels unstable under load and drains battery on mobile. |
| 5 | iPhone modal ergonomics/accessibility are inconsistent | Modal overlays are largely div-based without standardized dialog semantics/focus management (example `src/components/RoutineRunnerModal.tsx:126-147`) | Keyboard and assistive use degrade; focus can escape modal. |
| 6 | PWA install polish is weak | Manifest uses `vite.svg` as app icons (`public/manifest.webmanifest:11-21`) | Installed app feels unfinished and less trustworthy. |

## Flow Friction Notes
- **Too many state layers for one action**: habit toggle updates local log cache, calls entry APIs, triggers recompute, then refreshes full day summary (`src/store/HabitContext.tsx:372-435`).
- **Feedback inconsistency after actions**: some flows silently fail to console only (routine submit catch in UI, task actions, evidence fetch).
- **Desktop-first interaction assumptions**: hover menus and dblclick patterns dominate routines/tracker workflows.

## Quick Wins (1-2 Hours Each)
1. Replace double-click delete with explicit delete mode button per cell/row on mobile.
- Touch-safe action; removes 300ms single-click delay.

2. Remove forbidden `completed` field from choice upserts.
- Prevent silent failure in deselect path.

3. Fix evidence response contract.
- Return `{ evidence }` from `GET /api/evidence` or update client expectation; unblock hint surfacing.

4. Standardize modal accessibility baseline.
- Add `role="dialog"`, `aria-modal="true"`, Escape close, initial focus for top 3 modals (Add Habit, Routine Runner, Goal Edit).

5. Improve PWA manifest assets.
- Replace `vite.svg` with real 192/512 PNG icons.

## Medium Lifts (1-3 Days)
1. Unify logging interactions across Grid and Day views.
- One canonical interaction model for boolean/numeric/choice habits.
- Prevent mismatched state between `TrackerGrid` and `DayView`.

2. Move tracker UI to entries-first state reads.
- Use day view/entry views as display truth, reduce DayLog cache-dependent local bookkeeping.

3. Remove 100ms polling loops.
- Replace with event-driven invalidation (`habitflow:*` events + targeted refetch).

4. Streamline goal detail loading.
- Replace N habit-by-habit entry fetches with a single backend goal-detail payload built from EntryViews.

## Suggested Interaction Redesigns (V1-Friendly)
1. **One-tap logging model**
- Tap = toggle/quick log.
- Long press (or explicit kebab) = edit value, backfill, delete.
- Avoid double-click semantics entirely.

2. **Day as primary logging surface, Grid as historical scan**
- Keep Day view optimized for "today" completion.
- Keep Grid for trends/history and bulk review only.

3. **Routine completion separation**
- "Complete Routine" should only end routine session.
- Habit confirmations should be explicit post-routine checklist (one-tap per suggested habit).

4. **Goal detail simplification**
- Keep: progress bar, recent contributions, linked habits.
- De-emphasize manual progress UI in V1 and favor habit-based contribution prompts.

## Desktop vs iPhone/PWA Summary
- Desktop is feature-complete but cluttered by parallel legacy paths.
- iPhone/PWA usability is most hurt by interaction assumptions (double-click, modal focus, nested scroll/sticky regions).
- V1 should prioritize deterministic, single-action logging and clear post-action feedback over adding more visual modules.
