# HabitFlow Last-24h PR Audit (2026-03-30)

## Scope and method

- Window audited: approximately the last 24 hours of git history ending **2026-03-30 UTC**.
- Sources used:
  - `git log --since='24 hours ago' --oneline --decorate --graph --all`
  - `git log --since='24 hours ago' --no-merges --name-only`
  - targeted `git show` diffs and current-file inspections for impacted areas.
- PR boundaries were reconstructed from merge commits (`Merge pull request #...`) plus the underlying non-merge commits.

---

## Executive summary

Recent work delivered substantial product clarity improvements (scheduled habit semantics, streak controls, and goal-type simplification), but the change density was high and sequencing was noisy.

**Overall risk level: Medium-High** due to:
1. rapid multi-PR churn in the same surfaces (AddHabitModal, InfoModal, goals UI, nav),
2. one confirmed preference-hydration bug for `hideStreaks`,
3. branch/merge sequencing artifacts (duplicate PR branch merges), and
4. lingering conceptual/doc-comment drift after removing frequency goals.

### Highest-priority issues

1. **Confirmed bug:** dashboard streak-visibility preference can fail to hydrate correctly when backend returns explicit `false` after prior `true` state.
2. **Confirmed cleanup debt:** AddHabitModal contains duplicated initialization lines and stale comments from conflict resolution/churn, increasing regression risk.
3. **Confirmed branch drift artifact:** same branch merged twice for pinned routines alignment, indicating sequencing/base mismatch.
4. **Likely conceptual inconsistency:** scheduled-day streak logic intentionally allows off-schedule completions to satisfy weekly requirement; UX language may imply stricter day adherence.
5. **Confirmed conceptual residue:** “frequency goals” removed in model/routes, but legacy phrasing remains in comments/UI copy in goal components.

---

## PR / reconstructed change summary

### #329 (bundle audit fixes) + related fixes (#321)
- Purpose: align bundle behavior across views and backend derivation.
- Core areas:
  - `src/components/TrackerGrid.tsx`
  - `src/components/day-view/*`
  - `src/server/routes/daySummary.ts`
  - `src/utils/habitUtils.ts`
  - membership APIs in `src/lib/persistenceClient.ts`
- Net effect: stronger parent-derived completion semantics and membership-aware handling.

### #335 (habit data loss fix)
- Purpose: fix archived habit invisibility after category-goal linkage cleanup/deletion paths.
- Core areas:
  - `src/server/repositories/habitRepository.ts`
  - `src/server/routes/goals.ts`, `src/server/routes/habits.ts`
  - repository/route tests around cleanup.
- Net effect: improves linked-entity integrity in archive/delete flows.

### #347 + #354 (habit modal redesign/simplification)
- Purpose: replace non-negotiable framing with schedule + required-days-per-week; later simplify mobile UX.
- Core areas:
  - `src/components/AddHabitModal.tsx`
  - `src/components/DayChipSelector.tsx`
  - `src/components/NumberChipSelector.tsx`
  - `src/components/WeeklyHabitEditModal.tsx`
  - `src/server/routes/habits.ts`
- Net effect: significant UX simplification and better schedule semantics, but with merge-churn artifacts in modal code.

### #350 (streak calculation + hide-streaks toggle)
- Purpose: add scheduled streak computation and user-level streak visibility control.
- Core areas:
  - `src/server/services/streakService.ts`
  - `src/store/DashboardPrefsContext.tsx`
  - `src/server/routes/dashboardPrefs.ts`
  - streak display surfaces (`Layout`, `TrackerGrid`, `MomentumHeader`, `AccomplishmentsLog`).
- Net effect: product flexibility increased; one hydration bug found in prefs context.

### #351 (remove frequency goal type)
- Purpose: simplify goal taxonomy and creation flow.
- Core areas:
  - `src/server/routes/goals.ts`
  - `src/models/persistenceTypes.ts`
  - `src/pages/goals/CreateGoalPage.tsx`
  - goal progress/test utilities.
- Net effect: clearer distinction between outcome goals vs recurring habits; some legacy wording remains.

### #336/#338 (bottom-nav changes) and routine layout PRs #342/#343/#344/#345
- Purpose: navigation simplification and routine card/pinning alignment.
- Core areas:
  - `src/components/BottomTabBar.tsx`
  - `src/components/dashboard/PinnedRoutinesCard.tsx`
  - `src/components/RoutineList.tsx`
- Net effect: improved UI consistency; duplication in merge sequencing shows process risk.

---

## Findings by severity

## Critical

No critical production blockers were confirmed in this audit window.

## High

### 1) Dashboard hide-streaks hydration is one-way (confirmed)
- **Affected area:** user preferences / streak visibility.
- **Why it matters:** if prefs are changed across sessions/devices, local hydration logic only sets state when truthy, which can preserve stale local `true` when backend intends `false`.
- **Evidence:** `src/store/DashboardPrefsContext.tsx` only calls `setHideStreaksLocal(true)` inside `if (prefs.hideStreaks)`, with no explicit false assignment path.
- **Recommended fix:** set from backend as `setHideStreaksLocal(Boolean(prefs.hideStreaks))`.

### 2) AddHabitModal carries merge/conflict artifacts after rapid PR sequence (confirmed)
- **Affected area:** habit add/edit modal reliability.
- **Why it matters:** duplicated init calls/comments and stale sections increase accidental break risk in future edits and mask real logic intent.
- **Evidence:** duplicate `setBundleMode(...)` and duplicate `setGoalType(...)` invocations in modal initialization; multiple stale/deprecated comments retained.
- **Recommended fix:** perform one cleanup pass with no behavior change; add a focused modal-state test on edit-mode initialization.

## Medium

### 3) Branch drift / PR sequencing artifact on pinned routines (confirmed)
- **Affected area:** release process and merge hygiene.
- **Why it matters:** duplicate merges from same branch (`#342` then `#343`) indicate base drift or rushed sequencing; increases probability of accidental reverts/overwrites.
- **Evidence:** consecutive commits `a4645c2` then `0ad588d` touching the same file, each merged via separate PR merges.
- **Recommended fix:** enforce rebase/branch freshness before merge; require PR note when superseding prior PR from same branch.

### 4) Scheduled-day streak semantics may conflict with user expectation (likely)
- **Affected area:** streak model and habit scheduling semantics.
- **Why it matters:** code currently counts completion on any day toward `requiredDaysPerWeek` even when specific assigned days exist, which may be intended flexibility but can be interpreted as schedule non-enforcement.
- **Evidence:** `calculateScheduledDailyMetrics` comment/implementation in `src/server/services/streakService.ts`.
- **Recommended fix:** explicitly document this as policy in product docs/tooltips, or add strict-mode option if schedule adherence is desired.

### 5) Goal taxonomy cleanup is incomplete in copy/comments (confirmed)
- **Affected area:** conceptual clarity for goals.
- **Why it matters:** residual mentions of “frequency goals” in comments/text can reintroduce confusion after model simplification.
- **Evidence:** comments in `GoalGridCard.tsx`, `EditGoalModal.tsx`, and utility comments noting legacy frequency terminology.
- **Recommended fix:** terminology cleanup pass (“cumulative” vs “one-time” only) plus lint/check for stale goal-type strings in UI text/comments.

## Low

### 6) Bottom tab route type includes removed routes (confirmed cleanup)
- **Affected area:** navigation type surface.
- **Why it matters:** dead union members (`journal`, `tasks`) can mislead future routing logic.
- **Evidence:** `type TabRoute` includes routes no longer rendered in tab list.
- **Recommended fix:** narrow union to active tabs or document intentionally broader contract.

### 7) High churn in InfoModal with little guardrail (possible but unverified)
- **Affected area:** definitions/help UX consistency.
- **Why it matters:** multiple same-day rewrites increase chance of contradictory messaging.
- **Evidence:** several consecutive commits touching `src/components/InfoModal.tsx`.
- **Recommended fix:** add one snapshot/approval test or content checklist for concept definitions.

## Informational / cleanup

- Bundle direction is improving: server-derived parent completion and membership timeline direction appear substantially more coherent after #329.
- Archive/delete integrity appears to be actively hardened with tests around linked-goal cleanup.

---

## Conceptual consistency review

## Clearer now

- **Goals as outcomes** (cumulative or one-time) and **habits as recurring performance** are better separated after removing frequency goals.
- **Non-negotiable** is de-emphasized in favor of explicit schedule/required-days semantics.
- Bundle completion is increasingly centralized as derived logic, not parent-write shortcuts.

## Still overlapping/conflicting

- Some goal UI/comments still mention legacy frequency framing.
- Scheduled days language can imply strict day adherence, while streak logic currently supports weekly flexibility across any day.
- Rapid modal redesign passes left readability/maintainability inconsistencies in AddHabitModal.

## Terminology inconsistencies observed

- “frequency goal” phrase remains in comments/copy while backend model now only allows `cumulative | onetime`.
- Habit completion language occasionally mixes “done/complete” with performance semantics; mostly minor.

## Data-model consistency notes

- Goal type restrictions in routes/types align with simplification.
- Bundle membership and derived completion direction is consistent with prior decision logs, though still partly in migration/fallback coexistence mode.

---

## Redundancy / branch drift review

- **Confirmed duplicated implementation path in history:** pinned routines placement changed one way then partially reverted in a second PR from same branch lineage.
- **Conflict-resolution artifact likely:** duplicated setter lines in AddHabitModal initialization blocks.
- **Stale/dead assumptions:** lingering type unions/copy/comments for removed concepts.

---

## Recommended next actions (prioritized)

1. **Fix DashboardPrefs hydration bug** (`hideStreaks` explicit false handling) and add a regression test.
2. **Run AddHabitModal cleanup PR** (no functional changes) to remove duplicate init calls/comments; add edit-mode init test.
3. **Terminology scrub for goals**: remove “frequency goal” phrasing in comments/UI and update any docs.
4. **Decide and document schedule strictness policy** (flexible week-count vs strict assigned-day compliance).
5. **Process guardrails**: avoid merging superseding UI PRs from stale branches without explicit supersession note.

---

## Decision log update summary

- Added a new decision-log entry file capturing major product/technical decisions from this 24-hour window.
- Logged decisions include:
  1. removal of `frequency` goal type,
  2. scheduled-days replacing non-negotiable framing,
  3. scheduled streak flexibility + global hide-streaks preference,
  4. stronger bundle child-entry + derived-parent semantics,
  5. archive/delete linkage integrity hardening.

### Decisions that still need clarification before final canon

- Whether scheduled daily habits should support **strict day enforcement mode**.
- Whether fallback behavior for legacy bundle `subHabitIds` has a sunset date.
