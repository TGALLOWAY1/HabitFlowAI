# M2 Write Paths & DayKey Map (Audit)

Internal map of all HabitEntry mutation routes and dayKey/timezone logic for M2 (atomic upsert + unique index + dedupe).

---

## 1. Endpoints that create/update/delete HabitEntries

| Method + Path | Handler | Repository / behavior |
|---------------|---------|------------------------|
| **POST /api/entries** | `createHabitEntryRoute` | `habitEntryRepository.createHabitEntry` — insert one. No upsert. |
| **PUT /api/entries** | `upsertHabitEntryRoute` | `habitEntryRepository.upsertHabitEntry` — **read-then-write** (findOne then update or insert). |
| **PATCH /api/entries/:id** | `updateHabitEntryRoute` | `habitEntryRepository.updateHabitEntry` — findOneAndUpdate by `id` + `userId`. |
| **DELETE /api/entries/:id** | `deleteHabitEntryRoute` | `habitEntryRepository.deleteHabitEntry` — soft delete by `id` + `userId`. |
| **DELETE /api/entries/key** | `deleteHabitEntryByKeyRoute` | `habitEntryRepository.deleteHabitEntryByKey` — soft delete by `(habitId, dateKey, userId)`; **updateOne** (only one doc if duplicates exist). |
| **DELETE /api/entries** (query: habitId, date) | `deleteHabitEntriesForDayRoute` | `habitEntryRepository.deleteHabitEntriesForDay` — **updateMany** soft delete for (habitId, dayKey, userId). |

**Route registration:** `src/server/index.ts` (lines 180–186).

---

## 2. Batch / non-API write paths (HabitEntry mutations)

| Location | Function / flow | Behavior |
|----------|------------------|----------|
| **src/server/routes/routines.ts** (≈821–841) | Routine submit: `habitIds.map` → `upsertHabitEntry(habitId, logDate, userId, {...})` | Batch of **upserts** (one per habit); same non-atomic read-then-write as PUT /api/entries. |
| **src/server/utils/migrationUtils.ts** | `backfillDayLogsToEntries` | For each DayLog: check `entryDateMap` (existing entries by date), then **createHabitEntry** (no dayKey normalization; uses `log.date` and `timestamp: \`${log.date}T12:00:00.000Z\``). |
| **src/utils/entryMigration.ts** | `migrateDayLogsToEntries` | In-memory only; builds `HabitEntry[]` with `dateKey`/`date`, no DB. Used for legacy schema migration. |
| **scripts/seed-fitness.ts** | Multiple `upsertHabitEntry(habitIdByKey.*, dayKey, args.userId, {...})` | Uses repo `upsertHabitEntry` directly (same race as API). |
| **scripts/seed-emotion-regulation.ts** | `upsertHabitEntry(habitId, dayKey, args.userId, {...})` | Same. |

---

## 3. Upsert and findOne-then-insert/update sequences

| Location | Function | Logic |
|----------|----------|--------|
| **src/server/repositories/habitEntryRepository.ts** (359–425) | `upsertHabitEntry` | 1) `collection.findOne({ habitId, $or: [{ dayKey }, { date: dayKey }], userId, deletedAt: { $exists: false } })`. 2) If existing → `updateOne` by `_id`. 3) Else → `insertOne`. **Not atomic**; concurrent requests can both see “no existing” and both insert → duplicates. |

**No other upsert implementations** for HabitEntry; all “upsert” flows go through this function (API PUT, routine submit, seeds).

---

## 4. DayKey computation and timezone assumptions

### 4.1 Canonical / shared

| File | Functions / usage | Notes |
|------|-------------------|--------|
| **src/domain/time/dayKey.ts** | `isValidDayKey`, `assertDayKey`, `formatDayKeyFromDate(date, timeZone)`, `getNowDayKey(timeZone)` | Timezone-aware via `Intl.DateTimeFormat`; no UTC hardcoding. |
| **src/server/utils/dayKeyNormalization.ts** | `normalizeDayKey(options)`, `normalizeHabitEntryPayload(payload, timeZone?)` | Priority: dayKey → date (legacy) → timestamp + timeZone. **UTC default:** `timeZone: timeZone \|\| 'UTC'` in `normalizeHabitEntryPayload` (line 102). |
| **src/server/domain/canonicalValidators.ts** | `validateDayKey`, `validateHabitEntryPayloadStructure` | Format validation only; no date math. |

### 4.2 Route / server dayKey usage

| File | Usage | UTC / timezone |
|------|--------|-----------------|
| **src/server/routes/habitEntries.ts** | create: `userTimeZone = entryData.timeZone \|\| 'UTC'`; update: same for patch; upsert: **no dayKey normalization** (uses `dateKey` from body as-is). | Default UTC when timeZone missing. Upsert does not run through `normalizeHabitEntryPayload`. |
| **src/server/routes/routines.ts** (717–735) | `deriveDateString(dateInput?)` | **Uses `date.getFullYear()`, `getMonth()`, `getDate()` — server local (or ISO parsing), not user timezone.** Used as `logDate` for routine submit → HabitEntry dayKey. |

### 4.3 Read-path dayKey fallbacks (legacy)

| File | Line / pattern | Note |
|------|----------------|------|
| **src/server/repositories/habitEntryRepository.ts** | All reads: `entry.dayKey \|\| entry.date`; queries: `$or: [{ dayKey }, { date: dayKey }]` | Canonical field is `dayKey`; `date` supported for legacy docs. |
| **src/server/routes/daySummary.ts** | 68: `entry.dayKey \|\| entry.date \|\| entry.dateKey` | Triple fallback for aggregation. |
| **src/server/routes/dashboard.ts** | 60: `entry.dayKey \|\| entry.date` | Same pattern. |
| **src/server/routes/progress.ts** | 76: `entry.dayKey \|\| entry.date` | Same. |

### 4.4 Frontend / scripts (UTC or local assumptions)

| File | Usage | Issue |
|------|--------|--------|
| **src/pages/WellbeingHistoryPage.tsx** | 79, 122, 131, 169: `d.toISOString().slice(0, 10)` | **UTC date** for day keys (not user timezone). |
| **src/server/routes/progress.ts** | 33: `new Date().toISOString().slice(0, 10)` (fallback today) | UTC. |
| **src/server/routes/dashboard.ts** | 49: same | UTC. |
| **scripts/seed-fitness.ts**, **scripts/seed-emotion-regulation.ts** | Helpers using `d.toISOString().slice(0, 10)` | UTC. |
| **src/components/personas/fitness/SleepEnergyTrends.tsx** | `getDayKeyDaysAgo`: local “days ago” then `formatDayKeyFromDate(d, timeZone)` | Correct for display; “days ago” is calendar-local. |
| **src/components/personas/emotionalWellbeing/EmotionalWellbeingDashboard.tsx** | `getDayKeyDaysAgo` uses `setDate`/`getDate` (local); line 128/339: `new Date().toISOString().slice(0, 10)` for “today” | **UTC for “today”** in places; local for “days ago”. |

---

## 5. Soft-delete on HabitEntries

| Location | Behavior |
|----------|----------|
| **src/server/repositories/habitEntryRepository.ts** | `deleteHabitEntry` (by id): `$set: { deletedAt, updatedAt }`. `deleteHabitEntryByKey`: same. `deleteHabitEntriesForDay`, `deleteHabitEntriesByHabit`: same. |
| **Reads** | All repo reads filter `deletedAt: { $exists: false }` (e.g. getHabitEntriesByHabit, getHabitEntriesForDay, getHabitEntriesByUser). |
| **Schema** | `HabitEntry.deletedAt?: string` in `src/models/persistenceTypes.ts` (≈1153). |

**Index (mongoClient.ts:37):** `{ userId: 1, habitId: 1, dayKey: 1, deletedAt: 1 }` — **non-unique**. Unique index is only `{ userId: 1, id: 1 }`. So multiple active entries per (userId, habitId, dayKey) are allowed today.

---

## 6. Known failing tests / TODOs (habitEntries.dayKey, TrackerGrid)

- **docs/audits/audit_v1/10_OPEN_QUESTIONS.md**  
  - RQ-03: Validate duplicate HabitEntry creation under concurrent writes (non-atomic upsert + no unique (userId, habitId, dayKey)).  
  - RQ-04: Reproduce day-boundary errors near midnight/DST (daySummary default range, normalization UTC fallback).
- **docs/audits/audit_v1/09_PRIORITIZED_SURGICAL_PLAN.md**  
  - Add unique active index on habitEntries for (userId, habitId, dayKey) with soft-delete-aware strategy; run `habitEntries.dayKey.test.ts`; add concurrent upsert collision test.
- **src/server/services/truthQuery.ts**  
  - TODO (≈250): Add routineExecutionId when available in HabitEntry schema.
- No explicit “failing” or `.skip` found in repo for `habitEntries.dayKey` or TrackerGrid payload in the scanned test files; open questions and audit docs reference the need for tests and validation.

---

## 7. Proposed smallest set of changes (M2)

1. **Unique index (soft-delete–aware)**  
   - Add a **unique** index that applies only to “active” entries. Two options:  
     - **Option A:** Unique on `(userId, habitId, dayKey)` and **before** adding the index run a dedupe script so no two active documents share the same triple (e.g. keep one, soft-delete or merge others).  
     - **Option B:** Unique partial index (if MongoDB version supports it) where `deletedAt` does not exist.  
   - Then ensure all write paths that create/update by (userId, habitId, dayKey) never insert a second active row (see below).

2. **Atomic upsert**  
   - Replace `upsertHabitEntry` read-then-write with a single **findOneAndUpdate** with `upsert: true`, filter: `{ userId, habitId, dayKey, deletedAt: { $exists: false } }`, and set-on-insert for id/timestamps.  
   - Keep the same function signature and call sites (habitEntries PUT route, routines submit, seeds, migrationUtils if it switches to upsert).

3. **Dedupe script (one-off, before or with index)**  
   - Script that: (a) finds all (userId, habitId, dayKey) with more than one active document; (b) for each group, keeps one (e.g. latest `updatedAt` or first by id) and soft-deletes the rest (set `deletedAt`, `updatedAt`).  
   - Run once before or as part of adding the unique index; optionally run in a transaction or with small batches to control lock time.

4. **Optional M2 hardening (minimal)**  
   - **Upsert route:** Run `dateKey` through the same dayKey validation/normalization as create (or at least `validateDayKey`) so body `dateKey` is always YYYY-MM-DD and, if desired, timezone-normalized.  
   - **Routine submit:** Replace `deriveDateString` with a timezone-aware dayKey (e.g. pass user timezone and use `formatDayKeyFromDate` for `submittedAt` or “now”) so routine-created HabitEntries use user day, not server local.

5. **Do not change in M2 (scope control)**  
   - Leave dayKey fallbacks on read paths (`dayKey || date || dateKey`) as-is for backward compatibility.  
   - Leave WellbeingHistoryPage / dashboard/progress UTC “today” and routine `deriveDateString` behavior for a later timezone story unless required for correctness of new writes.

---

## 8. File reference summary

| Concern | Files |
|--------|--------|
| HabitEntry write routes | `src/server/routes/habitEntries.ts`, `src/server/index.ts` |
| Repo create/update/delete/upsert | `src/server/repositories/habitEntryRepository.ts` |
| Batch upserts | `src/server/routes/routines.ts`, `src/server/utils/migrationUtils.ts`, `scripts/seed-fitness.ts`, `scripts/seed-emotion-regulation.ts` |
| DayKey domain | `src/domain/time/dayKey.ts`, `src/server/utils/dayKeyNormalization.ts`, `src/server/domain/canonicalValidators.ts` |
| Indexes | `src/server/lib/mongoClient.ts` (37–38) |
| Soft-delete | `habitEntryRepository.ts` (delete*, get* filters), `persistenceTypes.ts` (HabitEntry.deletedAt) |
| Read fallbacks | `src/server/routes/daySummary.ts`, `dashboard.ts`, `progress.ts` |
