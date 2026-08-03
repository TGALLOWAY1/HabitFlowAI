# Task 8 — History, Progress, and Analytics

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Read-only investigation of the derivation layer (analytics/insights/progress/
daySummary/dayView/truthQuery/goal-progress), spot-checked before acceptance (divergent
goal engines at `analyticsService.ts:1373`, discarded server heatmap at
`AnalyticsPage.tsx:81-84`, ignored `days` on goals summary — all re-verified directly).
Insights statistics and sleep analytics internals were verified in Task 3.

---

## 1. Derived-read endpoints and their engines

| Endpoint | Engine | Window | Cache |
|---|---|---|---|
| `GET /api/progress/overview` | `progress.ts` + `streakService` + `momentumService` + `computeGoalsWithProgressFromData` | **unbounded** entry history | 30 s (`progressCache`) |
| `GET /api/daySummary?start&end` | `daySummary.ts` (raw entries → `DayLog` map) | client passes 90 d; server default 400 d; year heatmap lazily extends to 365 d | none |
| `GET /api/dayView?dayKey` | `dayViewService` (truthQuery EntryViews) | single day + its ISO week | none |
| `GET /api/analytics/habits/all` | `analyticsService` (5 computations off one load) | `days` (90) + `heatmapDays` (365) | 60 s |
| `/api/analytics/habits/{summary,heatmap,trends,category-breakdown,insights}` | same service, separate loads | `days` | none |
| `/api/analytics/routines/summary`, `/goals/summary`, `/sleep/summary` | `analyticsService` / `sleepAnalyticsService` | days; **goals ignores `days`** | sleep 60 s |
| `/api/insights/*` (5) | `insightsService` + `correlationEngine` | `days` (90, 1-365) | 60 s |
| `GET /api/goals-with-progress` / `GET /api/goals/:id/detail` | `goalProgressUtilsV2` list/full paths | goal-dependent | none |

Caching: two process-local TTL caches (30 s progress / 60 s analytics; FIFO eviction,
500 keys), invalidated by `${userId}:` prefix from ~40 mutation sites
(`invalidateUserCaches`). Gaps: dashboardPrefs (owns `sleepTargets`) and
med/supp/symptom writes never invalidate; caches are per-process (multi-instance
deployments would serve stale).

## 2. Key metric definitions (`analyticsService.ts`)

- Universe: `isTrackableHabit` — excludes archived, deleted, and **bundle parents**
  (children counted individually); analytics therefore never shows bundle streaks.
- **Opportunity**: scheduled per the day-resolved schedule, or evidenced by an actual
  entry on a schedule-matching day (backdated history honored; `:200-222`).
- **`consistencyScore`** = days-with-≥1-completion / **calendar days** in window.
- **`completionRate`** = completed habit-days / **scheduled habit-days**. (Two different
  denominators shipped side-by-side in one summary; routines add `reliabilityRate` =
  completed/started sessions; medications add `adherencePercent` = taken/**logged** days.)
- Best/worst day-of-week via noon-UTC DOW buckets; trend = last-14 vs prior-14 days
  (±0.03 dead zone); category status ladder Strong ≥0.8 / Needs Attention / Neglected
  <0.15; heatmap emits per-day `{completionPercent (0-1 fraction), completed, scheduled}`;
  routine "effectiveness" = habit completion on routine-days vs other days.
- Insights tab discoveries: fixed priority (improves-correlation → worsens → best
  improving/declining prediction → check-in coverage milestone [100/60/30/14/7]).

## 3. Progress overview payload (drives Dashboard + tracker streak chips)

`{todayDate, habitsToday[{habit, completed, value?, currentStreak, bestStreak,
atRisk, formattedStreak, freezeStatus('none' hardcoded), weekSatisfied/Progress/Target}],
goalsWithProgress[], momentum{global, category}}`. Streaks computed over the **entire
entry history** per user; bundle parents get derived day-states from temporal
memberships (or subHabitIds fallback) including `streakCompleted`. Momentum = 7-day
active-days score; category momentum returns state only.

## 4. daySummary vs dayView (two philosophies)

- **daySummary** → the client's `logs` map: per habit-day `{value, completed, source,
  routineId?, bundleOptionId?, completedOptions?, isFrozen, freezeType?}`. Freeze
  detection prefers `entry.freezeType`, falls back to `note:'freeze:*'`; a real
  completion beats a freeze on the same day. Bundle parent logs written only if absent
  (preserves legacy parent entries).
- **dayView** → typed per-habit status `{isComplete, isPartial, currentValue,
  targetValue, progressPercent, weekComplete?, completedChildrenCount?}` via truthQuery
  EntryViews; weekly-quota habits (and weekly children inside bundles!) evaluate against
  the whole ISO week; freeze entries filtered out entirely — **no `isFrozen` concept**;
  `evidenceHints` declared but never populated.

## 5. truthQuery

Normalizes `HabitEntry` docs into `EntryView` (dayKey-canonical, provenance nested,
sorted by `(dayKey, timestampUtc)`). Used by goal progress, goal detail, dayView, and
entry reads — **not** by analytics/progress/daySummary, which re-canonicalize raw
entries themselves. No DayLog collection access remains; `conflict`/`legacyValue` fields
are vestigial hardcodes. Legacy `date`/`dateKey` fallbacks are dev-gated.

## 6. Goal progress (`goalProgressUtilsV2` — the accurate engine)

- Modes: `aggregationMode` explicit else cumulative⇒**sum**, onetime⇒count;
  `countMode` default `distinctDays`; units matched case-insensitively with naive
  pluralization (mismatch warns, still counts).
- **sum**: Σ entry values, with **boolean habits contributing `target ?? 1` per entry**;
  **count**: entry count or distinct dayKeys. Tracked goals filter to
  `activeWindowStart..End` first. Deleted habits' entries keep counting (repositories
  loaded `includeDeleted` so multipliers/units still resolve).
- Milestones: `completed` always derived from `currentValue >= value` (can't disagree
  with the bar); `completedAtDayKey` from a running cumulative walk — **detail path
  only**.
- **List path** (`computeGoalListProgress`) avoids full history via Mongo `$group`
  totals; tracked goals routed through the full path (one windowed query each,
  sequential). Known approximation: multi-habit `distinctDays` = max(precise 30-day
  union, per-habit-sum upper bound) — list can overstate vs detail.
- Goal detail returns `{goal, progress, contributions[], history(legacy)}` where
  `Σ contributions.value === progress.currentValue` by construction — the one series
  the cumulative chart, weekly summary, and day list all render.

## 7. Client heatmaps don't use the analytics API

Dashboard `ActivitySection` (overall year/90d/30d + per-category rows) is computed
**client-side from the daySummary `logs` map**; the year view lazily backfills days
91-365. Intensity is normalized per-range (same day changes color across ranges); no
schedule filter (deliberate "activity view"). The server heatmap feeds only the
Analytics page — and in fact is never rendered (§8.1).

## 8. Suspected bugs / inconsistencies (→ Task 12)

1. **Server heatmap computed and discarded:** `/habits/all` always computes a 365-day
   heatmap (forcing a ≥365-day entry fetch) that no client reads
   (`AnalyticsPage.tsx:81-84` destructures everything but `heatmap`).
2. **Four dead analytics routes:** `/habits/{heatmap,trends,category-breakdown,insights}`
   have client wrappers with zero callers.
3. **Two divergent goal engines:** `computeGoalAnalytics` (Analytics → Goals tab)
   ignores bundle resolution and `activeWindow`, lacks the boolean-target multiplier,
   and defaults active cumulative goals to **count** (`analyticsService.ts:1373`) where
   the canonical engine defaults to **sum** — same goal, different numbers on Goals page
   vs Analytics tab (and the number can jump when a goal completes, since the
   completed branch uses sum).
4. **`/api/analytics/goals/summary` ignores `days`** while both callers pass one — the
   range picker does nothing on that tab; unbounded entry read every call.
5. **Divergent freeze detection:** analytics checks only the `note` prefix; progress/
   daySummary prefer `freezeType`. A client-written `freezeType`-only entry would count
   as a real completion in analytics.
6. **Percent-named fractions** (`completionPercent` etc. are 0-1).
7. **Perf:** dayView does 2×bundles+2 serialized membership queries per request
   (uncached); daySummary bundle derivation is O(children × total logs); progress/
   daySummary/goals-summary read unbounded entry history.
8. **Dead/discarded outputs:** `freezeStatus` hardcoded `'none'`; category momentum
   `activeDays` dropped; `evidenceHints` never populated;
   `computeGoalsWithProgressV2` has no production caller.
9. Best/worst DOW pickers collapse to the same day on uniform data (no tie-break in the
   summary path).
10. List-vs-detail goal divergence (documented approximation) plus missing
    `completedAtDayKey` on list milestones.

## 9. iOS-relevant conclusions

- Treat `/api/progress/overview`, `/api/daySummary`, `/api/dayView`, and
  `/api/goals/:id/detail` as the four primary derived reads an iOS client needs; they
  are self-consistent. Avoid `/api/analytics/goals/summary` until the engine divergence
  (§8.3) is resolved — prefer `goals-with-progress`/detail for any goal numbers.
- Caches are short and per-process — an iOS client must not assume read-your-write
  consistency across endpoints within ~30-60 s (progress overview may lag an entry
  write by up to 30 s; daySummary is always fresh).
- The heatmap can be computed client-side from daySummary exactly like the web app
  does — no analytics dependency needed for the dashboard.
- Response payload shapes worth codifying for Swift: `DayLog` map (daySummary),
  `DayViewHabitStatus`, `habitsToday` row, `GoalProgressV2` + `contributions[]`.
