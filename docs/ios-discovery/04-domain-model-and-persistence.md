# Task 4 — Domain Model and Persistence

**Date:** 2026-08-03 · **Status:** Complete
**Method:** All 29 repository files mapped to collections/scoping/delete semantics by a
read-only investigation, reconciled and spot-checked against the repository (image-route
authz, conditional unique index, journal hard delete, canonical-type divergence, migration
wiring — all re-verified directly). Wellbeing topology resolved first-hand (see
DECISIONS.md 2026-08-03).

---

## 1. Collection inventory

`MONGO_COLLECTIONS` (`src/models/persistenceTypes.ts:1499-1534`) declares **34
collections**; 32 have repositories, plus one undeclared collection in use:

- **Truth-ish domain data:** `habitEntries` (canonical behavioral truth), `habits`,
  `categories`, `goals`, `goalTracks`, `routines`, `routineLogs`, `routineImages`,
  `journalEntries`, `wellbeingEntries`, `tasks`, `bundleMemberships`,
  `habitPotentialEvidence`, `dashboardPrefs`, `aiReports`
- **Health hub:** `medications`+`medicationLogs`, `supplements`+`supplementLogs`,
  `symptoms`+`symptomLogs`, `healthMetricsDaily`, `habitHealthRules`, `healthSuggestions`
- **Auth/infra:** `users`, `sessions`, `invites`, `passwordResetTokens`,
  `householdUsers`, `pushSubscriptions`, `pushSendLog`
- **Legacy declared:** `wellbeingLogs` (dead-but-registered API; see §5), `dayLogs` and
  `goalManualLogs` (**no repositories** — referenced only by the delete-all list
  `userData.ts:26-27` and demo wipe `seedShowcase.ts:122`)
- **Undeclared but used:** `_migrations` (ledger, `migrations/startup.ts:10`)

Six repositories hardcode their collection string instead of importing the constant
(`bundleMembership`, `category`, `habitEntry`, `habit`, `journal`, `wellbeingLog` repos) —
the constant is not actually authoritative.

## 2. Identity scoping — NOT uniform

`scopeFilter(householdId, userId)` (`src/server/lib/scoping.ts:18-36`) is the intended
pattern, and most repositories filter on **household + user**. Exceptions:

| Repository | Actual scope | Note |
|---|---|---|
| `journal.ts` | **userId only** | "Reflective truth" per DATA_MODEL.md, yet no household isolation |
| `wellbeingEntryRepository.ts` | **userId only** | canonical wellbeing truth |
| `taskRepository.ts`, `routineLogRepository.ts`, `wellbeingLogRepository.ts` | **userId only** | |
| `routineImageRepository.ts` | **completely unscoped** (unique index `{routineId}`) | **Mitigated at route level**: `getRoutineImageRoute` first loads the routine via `getRoutine(householdId, userId, routineId)` and 404s (`routines.ts:694-732`), so the API is not an authz hole — but the repo has no defense-in-depth |
| `householdUserRepository.ts`, `inviteRepository.ts` | householdId only / codeHash | by design |
| `pushSendLogRepository.ts` | writes household+user but the **dedup unique index is unscoped** (`{habitId,dayKey,endpoint}`) | habit ids are UUIDs, so collisions are theoretical |

**iOS relevance:** userId is the de-facto tenancy boundary; householdId is inconsistently
enforced and the multi-user household concept exists only in the API layer.

## 3. Delete semantics — three soft-delete conventions plus real hard deletes

- `deletedAt` timestamp: habits, habitEntries (upsert revives via `$unset`,
  `habitEntryRepository.ts:308`), aiReports, medications/supplements/symptoms.
- `isDeleted` boolean **+** `deletedAt`: wellbeingEntries — and `isDeleted` participates
  in the unique index yet is **not declared on the `WellbeingEntry` interface**
  (`wellbeingEntryRepository.ts:30,238-239` vs `persistenceTypes.ts:985-1016`).
- Status flags: tasks (`status:'deleted'`), habitHealthRules (`active:false`),
  healthSuggestions (`status`), invites, pushSubscriptions (`disabledAt` + hard delete on
  unsubscribe).
- **Hard deletes exist and contradict `docs/DATA_MODEL.md:60`** ("Truth records are never
  hard-deleted"): `journalEntries` (`journal.ts:212`), `routines`
  (`routineRepository.ts:220`, policy stated in-code at `:106`), `goals`
  (`goalRepository.ts:113`), `goalTracks`, `categories`, `wellbeingLogs`, plus
  bundle-membership `deleteOne` (`:254`).
- No delete path at all: `habitPotentialEvidence` (accumulates forever, no TTL),
  `healthMetricsDaily`, `routineLogs`, `users`.

## 4. Core document shapes (persistence authority: `src/models/persistenceTypes.ts`)

- **HabitEntry** (`:1583-1697`): `id`, `habitId`, `timestamp`, optional `value`,
  **`dayKey` is the only persisted aggregation field** (`date` is accepted as input and
  returned as a derived alias, never stored); provenance `source:
  'manual'|'routine'|'quick'|'import'|'apple_health'|'test'`, `routineId`, `variantId`,
  `sourceRuleId`, `importedMetricValue/Type`; freeze marker `freezeType`; bundle fields
  (`choiceChildHabitId`, `optionKey`, deprecated `bundleOptionId`); `deletedAt`.
  Uniqueness: `(householdId,userId,habitId,dayKey)`.
- **Habit** (`:86-199`): `goal {type:'boolean'|'number', target, unit}`, `assignedDays`,
  `requiredDaysPerWeek`/legacy `timesPerWeek`, bundle fields (`type:'bundle'`,
  `subHabitIds`, `bundleParentId`), `linkedGoalId`, `linkedRoutineIds`, archive trio,
  `trackingRevisions`, `inactivePeriods`, reminder pair, zombie `nonNegotiable*` fields.
- **Goal** (`:1067-1203`): type, `targetValue`, `linkedHabitIds`, `aggregationMode`,
  `countMode`, `linkedTargets`, track trio (`trackId`, `trackOrder`,
  `trackStatus:'locked'|'active'|'completed'`), `activeWindowStart/End`,
  `iteratedFromGoalId`, `milestones[{id,value,acknowledgedAt?}]`, `badgeImageUrl`.
- **Routine** (`:527-598`): `steps`, `variants` (may be empty pre-migration — resolve via
  `resolveVariant()`), `defaultVariantId`, `linkedHabitIds`, image fields, reminder pair.
  **No soft delete.** `RoutineLog` has **no `id`** — composite key
  `${routineId}-${variantId}-${date}` (`routineLogRepository.ts:18-23`).
- **JournalEntry** (`:647-689`): `templateId`, `mode:'standard'|'deep'|'free'`, `persona`
  snapshot, `content` keyed by prompt id, `date`. No `deletedAt` (hard delete).
- **WellbeingEntry** (`:985-1016`): per-metric row — `dayKey`, `timeOfDay`,
  `metricKey` (locked enum), `value`, `source:'checkin'|'import'|'test'`; unique on
  `(userId,dayKey,timeOfDay,metricKey,isDeleted)`.

**Type-authority conflict:** `src/server/domain/canonicalTypes.ts:30-85` ("canonical"
HabitEntry) still declares `date` as the aggregation field with no `dayKey`/`freezeType` —
**the "canonical" type is the stale one**; `persistenceTypes.ts` + repository behavior are
the real contract (verified: repo writes `dayKey`).

## 5. Wellbeing topology (contradiction resolved)

The only live path is **`wellbeingEntries`**: check-ins decompose morning/evening sessions
into per-metric entries (`HabitContext.tsx:262-310` → `POST /api/wellbeingEntries`); reads
aggregate entries back into the UI's `DailyWellbeing` map (`HabitContext.tsx:149-160`).
`saveWellbeingLog`/`fetchWellbeingLogs` have zero callers; `/api/wellbeingLogs` routes
write only the legacy collection with no dual-write (`wellbeingLogs.ts:91-93`). The legacy
routes/repo/client functions are dead code awaiting deletion. Full entry in DECISIONS.md.

## 6. "Entries are truth" invariant — verified

- Write-side: `assertNoStoredCompletion` rejects `completed|isComplete|isCompleted|
  progress|currentValue|percent` on entry payloads (`canonicalValidators.ts:140-153`);
  mutation-field allowlist + immutable-field rejection in `habitEntries.ts:27-44`.
- Old DayLog recompute is an explicit no-op stub (`recomputeUtils.ts:1-19`); stale
  comments in `habitEntries.ts` header still mention DayLogs (cosmetic).
- CI-enforced by `entriesOnly.invariants.test.ts` (derived views agree on
  create/delete; concurrent upserts collapse to one entry) and `noDayLogImports.test.ts`.
- **Caveat:** the `(householdId,userId,habitId,dayKey)` unique index is created
  **conditionally** — `ensureHabitEntriesUniqueIndex` scans for duplicates first and
  *refuses to create the index* if any exist, logging a warning
  (`mongoClient.ts:57-89`). The one-entry-per-day invariant is therefore enforced
  opportunistically, not guaranteed.

## 7. Indexes and migrations

- **Two-tier index creation, no single source of truth:** central `ensureCoreIndexes` on
  first `getDb()` (`mongoClient.ts:127-192` — habits/categories/entries/health/auth
  uniques, sessions TTL, non-fatal on failure) + per-repository lazy `ensureIndexes()`
  latches in 10 repos (aiReports, dashboardPrefs, journal, pushSendLog 48h TTL,
  pushSubscriptions, routineImages, wellbeingEntries, med/supp/symptom logs).
  `bundleMembershipRepository.ensureIndexes` (`:292-303`) has **no caller** — its three
  indexes likely never exist; only the central bundle index lands.
- **Startup migrations** (`startup.ts:27-47`, `_migrations` ledger): only **002**
  (weekly frequency → `timesPerWeek`) and **003** (goal dedupe) are wired.
  **`001_add_routine_variants.ts` exists on disk but never runs** — consistent with
  `Routine.variants` being documented as possibly empty "pre-migration".

## 8. `docs/DATA_MODEL.md` verification (trust downgrade: Medium → Low-Medium)

Wrong or stale claims found (details per line in the underlying investigation):
1. "Removed: dayLogs, goalManualLogs" — still declared and still referenced by live wipe
   code.
2. The "current collections" list omits **12 of 34** real collections (goalTracks, all
   med/supp/symptom collections, users, sessions, invites, householdUsers,
   passwordResetTokens).
3. "Truth records are never hard-deleted" — false for journalEntries, routines, goals,
   goalTracks, categories (§3).
4-5. Both stated unique indexes for health collections omit `householdId`.
6. wellbeingEntries' distinct `isDeleted` mechanism undocumented (and undeclared in its
   own interface).
7. "Behavioral truth: habitEntries only" — med/supp/symptom logs are separate per-day
   behavioral collections with their own unique day indexes.
8. Bundle-membership section omits `daysOfWeek` and `graduatedAt` fields and the hard
   delete path.
Accurate and notable: push subscription/send-log descriptions (precise), habit soft-delete
rationale, goal milestone storage minimalism.

## 9. Suspected bugs / risks added to the register (→ Task 12)

1. Conditionally-absent habitEntries unique index (§6 caveat).
2. `isDeleted` index field undeclared on `WellbeingEntry` interface.
3. Household scoping absent on 5 repos + routineImages fully unscoped (route-mitigated).
4. `canonicalTypes.ts` stale vs. persistence reality (misleading name).
5. Orphaned migration 001; uncalled bundle-membership `ensureIndexes`.
6. `habitPotentialEvidence` unbounded growth (no delete/TTL).
7. dayLogs/goalManualLogs zombies in constants + wipe lists.

## 10. iOS-relevant conclusions

- The API's implicit contract is **per-metric wellbeing entries**, **dayKey-keyed habit
  entries**, and **derived-only progress** — an iOS client should mirror exactly that and
  never cache/derive its own completion state for server truth.
- `persistenceTypes.ts` is the type file to generate Swift models from — not
  `canonicalTypes.ts`.
- Uniqueness keys the client can rely on: entry `(habitId, dayKey)`, wellbeing
  `(dayKey, timeOfDay, metricKey)`, med/supp/symptom logs `(entityId, dayKey)`,
  routineLog `(routineId, variantId, date)`.
- Deletion behavior differs per entity (soft vs hard vs none) — sync logic must not
  assume tombstones exist for every entity type.
