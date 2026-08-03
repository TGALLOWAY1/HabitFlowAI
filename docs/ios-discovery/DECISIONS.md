# iOS Discovery — Decision Log

Durable corrections and confirmed interpretations. One entry per decision, newest first.
Entry format:

- **Date:** YYYY-MM-DD
- **Topic:** short label
- **Confirmed interpretation:** the accepted reading
- **Evidence:** exact paths/symbols/commands
- **Alternatives / contradictions:** other readings and why they were rejected, or what
  remains contradictory
- **Confidence:** High / Medium / Low

---

## 2026-08-03 — FEATURES.md verified: ~90% accurate, with 12 recorded corrections

- **Date:** 2026-08-03
- **Topic:** Trust calibration of `docs/FEATURES.md` / `FEATURE_AUDIT.md` after full
  claim-by-claim verification (Task 3)
- **Confirmed interpretation:** Both docs are reliable for feature *existence* but not for
  edge behavior. Durable corrections (full list in `03-feature-inventory.md` §2): (1)
  "Inactivity Coaching" is documented-only — no engine or popup exists, just a static
  badge; (2) per-step routine images are never persisted (blob-URL stub,
  `StepEditorPanel.tsx:65-75`) — only the routine cover image pipeline is real; (3)
  routine habit-logging is opt-in by server guardrail ("Routines never imply completion",
  `routines.ts:1006`), not automatic; (4) journal upsert-by-key is server-only — the UI
  creates duplicates; (5) `timesPerWeek` scheduling is not user-settable (legacy
  migration only); (6) goal badges are HF-generated AI images triggered on goal
  *creation*, needing undocumented `HF_TOKEN`.
- **Evidence:** Four parallel code investigations + direct spot-checks; citations embedded
  per-claim in `03-feature-inventory.md`.
- **Alternatives / contradictions:** None open — each correction was spot-checked against
  the cited lines.
- **Confidence:** High.

## 2026-08-03 — Goal creation is a 2-step modal, not a full-page flow

- **Date:** 2026-08-03
- **Topic:** Goal creation UX (doc self-contradiction resolved)
- **Confirmed interpretation:** Goal creation runs entirely inside
  `src/components/CreateGoalModal.tsx` as a two-step modal (`step` state `1 | 2` at line
  16: details → link habits). The UI architecture doc's §7 claim of a "full-page flow" and
  its §6 references to `CreateGoalPage` / `CreateGoalLinkHabits` components are wrong —
  no such components exist; the doc's own §3 screen inventory correctly labels both steps
  "Modal".
- **Evidence:** `src/components/CreateGoalModal.tsx:16,127-129,219-223`; mounted at
  `src/App.tsx:798-801`; grep for `CreateGoalPage`/`CreateGoalLinkHabits` returns nothing.
- **Alternatives / contradictions:** `docs/product/HABITFLOW_UI_ARCHITECTURE.md` §6/§7 vs
  §3 (internal contradiction — §3 is the accurate one).
- **Confidence:** High.

## 2026-08-03 — No screenshots exist in the repository

- **Date:** 2026-08-03
- **Topic:** Screenshot inventory for discovery
- **Confirmed interpretation:** The repository contains no product screenshots. The only
  image assets are app icons (`public/icon-*.png`, `apple-touch-icon.png`, `icon.svg`) and
  two uploaded routine images (`public/uploads/routine-images/`). No Markdown doc embeds an
  image. Visual/UI discovery must rely on code plus
  `docs/product/HABITFLOW_UI_ARCHITECTURE.md`.
- **Evidence:** `find` across the working tree (excluding `node_modules`, `.git`) for
  `*screenshot*` names and for `*.png|*.jpg|*.jpeg|*.webp`; `grep -r '!['` over `docs/`
  returned no image links. Run during Task 1 (2026-08-03).
- **Alternatives / contradictions:** The discovery brief assumed screenshots exist;
  they may live outside the repository (not accessible here).
- **Confidence:** High (for repository contents).

## 2026-08-03 — Wellbeing topology RESOLVED: `wellbeingEntries` is the only live path; `wellbeingLogs` is dead-but-registered (SUPERSEDES the earlier entry below)

- **Date:** 2026-08-03 (Task 4; corrects the Task 1 entry that follows)
- **Topic:** Wellbeing truth collection — read/write topology
- **Confirmed interpretation:** The active frontend path is 100% `wellbeingEntries`.
  Writes: `WellbeingCheckInModal` → `logWellbeing` (`HabitContext.tsx:262-310`) decomposes
  morning/evening sessions into per-metric entries → `upsertWellbeingEntries` →
  `POST /api/wellbeingEntries`. Reads: `loadWellbeingLogsFromApi` (`HabitContext.tsx:149-160`)
  fetches entries and aggregates them back into the `DailyWellbeing` map the UI consumes.
  The legacy `saveWellbeingLog`/`fetchWellbeingLogs` client functions have **zero callers**
  (verified by repo-wide grep), and the `/api/wellbeingLogs` routes write only to the
  legacy collection with no dual-write ("Dual-write adapter removed (C3 audit fix)",
  `wellbeingLogs.ts:91-93`). So: CLAUDE.md's "replaces legacy wellbeingLogs" is correct
  for the active path; the legacy endpoints, repository, and client functions are
  **dead code that was never deleted**.
- **Evidence:** `src/store/HabitContext.tsx:149-160,262-310`; grep for
  `saveWellbeingLog|fetchWellbeingLogs` callers outside `persistenceClient.ts` → none;
  `src/server/routes/wellbeingLogs.ts:91-93`.
- **Alternatives / contradictions:** Task 1's provisional reading (below) inferred a live
  legacy write path from the function's existence without tracing call sites — overturned.
- **Confidence:** High.

## 2026-08-03 — [SUPERSEDED — see entry above] Legacy `wellbeingLogs` API is still live and written to by the frontend

- **Date:** 2026-08-03 (Task 1 provisional; **overturned by Task 4**)
- **Topic:** Wellbeing truth collection
- **Original (incorrect) interpretation:** The frontend still writes through
  `saveWellbeingLog` → POST `/wellbeingLogs`. Wrong: that function exists but has no
  callers. Kept for the audit trail.
- **Evidence at the time:** Routes registered at `src/server/app.ts:190-197`; function body
  `src/lib/persistenceClient.ts:865-867`; read-path comment `persistenceClient.ts:328`.
- **Confidence:** n/a (superseded).
