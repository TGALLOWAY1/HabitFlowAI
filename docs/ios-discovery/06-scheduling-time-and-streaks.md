# Task 6 — Scheduling, Dates, Time Zones, and Streaks

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Direct full reads of `src/domain/time/dayKey.ts`, `src/server/utils/dayKey.ts`,
`src/domain/habits/schedule.ts`, `src/server/services/streakService.ts` (323 lines),
`freezeService.ts`, `momentumService.ts`, and `docs/semantics/daykey.md`; reconciled with
Task 4/5 findings. `scheduleEngine.ts` is a 12-line re-export of the shared schedule
domain — the real logic is client/server-shared under `src/domain/`.

---

## 1. DayKey policy (verified)

- **Format:** `YYYY-MM-DD`, validated as a real calendar date
  (`domain/time/dayKey.ts:29-45`). All arithmetic is **UTC-neutral** — dayKeys convert to
  UTC dates for add/diff/day-of-week so no process timezone or DST is involved
  (`:47-67`). Weeks are **ISO, Monday-start** (`getIsoWeekStartDayKey`, `:75-80`).
- **Timezone resolution (server):** `resolveTimeZone` accepts any valid IANA zone; missing
  or invalid input falls back to **America/New_York** — never UTC
  (`server/utils/dayKey.ts:75-84`). Applied at every entry write via
  `normalizeHabitEntryPayload` (input priority `dayKey` > legacy `date` > `timestamp`+tz).
- **Legacy fallback is dev-gated:** reading a stored entry without `dayKey` may fall back
  to `date`/`dateKey`/timestamp only when `NODE_ENV !== 'production'` or
  `ALLOW_DAYKEY_LEGACY_FALLBACK` is set (`server/utils/dayKey.ts:17-24,30-70`); in
  production such entries resolve to `null` rather than a guessed day.
- **`docs/semantics/daykey.md` verification:** accurate on rule, fallback, and usage, with
  two defects: (a) it cites `GET /api/dashboard/streaks`, which **does not exist** in
  `app.ts` (verified by grep); (b) it states the one-entry-per-key DB invariant as
  unconditional — Task 4 showed the unique index is created only when no duplicates exist
  (`mongoClient.ts:57-89`). Trust: High minus those two claims.

## 2. Schedule model (`src/domain/habits/schedule.ts` — shared client/server)

Three schedule inputs, resolved **per-day** through tracking revisions
(`resolveHabitTrackingForDay`), so schedule edits never rewrite history:

- `assignedDays: number[]` (0=Sun…6=Sat) — a day matches iff included (`:96-101`); no
  assignedDays ⇒ every day matches.
- `requiredDaysPerWeek` — with assignedDays and `required < assigned.length`, the habit
  becomes a **flexible weekly quota** ("any N of these days"); `required ==
  assigned.length` stays a strict daily-occurrence habit (`usesWeeklyQuotaStreak`,
  `:31-40`).
- `timesPerWeek` (legacy, migration-written only — Task 3 C5) — always a weekly quota
  with that target.
- **Creation boundary:** days before the habit's created dayKey are never scheduled
  (`isHabitScheduledOnDay`, `:103-111`); created dayKey prefers the user timezone, falling
  back to the stored ISO prefix (`:68-82`). **Inactive periods** (archive/restore
  intervals) unschedule their days (`matchesHabitScheduleOnDay:96`).
- **Expected opportunities in a range** (`:120-146`): daily-scheduled days count 1 each;
  pure `timesPerWeek` habits count 1 per touched ISO week — the denominator used by
  progress/consistency metrics.

## 3. Streaks (`src/server/services/streakService.ts` — the canonical engine)

Input is day-level `HabitDayState[]` (derived from entries at read time; nothing stored).
`calculateHabitStreakMetrics` (`:303-323`) picks one of two modes by
`usesWeeklyQuotaStreak` on the reference day:

**Daily (opportunity) streaks** (`:104-174`):
- Streaks count **scheduled opportunities, not adjacent calendar days** — unscheduled
  days can't break a streak.
- A day is *protected* if completed (`streakCompleted ?? completed`) **or frozen**; a
  freeze protects continuity but is not reported as a completion (`:112-116`).
- **Open-day grace:** an unfinished opportunity *today* doesn't break the current streak —
  it's excluded from the cursor and flagged `atRisk` (`:152-158,172`).
- Lifetime starts at the earlier of created-day and the earliest recorded state — a
  backdated/imported entry extends history without inventing missed opportunities before
  it (`:60-70,121-128`).
- **Mode-change segmentation:** switching daily↔weekly starts a new comparable streak
  segment (`getCurrentStreakModeStartDayKey`, `:85-98`).

**Weekly quota streaks** (`:225-295`):
- Unit is the **satisfied ISO week** (distinct protected scheduled days ≥ target;
  quantities never count — consistent with `weeklyProgress.ts`).
- Frozen days count toward the week's protected-day count even off-schedule (`:184-185`).
- The current unfinished week doesn't break the streak; `atRisk` when unsatisfied with
  ≤2 days left (`:260-267,290`).
- Weeks intersecting an inactive (archive/restore) period are **excused entirely**
  (`getEligibleWeeklyPeriodKeys`, `:201-223`).
- Per-week target resolved for that week's *end* day (`:195,247`) — target edits apply
  from the week they land in.

Consumers: `progress.ts` (overview), `analyticsService`. Nothing writes streaks anywhere.

## 4. Freezes — dormant, and unshippable as-is

Design (`freezeService.ts:7-17`): inventory `habit.freezeCount` (default 3, max 3);
auto-freeze consumes one when a miss would break a streak — daily habits checked against
"yesterday", weekly habits on Mondays against the prior week; the freeze is a zero-value
entry (`freezeType: 'auto'`, `note: 'freeze:auto'`).

Status re-confirmed: `processAutoFreezes` has **no production caller** (Task 3). Two
additional defects found on full read: it computes days with `new Date()`/`format(...)`
in the **server's local timezone** (not the user's — would misfire across zones), and it
detects weekly habits via legacy `timesPerWeek` only (missing the current
`requiredDaysPerWeek` quota form). The *read* path (frozen cells, "N freezes left"
tooltip, streak protection, weekly excusal) is fully wired and shipping.
`progress.ts:212` hardcodes `freezeStatus: 'none'`.

## 5. Momentum — live client twin, dead server twin

7-day "active days" engagement score (any completed habit = active day), states
Strong/Steady/Building/…, philosophy "Momentum > Purity" (`momentumService.ts:13-20`).
The client implementation (`src/utils/momentum.ts` → `CategoryMomentumBanner`) is what
users see; the server twin computes `momentum.global`/`momentum.category` on every
`/api/progress/overview` response that **no client reads** (Task 3). Undocumented in
FEATURES.md.

## 6. Suspected bugs / stale docs added to the register (→ Task 12)

1. `docs/semantics/daykey.md` cites nonexistent `GET /api/dashboard/streaks` and
   overstates the unique-index guarantee.
2. Dormant `freezeService` uses server-local dates and legacy-only weekly detection —
   two more reasons it cannot simply be switched on.
3. `streakService.dateToLocalDayKey` (`:43-48`) uses process-local time when neither
   `referenceDayKey` nor `timeZone` is supplied — callers must always pass one (the
   routes do; the fallback is a foot-gun).

## 7. iOS-relevant conclusions

- The streak semantics are subtle and **must be ported exactly**: opportunity-based
  counting, protected-vs-completed distinction, open-day grace, backdated-entry lifetime
  extension, mode-change segmentation, weekly excusal for inactive periods, ISO
  Monday weeks. `streakService.ts` + `schedule.ts` + `completion.ts` +
  `trackingHistory.ts` together form the portable spec (all are dependency-light pure
  functions with tests — good candidates for direct transliteration to Swift, or for
  server-side evaluation via `/api/progress/overview`).
- An iOS client should always send the device IANA timezone; the NY fallback exists but
  must never be relied on.
- DayKey arithmetic must be calendar-pure (UTC-neutral), never `Date`-in-local-zone.
- Freeze UI affordances exist in the web app but the feature can never trigger — iOS
  should treat freezes as **out of scope** unless the product decides to finish them.
