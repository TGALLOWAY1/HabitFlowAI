# Task 2 — Route, Screen, Modal, and Screenshot Inventory

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Full read of `src/App.tsx` (867 lines), `src/components/AuthGate.tsx`,
`Layout.tsx`, `BottomTabBar.tsx`, and `docs/product/HABITFLOW_UI_ARCHITECTURE.md`
(584 lines); every page in `src/pages/` and every modal component in `src/components/**`
accounted for; mount points verified by grep. Screenshots: none exist in the repo
(`DECISIONS.md` 2026-08-03) — this inventory is code-derived, cross-checked against the
UI architecture doc.

---

## 1. Routing model

### Query-string routes (`?view=`)

Routing is hand-rolled in `src/App.tsx`. `parseRouteFromLocation` (`App.tsx:76-119`) maps
`?view=` to the `AppRoute` union (`App.tsx:78`); `buildUrlForRoute` (`App.tsx:121-141`)
writes URLs; popstate is handled at `App.tsx:251-266`. Dashboard is the default (empty
`?view` and any unknown value).

| `?view=` value | Renders | Notes |
|---|---|---|
| *(none)* / unknown | Dashboard (`ProgressDashboard`) | default branch `App.tsx:117` |
| `dashboard`, `progress`, `streak-dashboard`, `streaks` | Dashboard | last three are legacy aliases (`App.tsx:82-86`) |
| `tracker`, `daily` | Tracker | `daily` legacy alias (`App.tsx:91-96`) |
| `day` | Tracker | legacy redirect — old Day view is now the tracker's "Today" toggle (`App.tsx:101-102`) |
| `routines` | `RoutineList` | |
| `goals` | `GoalsPage` (or detail/track/schedule/achievements — see §3) | |
| `wins` | `WinArchivePage` | legacy route kept alive (`App.tsx:568-577`) |
| `journal` | `JournalPage` | `&tab=` deep-link: `free\|templates\|history\|review` (`App.tsx:687-690`) |
| `tasks` | `TasksPage` | |
| `analytics` | `AnalyticsPage` | `&tab=` deep-link: `habits\|routines\|goals\|sleep` (`App.tsx:695-700`); beta-gated inside the page (`AnalyticsPage.tsx:53`) |
| `wellbeing-history` | `WellbeingHistoryPage` = the **Insights** page | 6 tabs, default `ai-review` (`WellbeingHistoryPage.tsx:16,33`); beta-gated (`:10`) |
| `health` | `AppleHealthPage` | feature-gated server-side |
| `tour` | `TourPage` | also renders pre-login (see §2) |
| `roadmap` | `RoadmapPage` | also renders pre-login |
| `debug-entries` | `DebugEntriesPage` | **no env gate** — reachable in production (`App.tsx:693-694`); only `DevIdentityPanel` is DEV-gated (`App.tsx:854`) |

### Other URL params

- `goalId` → `GoalDetailPage`; `trackId` → `GoalTrackDetailPage` (state hydrated from URL,
  `App.tsx:195-202`). `?view=goals&goalId=…` is the only documented deep-link form.
- `tab` → journal/analytics tab deep-links (cleared for other routes, `App.tsx:274`).
- `demo=1|0` → demo mode boot (`src/main.tsx:9`, `applyDemoBootParams`); `embed=1` → tour
  iframe mode (history `replaceState` instead of `pushState`, `App.tsx:296-300`).

### Path routes

Exactly one: **`/reset-password`** (emailed reset link) — selected in
`AuthGate.tsx:26-30`, cleaned back to `/` after use (`AuthGate.tsx:39-43`). Everything
else lives on `/` + query string. (`ROADMAP.md` lists path-based URLs as planned,
unshipped.)

## 2. Pre-auth surface (AuthGate state machine)

`src/components/AuthGate.tsx` renders children when authenticated; otherwise an internal
`AuthView` state machine (`'login' | 'invite' | 'forgot' | 'reset' | 'tour' | 'roadmap'`,
`AuthGate.tsx:23`):

| Screen | Component | Entered via |
|---|---|---|
| Login | `src/pages/LoginPage.tsx` | default; "Explore the live demo" CTA currently hidden (`SHOW_DEMO_CTA = false`, `LoginPage.tsx:21,164`) |
| Invite Redeem | `src/pages/InviteRedeemPage.tsx` | "Have an invite code?" |
| Forgot Password | `src/pages/ForgotPasswordPage.tsx` | "Forgot password?" |
| Reset Password | `src/pages/ResetPasswordPage.tsx` | `/reset-password?token=…` |
| Tour (auth mode) | `src/pages/TourPage.tsx` (`mode="auth"`) | "Take the tour" on Login (`AuthGate.tsx:73-91`) |
| Roadmap (auth mode) | `src/pages/RoadmapPage.tsx` (`mode="auth"`) | from Tour (`AuthGate.tsx:92-104`) |

## 3. Authenticated screens

### Chrome (always mounted)

- **Header** (`Layout.tsx:125-235`): logo, LIVE DEMO badge (demo mode), ✨ AI button →
  `AIStudioModal`, ⚙ Settings button → `SettingsModal`, user menu (display name/email,
  hide/show streaks, beta-only "Analysis (Beta)" → analytics, sign out / exit demo).
  Header modals also open via window events `habitflow:open-settings` / `habitflow:open-ai`
  (`Layout.tsx:83-103`) — used by the tour's deep links.
- **Bottom tab bar** (`BottomTabBar.tsx`): **4 tabs — Dashboard, Habits, Routines, Goals.**
  Journal and Tasks are *not* tabs (the `TabRoute` type includes them but the rendered
  `tabs` array does not, `BottomTabBar.tsx:4,11-16`).
- **Demo chrome**: read-only banner above content (`Layout.tsx:241-253`), write-blocked
  toast (`Layout.tsx:46-56`), dev-only seed/reset demo buttons (`Layout.tsx:142-159`).

### Main views and sub-views

| Screen | Component | Sub-views / notes |
|---|---|---|
| Dashboard | `src/components/ProgressDashboard.tsx` | Setup guide (`SetupDashboard`), `DailyOverviewCard`, `WellbeingCard`, `TasksCard`, `JournalCard`, `PinnedRoutinesCard`, goals-at-a-glance (`GoalPulseCard`), activity heatmap (`ActivitySection`) — imports at `ProgressDashboard.tsx:3-15` |
| Tracker | `TrackerGrid` / `DayView` / `ScheduleView` | 3-mode toggle **All / Today / Schedule** (`App.tsx:459-481,614-655`); default mode is Today for brand-new users, All otherwise (`App.tsx:214-216`) |
| Routines | `src/components/RoutineList.tsx` | card list; create/edit/preview/run wire to modals (`App.tsx:677-683`) |
| Goals | `GoalsPage` + mode toggle **All / Schedule / Achievements** (`App.tsx:434-456`) | Schedule → `GoalScheduleView`; Achievements → `WinArchivePage` (`App.tsx:711-725`) |
| Goal Detail | `src/pages/goals/GoalDetailPage.tsx` | via `goalId` (`App.tsx:578-603`) |
| Goal Track Detail | `src/pages/goals/GoalTrackDetailPage.tsx` | via `trackId` (`App.tsx:604-613`) |
| Goal Completed | `src/pages/goals/GoalCompletedPage.tsx` | via `GoalCompletionContext` state, not URL (`App.tsx:511-567`); Extend/Repeat actions call `iterateGoal`/`createGoal` |
| Journal | `src/pages/JournalPage.tsx` | tabs Free / Templates / History / AI Review |
| Tasks | `src/pages/TasksPage.tsx` | Today + Inbox columns |
| Analytics | `src/pages/AnalyticsPage.tsx` | tabs Habits / Routines / Goals / Sleep; beta-gated |
| Insights | `src/pages/WellbeingHistoryPage.tsx` | tabs AI Review (default) / Overview / Correlations / Habits / Medications / Predictions; beta-gated |
| Apple Health | `src/pages/AppleHealthPage.tsx` | feature-gated |
| Tour | `src/pages/TourPage.tsx` | drives an embedded live preview iframe (`/?demo=1&embed=1`) via postMessage; can deep-link routes, tabs, header modals, and the routine editor (`App.tsx:303-345`) |
| Roadmap | `src/pages/RoadmapPage.tsx` | |
| Debug Entries | `src/pages/DebugEntriesPage.tsx` | dev tool, un-gated route |

## 4. Modal inventory (complete, from code)

30 modal components exist. Mount points verified by grep.

**Habits / tracker** — `AddHabitModal` (create/edit/bundle-convert; mounted `App.tsx:747`),
`HabitHistoryModal` (`App.tsx:760` and inside `TrackerGrid`), `HabitLogModal`,
`CategoryPickerModal`, `BundlePickerModal`, `DeleteHabitConfirmModal` (= the doc's
"Remove Habit" modal; mounted in `TrackerGrid.tsx:12` and `day-view/HabitGridCell.tsx`),
`ConvertBundleConfirmModal`, `ArchivedHabitsModal` (from Settings),
`HabitCreationInlineModal` (inline habit create inside `CreateGoalModal.tsx:5`).
Non-modal overlay: `NumericInputPopover` (quantity quick-entry).

**Routines** — `RoutineEditorModal` (contains `StepEditorPanel` slide-in panel and
`VariantEditor`/`VariantCard`), `RoutineRunnerModal`, `RoutinePreviewModal`,
`CompletedHabitsModal` (runner completion summary). All orchestrated from
`App.tsx:769-796`.

**Goals** — `CreateGoalModal` (**a 2-step modal**: details → link habits;
`CreateGoalModal.tsx:16,127-129`), `CreateGoalTrackModal` (`App.tsx:803`, also
`GoalDetailPage`), `EditGoalModal`, `DeleteGoalConfirmModal`,
`GoalCreationInlineModal` (inline goal create inside `AddHabitModal.tsx`),
`MilestoneCelebrationModal` (global watcher via `useMilestoneCelebrationWatcher`,
`App.tsx:811-822`).

**Wellbeing** (all under `src/components/wellbeing/`, mounted from
`ProgressDashboard.tsx:4-7`) — `WellbeingOverviewModal`, `WellbeingCheckInModal`
(one component, morning + evening modes), `HealthHubModal` (hosts `SleepEntryForm`,
weight/caffeine via `HealthFactorLogModal`), `MedicationManagerModal`,
`SupplementManagerModal`, `SymptomManagerModal`, `HealthFactorLogModal`.
`SleepEntryForm` also mounts in `analytics/sleep/SleepAnalytics.tsx` ("Edit a night").

**Header / global** — `SettingsModal` (`Layout.tsx:256`), `InfoModal` ("How HabitFlow
works", from Settings), `AIStudioModal` (AI hub, `Layout.tsx:265`),
`AIReportHistoryModal` (from AI cards and `JournalReviewPanel`).

## 5. Cross-check: UI architecture doc vs code

`docs/product/HABITFLOW_UI_ARCHITECTURE.md` is **substantially accurate** — every page it
lists exists, tab structures match (journal 4, analytics 4, insights 6 with `ai-review`
default), demo/tour behavior matches, and its "Known UX Issues" §8 all reverified true
(including #13: Debug Entries un-gated). Discrepancies found:

1. **Goal creation flow type — doc contradicts itself; code says modal.** §7 claims
   "Multi-step creation → Full-page flow (goals: 2 steps)" and §6 names components
   `CreateGoalPage` / `CreateGoalLinkHabits` that do not exist. Reality: a single 2-step
   modal, `src/components/CreateGoalModal.tsx` (step state at line 16). The doc's own §3
   inventory rows correctly say "Modal".
2. **Tracker sub-view naming.** Doc calls the third mode "Weekly View"; the rendered
   toggle labels are **All / Today / Schedule** and the component is `ScheduleView`
   (`App.tsx:461-464`).
3. **"Five primary domains … each accessible from the bottom tab bar"** (§2) — lists four,
   and the tab bar has four (`BottomTabBar.tsx:11-16`). Internal wording slip; the rest of
   the doc says 4 tabs.
4. **Modals table omissions** (§3 lists 17; code has 30 modal components):
   `MilestoneCelebrationModal`, `CreateGoalTrackModal` (referenced in a page row but has
   no modal row), `GoalCreationInlineModal`, `AIReportHistoryModal` (present in the §2
   hierarchy but absent from the table), and `ConvertBundleConfirmModal` *is* listed —
   fine. Doc's Morning/Evening check-in rows are two modes of one component.
5. **Stale footer.** §10 says "Last Updated: 2026-07-01" but git shows content updates
   through 2026-08-02 — the footer isn't maintained.
6. Doc's count line "16 pages + 17 modals" undercounts modals per (4).

None of these undermine the doc's structure; trust rating from Task 1 (High, verify
details) stands.

## 6. Suspected bug (recorded, not fixed)

**Stale `trackId` survives navigation and hijacks reload.** `buildUrlForRoute` clears
`goalId` and `tab` but never `trackId` (`App.tsx:130-132`). `selectedTrackId` hydrates
from the URL on load (`App.tsx:199-202`) and its render branch takes precedence over
`view` (`App.tsx:604`). Consequence: navigate Track Detail → any tab (URL keeps
`trackId=…&view=dashboard`), then reload → the app renders Track Detail instead of the
Dashboard. Not verified at runtime (no browser run during discovery); code paths are
consistent with the failure. → carried to Task 12.

## 7. Notes relevant to iOS planning (not expanded here)

- Primary nav = 4 tabs; Journal, Tasks, Insights, Analytics, Apple Health, Settings are
  reachable only through dashboard cards, header icons, or the user menu — an iOS IA
  decision point (doc §8 flags the same discoverability gaps).
- Only deep-link forms in use: `?view=…`, `?view=goals&goalId=…`, `&tab=…`, `/reset-password`.
  Push notifications deep-link `/?view=routines` style URLs (`tasks/todo.md`).
- Modal-heavy UX: creation/editing is modal everywhere (habits, routines, goals);
  `RoutineEditorModal` nests a panel (step editor) and sub-editors — on iOS these map more
  naturally to pushed screens/sheets. Detail belongs to Task 13.
- The tour's embedded-iframe + postMessage mechanism (`App.tsx:303-345`) is web-only and
  will not port.
