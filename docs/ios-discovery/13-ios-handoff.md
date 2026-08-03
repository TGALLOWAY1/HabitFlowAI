# Task 13 — Cross-Reference Matrix and iOS-Planning Handoff

**Date:** 2026-08-03 · **Status:** Complete
**Purpose:** Single entry point for writing the iOS build plan. Everything here is backed
by Tasks 1–12; per-cell evidence lives in the cited documents. Product-intent docs
(`docs/reference/iOS release V1/`, `V2 (Current - iOS focus)/`) are compared but never
treated as implementation evidence.

---

## 1. Feature × surface × API × data × status matrix

| Feature area | Web surfaces (02) | Primary API (10) | Data (04) | Status (03) | Deep docs |
|---|---|---|---|---|---|
| Habits: define/schedule/archive | AddHabitModal, TrackerGrid, ArchivedHabitsModal | `/habits*` | `habits` | Implemented (`timesPerWeek` legacy-only) | 05, 06 |
| Habit logging (bool/numeric) | TrackerGrid / DayView / ScheduleView / HistoryModal | `PUT /entries` + `DELETE /entries/key` (canonical idiom) | `habitEntries` (dayKey-unique*) | Implemented; payload divergences are web accidents | 05 |
| Weekly quotas + streaks + freezes | tracker chips, progress overview | `/progress/overview` | derived | Implemented; freezes dormant | 06 |
| Bundles (checklist/choice) | AddHabitModal bundle mode, grid/day cells | `/entries/batch`, child entries, `/bundle-memberships` | `habits` + `bundleMemberships` | Implemented; conversion endpoint unused; membership sync fragile | 07 |
| Categories | CategoryTabs | `/categories*` | `categories` | Implemented |  |
| Goals + milestones + extension | Goals pages, CreateGoalModal (2-step) | `/goals*`, `/goals-with-progress`, `/goals/:id/detail` | `goals` | Implemented; badges need `HF_TOKEN`; avoid analytics goals engine | 08 |
| Goal tracks | Track pages | `/goal-tracks*` | `goalTracks` | Implemented (windowed isolation) | 08 |
| Routines + variants + runner | RoutineList/Editor/Runner/Preview | `/routines*`, `/routines/:id/submit` | `routines`, `routineLogs`, `routineImages` | Implemented; step images broken; logging opt-in | 03, 07 |
| Journal | JournalPage 4 tabs | `/journal*` | `journalEntries` (hard delete, userId-only) | Implemented; same-day duplicates quirk | 09 |
| Tasks | TasksPage | `/tasks*` | `tasks` | Implemented (no due dates) | 09 |
| Wellbeing check-ins + health hub | Dashboard wellbeing modals | `/wellbeingEntries`, med/supp/symptom routes | per-metric `wellbeingEntries` + 6 log collections | Implemented; sleep latency/awakenings/energy uncaptured | 03, 04 |
| Analytics + Insights + Sleep | Analytics/Insights pages (beta-gated) | `/analytics/*`, `/insights/*` | derived | Implemented; several endpoint defects | 08 |
| AI (5 features + archive) | AI hub, journal/insights tabs | `/ai/*` (BYOK key in body) | `aiReports` | Implemented; model hardcoded | 03, 09 |
| Apple Health | AppleHealthPage, suggestion banner | `/health/apple/sync`, rules, suggestions | `healthMetricsDaily`, rules, suggestions | Beta, allowlisted, external bridge | 03, 09 |
| Push reminders | Settings Notifications, habit/routine editors | `/push/*` | `pushSubscriptions`, `pushSendLog` | Implemented (Web Push), prod flag off | 09 |
| Auth + household | AuthGate flows | `/auth/*`, `/admin/invites`, `/household/users` | `users`, `sessions`, `invites` | Implemented; household UI absent | 09 |
| Demo + tour + roadmap | TourPage, demo chrome | `X-Demo-Mode` | seeded demo identity | Implemented, web-only mechanism | 09 |

\* unique index conditional — defect #6 in 12 §5.

## 2. What iOS inherits from the server (must work around or fix server-side first)

From 12 §7(b): delete-all-data gaps (#5) · conditional entries unique index (#6) ·
endpoint divergences — use `/goals-with-progress` + `/goals/:id/detail`, never the
analytics goals engine; prefer daySummary/dayView over analytics for freeze-aware reads
(#16, #20-23) · auth posture (fixed 14-day cookie, no refresh; no CSRF model relevant to
web only) · per-process caches ⇒ no read-your-write within 30-60 s on cached endpoints ·
`passwordResetTokens` unbounded growth (#34) · boot-only demo seeding.

## 3. Required new server work for iOS (deltas, not discovery scope)

1. **APNs pipeline** (sender + device-token storage + scheduler reliability) — no native
   push path exists; Web Push scheduler is single-process and off in prod.
2. **Auth ergonomics** (optional but recommended): token/refresh endpoint or extended
   session policy; cookie auth works natively today (09 §1).
3. **Apple Health**: widen/replace the 3-copy email allowlist; native HealthKit can call
   the existing sync endpoint directly (contract already fits — 10 §4).
4. Badge generation env (`HF_TOKEN`) documented/decided.
5. Optional: uniform error envelope + API versioning for non-reloadable clients (10 §2).

## 4. Product decisions needed before iOS build (12 §7(c))

- **Freezes:** render path ships, engine dormant + broken (server-local dates,
  legacy-only weekly detection). Finish or cut — iOS should not port the ambiguity.
- **Momentum:** client banner live, server twin dead, feature undocumented. Keep?
- **Non-negotiable fields, habit description, `timesPerWeek`:** zombie carriers — decide
  drop vs revive before freezing Swift models.
- **Household/multi-user:** API scaffold, no UX. In or out for iOS v1?
- **Tasks / Debug / demo-tour:** roadmap says Tasks leaves primary nav; tour mechanism
  doesn't port. iOS IA decision (02 §7: web has 4 tabs + buried secondary surfaces).
- **Wellbeing/Analytics/Insights/AI scope:** iOS-release-V1 prioritization defers all of
  these ("COULD"), but the web product ships them — reconcile ambition level.

## 5. Intent docs vs implemented product (differences flagged, not adopted)

`docs/reference/iOS release V1/Feature_Prioritization.md` + `V2 (Current - iOS focus)/`:

1. **"Routines never create HabitEntries directly / RoutineExecution intent only"** —
   the implemented product *does* create entries on submit, gated by an explicit opt-in
   allowlist (07 §6; server guardrail comment "Routines never imply completion"). The
   implementation is a middle ground the intent doc forbids.
2. **"All weekly and momentum metrics use rolling windows; calendar weeks not used"**
   (V2 backlog) — the implementation uses **ISO Monday calendar weeks everywhere**
   (weekly quotas, weekly streaks — 06 §1-3). Direct conflict; the iOS plan must pick one
   and note that copying the web means calendar weeks.
3. **"Offline logging support" is a launch-blocking MUST** — the web product has zero
   offline capability (11 §6); this is net-new iOS work, and the API's idempotent
   upserts are the enabler (10 §4).
4. "Today View not required" vs web defaulting new users into Today mode — minor.
5. "Single entry per habit per day" MUST — implemented, but only opportunistically
   enforced (conditional index).
6. Persona/skills deferred — matches implementation (dormant/absent).

## 6. Prioritized risk list for the iOS plan

1. **Semantic fidelity of derivation** — completion/streak/schedule rules are subtle and
   live in portable pure functions (`completion.ts`, `schedule.ts`, `streakService.ts`,
   `trackingHistory.ts`, `weeklyProgress.ts`); transliterate + port their tests, or
   evaluate server-side. Divergence here is the product breaking silently (05, 06).
2. **Offline/sync design** — greenfield; use upsert-by-key outbox; do not port the web's
   invalidation graph (11 §7).
3. **Push** — entirely new pipeline (§3.1).
4. **Type authority** — generate models from `persistenceTypes.ts`; `canonicalTypes.ts`
   is stale; no OpenAPI exists (04 §4, 10 §4).
5. **Endpoint selection** — canonical set per 08 §9; several look-alike endpoints are
   divergent or dead.
6. **Bundle membership writes** — make transactional-from-client with surfaced errors
   (07 §9).
7. **Timezone discipline** — always send device IANA zone; never rely on the NY fallback
   (06 §7).

## 7. Open questions (cannot be answered from the repository)

1. Is production push intentionally off (`PUSH_REMINDERS_ENABLED: "false"`), and is the
   Render instance always-on?
2. Does `HF_TOKEN` exist in production (are goal badges live)?
3. Which duplicate `habitEntries` keys (if any) exist in the production DB — i.e., is the
   unique index actually present there?
4. Is the Apple Health "external sync bridge" a maintained artifact worth keeping, or
   does native HealthKit fully replace it?
5. Intended fate of the deferred/dormant items in §4 (freezes, momentum, household,
   Tasks) — product owner input.
6. Screenshots: none exist in-repo; are there external design references the iOS plan
   should use, or is `HABITFLOW_UI_ARCHITECTURE.md` + the live product the reference?

## 8. Reading order for the iOS plan author

01 (stack/boundaries) → 02 (surfaces) → 05+06 (the semantics that must not drift) →
04 (models; generate Swift from `persistenceTypes.ts`) → 10 (endpoints + gaps) → 07+08
(bundles, derived reads) → 09 (auth/push) → 11 (what not to port) → 12 (defect register)
→ this doc's §2-7 as the planning checklist.
