# 11_TIME_DAYKEY.md

> **Canonical Concept**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **DayKey** is a **timezone-normalized calendar date** that represents the user’s **subjective day**.

**DayKey — not timestamps — is the primary unit of aggregation in HabitFlow.**

A DayKey answers:

> “Which day, from the user’s perspective, does this belong to?”

It does **not** answer:

- What exact time something happened
- Whether something was early or late
- Whether something was “on schedule”

---

## Why DayKey Exists (System Purpose)

DayKey exists to solve four hard problems cleanly:

1. Timezone correctness
2. Daily habit aggregation
3. Weekly boundary consistency
4. Deterministic recomputation

Without a canonical DayKey:

- streaks drift
- weekly quotas miscount
- “today” becomes unstable
- edits corrupt history

---

## Core Invariants (Must Never Be Violated)

### DayKey Is Derived at Write Time

Whenever a time-based record is created:

1. Capture the precise timestamp in UTC
2. Convert it to the user’s timezone
3. Derive a DayKey in `YYYY-MM-DD`
4. Store that DayKey immutably

DayKey is **never recomputed dynamically**.

---

### Aggregation Uses DayKey, Not Timestamp

All aggregation must be based on DayKey:

- daily habit completion
- streaks
- weekly progress
- goal contribution
- day-level comparisons

Timestamps are for:

- ordering
- auditing
- debugging

Never aggregation.

---

### One Entry per (Habit, DayKey) — by Default

For daily habits:

```ts
UNIQUE (habitId, dayKey)
````

This guarantees:

* idempotent logging
* clean recomputation
* predictable UI behavior

Weekly habits may have multiple DayKeys per week — this is expected.

---

### DayKey Is User-Relative

DayKey is always derived from:

* the user’s timezone **at the time of entry**

Changing timezones later:

* does **not** rewrite historical DayKeys
* does **not** corrupt past aggregation

History reflects what the user experienced as “that day”.

---

## Canonical Fields (Applied Everywhere)

Any time-based record must follow this pattern:

```ts
{
  timestampUtc: string   // exact event time
  dayKey: string         // YYYY-MM-DD in user timezone (ONLY persisted aggregation day)
}
```

**Important:** The `date` field is **NOT persisted** for HabitEntry. It is:
- Accepted as legacy input (normalized to `dayKey`)
- Returned in API responses as a derived alias from `dayKey` (for backward compatibility)
- **NOT stored in the database**

This applies to:

* HabitEntry (dayKey persisted, date is input-only)
* RoutineExecution
* HabitPotentialEvidence
* JournalEntry
* Mood / wellbeing entries (future)

---

## Weekly Semantics (Built on DayKey)

### Week Definition

* A week is defined as a **set of DayKeys**
* Default: ISO week (Mon–Sun)
* Stored as a derived window, not a persistent field

Example:

```
Week of 2025-12-15
→ {2025-12-15 … 2025-12-21}
```

---

### Weekly Aggregation Rules

Weekly habits and goals:

* aggregate entries whose DayKeys fall within the week window
* reset when the window changes

No object may store a permanent `weekId`.

---

## Editing & Backfill Semantics (Critical)

### Editing an Entry’s Day

If a user edits:

* `timestampUtc`, or
* `dayKey`

Then the system must:

* recompute all derived metrics
* update streaks
* update weekly totals
* update goal progress

No cached state may survive this change.

---

### Backfilling Entries

Backfilled entries:

* derive DayKey using the user’s timezone at creation time
* are subject to explicit confirmation guardrails

Backfill does **not** mean “less real”.

---

## Explicit Edge Cases

### Late-Night Entries

If a user logs at 1:00 AM:

* It belongs to the DayKey derived from timezone
* It is **not** auto-assigned to “yesterday”

No implicit sleep-window hacks.

---

### Multiple Devices

* DayKey must be derived using the user’s timezone
* Server must not guess timezone implicitly
* Client or server derivation is acceptable if consistent

---

## What Must NOT Exist (Anti-Patterns)

To prevent temporal drift:

* ❌ implicit “today” based on server time
* ❌ dynamic recomputation of DayKey
* ❌ timestamp-only aggregation
* ❌ stored week counters
* ❌ time-based penalties (“late”, “missed”)

If any of these exist, time semantics are broken.

---

## LLM / Design Decision Checklist

Before implementing anything time-related, the system must ask:

1. Am I aggregating by DayKey, not timestamp?
2. Is DayKey derived once and stored immutably?
3. Would timezone changes corrupt history?
4. Can everything be recomputed deterministically?

If any answer is **no**, the design is invalid.

---

## Enforcement (API Boundary Validation)

### Validated at Route Level

All routes that accept DayKey or timeZone parameters validate them at the API boundary:

1. **DayKey Validation** (`validateDayKey`):
   - Must match YYYY-MM-DD format
   - Must be a valid calendar date (e.g., rejects "2025-13-01")
   - Enforced via `assertDayKey()` from `src/domain/time/dayKey.ts`

2. **TimeZone Validation** (`assertTimeZone`):
   - Must be a valid IANA timezone identifier (e.g., "America/Los_Angeles", "UTC")
   - Basic format sanity check + runtime validation via `Intl.DateTimeFormat`
   - Required for DayKey derivation in queries

### What Is Derived-Only

The following are **never stored** and must be computed on-demand:

- Week boundaries (derived from DayKey sets)
- "Today" / "current day" (derived from user's timezone + current timestamp)
- Weekly aggregates (derived from DayKey ranges)

### Validation Location

- **DayKey Utility**: `src/domain/time/dayKey.ts` (exports `assertDayKey`, `isValidDayKey`)
- **Canonical Validators**: `src/server/domain/canonicalValidators.ts` (exports `validateDayKey`, `assertTimeZone`)
- **Route Enforcement**: All routes accepting `dayKey` or `timeZone` query/body parameters

### Routes Enforcing DayKey/TimeZone Validation

- `GET /api/entries` - validates `startDayKey`, `endDayKey`, `timeZone`
- `POST /api/entries` - validates `date` (DayKey format)
- `PATCH /api/entries/:id` - validates `date` if provided
- `GET /api/dayView` - validates `dayKey`, `timeZone`
- `POST /api/routines/:id/submit` - validates `dateOverride` (DayKey format)

---

## One-Sentence Summary

DayKey is the immutable, user-relative calendar day used for all aggregation, ensuring consistent streaks, weekly progress, and recomputation across timezones.
