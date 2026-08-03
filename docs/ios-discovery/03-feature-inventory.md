# Task 3 — Implemented Feature Inventory

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Every claim in `docs/FEATURES.md` (2026-08-03) and `FEATURE_AUDIT.md`
(2026-07-01) was verified against code by four parallel read-only investigations (habits;
goals/routines; journal/wellbeing/AI; Apple Health/platform), whose findings were then
spot-checked directly against the repository before acceptance (INSTRUCTIONS.md §11-12).
Statuses: **Implemented** · **Partial** · **Documented-only** · **Likely unused / legacy**
· **Suspected bug**.

---

## 1. Verdict summary

`docs/FEATURES.md` is **~90% accurate** — the large majority of features are implemented
end-to-end exactly as described. The corrections below matter, though, and several are
directly relevant to iOS scoping. `FEATURE_AUDIT.md`'s "Partially Implemented" table is
accurate and its limitations were all re-confirmed.

### Confirmed implemented (compact list — all verified end-to-end)

- **Habits:** boolean + numeric tracking; `assignedDays` and `requiredDaysPerWeek`
  scheduling; live-computed streaks (`streakService.ts`, nothing stored); categories with
  8-color palette, DnD reorder, inline rename, delete-with-uncategorize; archive/restore
  with entries preserved (`habits.ts:587,632`, `ArchivedHabitsModal`); per-habit push
  reminders (`reminderScheduler.ts:211-222`); quick toggle from all three views; DnD habit
  reorder; habit-potential evidence ("Routine Execution Detected" chip,
  `TrackerGrid.tsx:305-308`).
- **Goals:** cumulative/one-time types with `aggregationMode`/`countMode`; milestones
  (max 20, server-validated, per-milestone `acknowledgedAt`, celebration watcher);
  completion reconciliation (auto-reopen on entry edits, `goalAutoCompletion.ts:65-75`,
  tracked goals exempt); tracks with auto-advancement and `activeWindowStart/End` progress
  isolation; extension with `iteratedFromGoalId` + pre-acknowledged carried milestones;
  trend chart with "Start from" window; removed-habit contributors; 3 reorder surfaces;
  track achievements (Journey Complete / Triple Step / Grand Journey,
  `analyticsService.ts:389-426`).
- **Routines:** variants with copy (10-cap), step timers (countdown/stopwatch,
  `useStepTimer.ts`), routine **cover** image upload (5MB, JPEG/PNG/WebP, stored as
  MongoDB Binary — `routineImageRepository.ts:43-80`), runner, completion logs with
  timings, pinned routines, daily push reminders skipped-once-logged.
- **Journal:** free-write + 11 templates across 6 categories with personas
  (`journalTemplates.ts:65-257`); history with edit/delete.
- **Tasks:** Today/Inbox, move, inline rename, complete, soft-delete, auto-sort.
- **Wellbeing:** morning/evening check-ins with the exact documented metric keys
  (`WellbeingCheckInModal.tsx:27-66`); day-impact tags; medications/supplements/symptoms
  managers with daily logs; weight + caffeine (additive presets); sleep entry form with
  Apple Watch score + sub-scores and any-past-night editing.
- **Analytics/Insights:** habit/routine/goal analytics; sleep analytics with circular-
  std-dev consistency and independence streaks (`sleepAnalyticsService.ts:205-224,362-399`);
  insights correlations with the exact documented guards (5 days/group, |d| ≥ 0.2 —
  `correlationEngine.ts:124-125`, `insightsService.ts:43-44`); least-squares predictions
  with tiered confidence.
- **AI (Gemini BYOK):** all five features make real Gemini calls
  (`gemini-3.5-flash` hardcoded, `lib/gemini.ts:11`); key sent **in the request body**
  from localStorage, never stored server-side; report archive with soft delete; history
  readable without a key; demo injects pre-authored variant drafts
  (`demoRoutineSuggestions.ts`).
- **Apple Health (Beta):** `POST /api/health/apple/sync` (5 metrics), rules with 5
  operators, auto-log/suggest behaviors, bounded backfill (server cap 365), Day View
  source icon. External bridge confirmed absent from repo (no Swift anywhere).
- **Platform:** optimistic UI with snapshot-rollback + 30 s debounced background re-sync
  (`HabitContext.tsx:263-895`); demo mode (70-day seeded dataset, server 403 + client
  toast); setup guide; delete-account UI; rate limits (auth 10, invites 20, entry writes
  100 per 15 min/IP); tour + roadmap pages.

## 2. Corrections to documented claims

| # | Documented claim | Reality | Status |
|---|---|---|---|
| C1 | "Inactivity Coaching — rule-based popup suggestions when a goal is stagnant" (`FEATURES.md:90`) | No coaching engine, suggestions, or popup exist. Only a boolean (`daysWithoutProgress >= 4`, `goalProgressUtilsV2.ts:336`) rendering a static amber badge ("No progress 4 of last 7 days", `GoalSharedComponents.tsx:125-139`). | **Documented-only** |
| C2 | "Step Images — upload images (JPEG, PNG, WebP, max 5MB)" (`FEATURES.md:63`) | The validated 5MB pipeline is the **routine cover image** only. Per-step upload is a stub: `URL.createObjectURL` writes a tab-scoped `blob:` URL into `step.imageUrl` (`StepEditorPanel.tsx:65-75`) — renders once, dead after reload, never uploaded, no validation. The paste-a-URL field is the only durable path. | **Suspected bug / Partial** |
| C3 | "Linked Habit Auto-Logging — completing a routine auto-marks its linked habits as done" (`FEATURES.md:65`) | Explicitly opt-in, not automatic. Server guardrail: "Routines never imply completion" (`routines.ts:1006-1007`); entries are created only for `habitIdsToComplete` the user selects via the log-habits button on the completion screen (`RoutineRunnerModal.tsx:127,366`). | **Partial (opt-in)** |
| C4 | "Upsert by Key — same template + same day updates existing entry" (`FEATURES.md:113`) | Endpoint + repo exist and are tested (`PUT /api/journal/byKey`), but **no UI calls it** — `JournalEditor.tsx:206-209` uses `createEntry`, so re-opening the same template the same day duplicates the entry; index is non-unique. Only consumer is the AI summary route. | **Partial / Suspected bug** |
| C5 | Scheduling "times-per-week" (`FEATURES.md:39`, `FEATURE_AUDIT.md:29`) | `timesPerWeek` is validated and rendered (badges) but **no UI can set it** — only migration 002 writes it. Bonus latent bug: editing any migrated `timesPerWeek` habit should 400, because the modal always sends `requiredDaysPerWeek` and validation rejects both fields together (`definitionValidation.ts:85-87`, `AddHabitModal.tsx:293`). | **Partial + suspected bug** |
| C6 | Sleep form captures "latency, interruptions … morning energy" (`FEATURE_AUDIT.md:93`) | `sleepLatencyMinutes`, `sleepAwakenings`, `energy` are never written by the form (`SleepEntryForm.tsx:167-183`) — only the demo seeder writes them. The analytics panels reading them are demo-only in practice. | **Partial** |
| C7 | "Achievement Badges — auto-generated badges for completed goals" (`FEATURES.md:84`) | Real feature, wrong trigger and undocumented dependency: badges are **AI-generated 256×256 images** (Hugging Face `Tongyi-MAI/Z-Image-Turbo`) fired on goal **creation** (`goals.ts:651`), stored as base64 data-URLs in `badgeImageUrl`; silently no-ops without server env `HF_TOKEN` (not in `.env.example`), falling back to a deterministic Lucide icon. | **Partial** |
| C8 | "Auto-logged entry indicators … in tracker" (`FEATURES.md:208`) | Icon exists in **Day View only** (`HabitGridCell.tsx:241-245`); the weekly TrackerGrid has no source indicator. | **Partial** |
| C9 | "Delete All Data — permanent data wipe" (`FEATURES.md:235`) | `USER_DATA_COLLECTIONS` (`userData.ts:11-28`) omits medications(+logs), supplements(+logs), symptoms(+logs), aiReports, bundleMemberships, pushSubscriptions, and all health collections — while still listing the removed `dayLogs`/`goalManualLogs`. The header comment claims a full wipe. | **Partial / Suspected bug** |
| C10 | "Templates … some have optional deeper questions" (`FEATURES.md:110`) | Exactly 1 of 11 (`daily-retrospective`) has a deep block. | **Overstated** |
| C11 | Journal "history (last 90 days)" | Client-side default only (`JournalDisplay.tsx:20`); server has no cap. Same pattern for the Insights 30/90/180 windows (server accepts 1–365). | Accurate but cosmetic |
| C12 | Health rules "≥, ≤, >, <" | A fifth operator `exists` is also supported (`habitHealthRules.ts:27`). | Undersold |

## 3. Implemented but undocumented (absent from FEATURES.md)

- **Category momentum banner** — 7-day engagement score with rotating copy, visible on the
  main tracker (`utils/momentum.ts`, `CategoryMomentumBanner.tsx`, `App.tsx:499-506`).
  A parallel **server** momentum computation rides on every `/api/progress/overview`
  response and is **never read by any client** (`momentumService.ts` — duplicate logic).
- **Streak freezes** — a full render path ships (sky-blue frozen cells, "N freezes left"
  tooltip, `TrackerGrid.tsx:379-460`; `daySummary.ts:42-47`) for a feature that can never
  trigger: `processAutoFreezes` (`freezeService.ts:40-127`) has **zero production
  callers**. Dormant V0-PRD feature.
- **Habit-potential evidence** — live and useful (routine runner → "verify completion"
  nudge) but not in FEATURES.md.
- **AI goal-badge generation** (see C7) — the HF dependency is documented nowhere.

## 4. Likely unused / legacy code found

| Item | Evidence |
|---|---|
| `src/data/predefinedHabits.ts` (~50 habits, 8 categories, personal pet names) | Zero importers; special-cased in `scripts/check-invariants.ts:319-321`; still ships in bundle |
| `freezeService.processAutoFreezes` write path | No non-test caller |
| `server momentumService` output | Computed on every progress call, never read |
| "Non-negotiable" habit fields (`nonNegotiable`, `nonNegotiableDays`, `deadline`) | Stored, validated, auto-derived, badge-rendered — but drive no behavior anywhere; superseded by `requiredDaysPerWeek: 7` |
| Habit `description` field | Stored + round-tripped by dead modal state; no input, no display (`AddHabitModal.tsx:75,137,168,294`) |
| `upsertEntryByKey` client function (`src/api/journal.ts:76`) | Zero call sites |
| `checkinExtraMetricKeys` dashboard pref | Validated + persisted, never read by any component |
| `scripts/generate-goal-badges.py` | Standalone prompt-tuning scratchpad, not runtime |
| Persona IDs `emotional_wellbeing`/`fitness_focused` | Type-level constants with no config objects; `getActivePersonaConfig()` returns default unconditionally (`activePersona.ts:8-10`) |

## 5. Suspected bugs recorded for Task 12 (not fixed)

1. Step image upload writes ephemeral blob URLs (C2).
2. Journal same-template-same-day duplicates (C4).
3. Latent 400 editing legacy `timesPerWeek` habits (C5).
4. Delete-all-data incomplete scope (C9).
5. `/api/admin/integrity-report` registered **without** `requireAdmin`
   (`app.ts:309`) while all sibling admin routes have it (user-scoped, so low severity).
6. Beta/health email allowlist hardcoded in **three** places, two shipped in the client
   bundle (`requireHealthFeature.ts:9`, `persistenceClient.ts:1764`, `betaAccess.ts:12`) —
   a personal email is a public string in production JS.
7. Task delete confirm says "Permanently delete" but server soft-deletes with no restore
   surface (`TaskItem.tsx:30`, `taskRepository.ts:111-124`).
8. Mixed check-in slider scales (0–4 vs 1–5) feed the correlation/prediction engines with
   inconsistent ranges (`WellbeingCheckInModal.tsx:27-55`, contract comment
   `persistenceTypes.ts:916-918`).
9. Goal list-vs-detail progress can disagree for multi-habit `distinctDays` goals — list
   view uses a knowingly approximate upper bound (`goalProgressUtilsV2.ts:731-745`).
10. `AppleHealthPage` fetches health rules serially, one request per habit
    (`AppleHealthPage.tsx:62-71`); backfill re-run button hardcodes 30 days (`:159`).
11. `GET /api/health` healthcheck shadows the feature-gated health router mount
    (`app.ts:136` vs `:186`) — harmless today, fragile.

## 6. Partial features (confirmed as documented in FEATURE_AUDIT.md)

Apple Health (beta, single allowlisted email, external bridge); Analytics + Insights pages
(beta email gate, demo can view); multi-user households (API only — `householdUsers`
client wrappers have zero UI callers); personas (default only); habit description
(dead field); bundle membership `daysOfWeek` (API validates/stores/honors it —
`bundleMemberships.ts:70,107-111`, `daySummary.ts:232-237` — no UI sets it).

## 7. Feature-status table for iOS planning

| Area | Status for iOS scoping |
|---|---|
| Habits core (types, schedule, streaks, categories, archive) | Implemented — port as-is; note `timesPerWeek` is legacy-only |
| Bundles | Implemented (deep semantics → Task 7) |
| Goals + tracks + milestones + extension | Implemented; badges need `HF_TOKEN` decision |
| Routines (variants, timers, runner, logs) | Implemented; step images broken (C2); logging is opt-in (C3) |
| Journal | Implemented; duplicate-entry quirk (C4) |
| Tasks | Implemented (simple) |
| Wellbeing check-ins + health hub | Implemented; sleep latency/awakenings/energy uncaptured (C6) |
| Analytics + Insights + Sleep | Implemented, beta-gated by hardcoded email |
| AI (5 features) | Implemented, BYOK-in-body; model hardcoded |
| Apple Health | Beta scaffold; iOS should replace bridge with native HealthKit |
| Push reminders | Implemented (Web Push); prod flag off; iOS needs APNs |
| Demo/tour | Implemented, web-only mechanism |
| Multi-user household | API-only, no UI — decide whether iOS v1 cares |
