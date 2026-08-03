# Task 12 — Test Coverage, Dead Code, Contradictions, and Suspected Defects

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Full test-suite run in this environment; test inventory mapped to domains;
`HABITFLOW_BUG_ANALYSIS.md` and `tasks/lessons.md` reconciled against current code;
all contradictions and suspected defects from Tasks 1–11 consolidated (each verified in
its originating task — this register cites the doc that holds the evidence).

---

## 1. Test-suite health (first full run vs the 9-file CI gate)

`npx vitest run` on 2026-08-03, this container:

- **589 passed · 1 failed · 439 skipped** (vitest reported 118 files; 117 `*.test.ts(x)`
  files exist on disk — the extra is a non-`.test.` entry vitest picked up) (91.9 s).
- The 52 "failed files" / 439 skips are an **environment artifact**: mongodb-memory-server
  cannot download its binary through this sandbox's proxy (403 from fastdl.mongodb.org),
  so every DB-backed suite aborted at setup. Not an application signal.
- **One genuine failure:** `src/utils/goalUtils.test.ts` — "should exclude goals with
  invalid categoryId". `buildGoalStacks` now routes unknown-category goals into an
  *Uncategorized* stack (`goalUtils.ts:120-134`) — consistent with the habit-side
  uncategorized bucket — while the test still asserts the old drop behavior. **A stale
  failing test ships on main**, invisible to CI because `test:beta` runs only 9 files.
- Consequence for trust: "CI green" attests to build + 9 critical suites only. The full
  suite has at least one known red and has evidently not been run (or not fixed) recently.

## 2. Test-coverage map (117 files)

**Well-covered:** server routes (48 files — entries, goals incl. milestones/extension/
tracked-edit, routines incl. reminders/submit/guardrails, bundles, auth incl. password
reset, health, push, daySummary/dayView/progress); server services (streaks, schedule,
freeze, momentum, dayView, analytics, insights, sleep, reminderScheduler, truthQuery);
shared domain (completion, weeklyProgress, trackingHistory, definitionValidation,
dayKey); repositories (12); key UI pieces (TrackerGrid clear-entry contract,
NumericInputPopover zero semantics, HabitHistoryModal, RoutineRunnerModal,
habitStatusResolution, useDayViewData, habitEntryPayload).

**Coverage gaps (no tests at all):**
- `HabitContext` — the most complex store in the app (optimistic flows, rollback,
  background sync) has **zero** tests; only `RoutineContext` has a store test.
- `AuthContext`, `TaskContext`, `GoalCompletionContext`, `App.tsx` routing (incl. the
  `trackId` bug path), `goalDataCache` + goal hooks (except `useProgressOverview`).
- Routes without dedicated tests: journal (repo-level only), tasks, adminInvites,
  wellbeingLogs/wellbeingEntries routes, analytics routes, insights routes, aiJournal
  Summary/aiInsightsReview/aiVariantSuggestion, userData (delete-all), routineLogs.
- All wellbeing UI modals, SettingsModal, Layout, AuthGate, service worker.

## 3. Documented-vs-actual contradiction register (consolidated)

| Source doc | Verified state | Details in |
|---|---|---|
| `docs/FEATURES.md` | ~90% accurate; 12 corrections (C1-C12), worst: "Inactivity Coaching" documented-only | 03 §2 |
| `FEATURE_AUDIT.md` | Accurate except sleep-form fields claim (C6) | 03 §2 |
| `docs/product/HABITFLOW_UI_ARCHITECTURE.md` | Accurate structure; 6 discrepancies (goal creation is a modal; tracker mode naming; stale footer; modal-table omissions) | 02 §5 |
| `docs/DATA_MODEL.md` | **Low-Medium trust**: 8+ wrong/stale claims (12 of 34 collections missing; "never hard-deleted" false ×5; wrong indexes) | 04 §8 |
| `docs/API.md` | **Low trust**: 3 nonexistent route groups (dayLogs, skill tree, badge/backfill), ~90 endpoints missing | 10 §3 |
| `docs/semantics/daykey.md` | Accurate minus nonexistent `/api/dashboard/streaks` + overstated unique-index guarantee | 06 §1 |
| `.claude/CLAUDE.md` | Contexts location stale; "monorepo" loose; wellbeing claim correct-but-incomplete (legacy endpoints still registered) | 01 §7, 04 §5 |
| `docs/system-model/HABITFLOW_BUG_ANALYSIS.md` | Self-tracking is honest: BUG-1/3, INC-1/2/4, RISK-1/2, DEBT-4 resolutions verified in code; BUG-2 "resolved" but the whole freeze service is dormant and still misses `requiredDaysPerWeek` quotas; deferred items (INC-3/5, RISK-3, DEBT-2/3) all still open and re-confirmed by Tasks 4-7 | this doc |
| `tasks/lessons.md` | All five lesson patterns reflect fixes present in current code | Task 1 |

## 4. Dead / legacy / dormant code register (consolidated)

**Server:** `wellbeingLogs` routes+repo+client fns (dead-but-registered; 04 §5) ·
`freezeService.processAutoFreezes` write path (no caller; server-local dates;
legacy-only weekly detection; 06 §4) · server `momentumService` output (computed per
progress call, never read; 06 §5) · `convert-to-bundle` + `unlink-child` endpoints
(built correctly, no UI callers; 07 §6) · membership archive/graduate/delete endpoints +
`daysOfWeek` (API-only; 07 §2) · `PUT /journal/byKey` (orphaned client fn; 03 C4) ·
4 analytics habit sub-routes + the discarded 365-day heatmap (08 §8.1-2) ·
`computeGoalsWithProgressV2` (no caller) · migration `001_add_routine_variants` (never
wired) · `bundleMembershipRepository.ensureIndexes` (no caller) · 3 dead membership repo
functions · `dayLogs`/`goalManualLogs` constants + wipe-list zombies · `_migrations`
undeclared · `verifyInviteCode` (dead constant-time compare; 09 §5).

**Client:** `src/data/predefinedHabits.ts` (~50 habits, zero importers, ships in
bundle) · `HabitLogModal` + `handleChoiceSave` (opener never called) ·
`HabitContext.updateLog` + `onUpdateValue`/`onToggle` props (never destructured) ·
legacy virtual-choice branch (self-documented dead) · `choiceChildHabitId` payload
support (allowlisted+tested, never sent) · `habitflow:wellbeing-entry-upsert` listener
(~50 lines, no producer) · `habitflow:demo-data-changed` (dead on both ends) ·
`checkinExtraMetricKeys` pref (no reader) · non-negotiable zombie fields + habit
`description` dead state · `evidenceHints` never populated ·
`stepStates`/`stepTrackingData`/`stepTimingData` collected, never persisted.
*(Corrected by Task 14: an earlier entry claimed `historyModalHabitId` is never set —
wrong; it is set via `onViewHistory` at `TrackerGrid.tsx:1139` and the history modal is
live. The genuinely-dead opener is `choiceLogState`, listed above.)*

## 5. Suspected-defect register (consolidated, by area; evidence in cited docs)

**Data integrity / correctness**
1. Stale `trackId` URL param hijacks reload (02 §6).
2. Step images stored as tab-scoped blob URLs — lost on reload (03 C2).
3. Journal same-template-same-day duplicates — upsert path orphaned (03 C4).
4. Latent 400 editing legacy `timesPerWeek` habits (03 C5).
5. Delete-all-data misses 8+ collections while listing removed ones (03 C9).
6. habitEntries unique index conditionally absent when duplicates exist (04 §6).
7. `isDeleted` index field undeclared on `WellbeingEntry` interface (04 §3).
8. `canonicalTypes.ts` stale vs persistence reality (04 §4).
9. Value written for "complete" differs by surface: 1 vs target (05 §5.1).
10. Typing `0` into an empty numeric cell stores `value: 0` (05 §5.2).
11. Boolean un-check deletes ALL entries for the day vs numeric single-key clear (05 §5.3).
12. Swallowed errors make several UI error paths unreachable (05 §5.4).
13. ScheduleView allows logging into future dates; history modal blocks them (05 §5.5).
14. Dead conversion path strands parent entries on real conversions (07 §8.1).
15. Membership sync swallows errors → permanent client/server denominator drift (07 §8.2).
16. daySummary vs progress disagree on legacy choice parents (07 §8.3).
17. Legacy virtual-option click should 400 against validation (07 §8.4).
18. Deleting/archiving a bundle parent orphans children (07 §8.5).
19. `endMembership` matches by pair not id (07 §8.6).
20. Divergent second goal engine on Analytics Goals tab (08 §8.3).
21. `/api/analytics/goals/summary` ignores `days` (08 §8.4).
22. Divergent freeze detection lets a `freezeType`-only entry count as completion in
    analytics (08 §8.5).
23. Goal list vs detail `distinctDays` divergence (08 §8.10).
24. Entry writes never invalidate the goal cache; milestone celebrations can't fire from
    a toggle; only `completedGoalIds[0]` celebrates (11 §4.1-3).
25. Nothing resets on logout/user-switch (11 §4.6).
26. `potentialEvidence` UTC-keyed + fetch-once (11 §4.7).
27. Routine evidence fire-and-forget with pre-cleared ref; step telemetry unpersisted
    (11 §4.8).
28. Pinned-prefs "unpin all" can never propagate; 4× prefs fetch per dashboard (11 §3).
29. `extendLogWindow` merge can never correct an already-loaded day (11 §2).
30. `graduatedHabits` analytics overcounts `undefined` (07 §8.7).
31. Stale `buildGoalStacks` test failing on main (§1).

**Security posture** (register only — assessment beyond discovery scope)
32. No CSRF + SameSite=None(prod) + CSP disabled (09 §5.1).
33. `GET /api/admin/integrity-report` lacks `requireAdmin` (09 §5.2).
34. `passwordResetTokens` has zero indexes despite in-code claim (09 §5.3).
35. Invite `uses` check-then-increment race (09 §5.4).
36. Reset URLs logged to console when RESEND key unset (09 §5.5).
37. Duplicate email across households: only one can log in (09 §5.6).
38. Session cache authenticates ≤60 s past expiry; per-process (09 §5.7).
39. Gemini output → regex markdown → `dangerouslySetInnerHTML` (09 §5.9).
40. Beta/health email allowlist triplicated, personal email in client bundle (03 §5.6).
41. Gemini key plaintext in localStorage (11 §5).

**Performance** (observed, not measured)
42. Unbounded full-history entry reads on progress/daySummary/goals-summary (08 §8.7).
43. dayView 2×bundles+2 serialized membership queries, uncached (08 §8.7).
44. daySummary O(children × logs) bundle scan (08 §8.7).
45. AppleHealthPage N+1 serial rule fetches; backfill re-run hardcodes 30 days (03 §5.10).
46. `/habits/all` forces ≥365-day fetch for a heatmap nobody renders (08 §8.1).
47. TrackerGrid calls `getBundleStats` 4× per cell per render (07 — agent observation).

## 6. Reconciliation verdicts

- `HABITFLOW_BUG_ANALYSIS.md` is the **most trustworthy audit doc in the repo** — its
  status column matched code on every sampled item (BUG-1 fix verified at
  `truthQuery.ts:169`; RISK-1's `freezeType`-first parsing verified in daySummary/
  progress — though analytics never got the memo, defect #22).
- `tasks/lessons.md` patterns all hold in current code (goal-track category gate,
  linkedHabitIds preservation, archived filtering).
- The five "Deferred" items in the bug analysis are all still open and were
  independently rediscovered by this discovery (three date fields, wellbeing legacy
  format, bundleOptions coexistence, inline modal parity, schedule filtering).

## 7. iOS impact summary

The defect register splits into (a) web-implementation bugs an iOS client simply avoids
by not porting them (most of §5 correctness + all §5 performance), (b) **server-side
behaviors iOS inherits** and must either work around or wait on fixes for: #5 (delete-all
gaps), #6 (conditional unique index), #16/#20-23 (endpoint divergences — pick canonical
endpoints per 08 §9), #33-38 (auth/server posture), and (c) product decisions: dormant
freezes, zombie non-negotiable fields, household scaffold. The handoff doc (13) carries
category (b) and (c) forward.
