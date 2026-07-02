# Canonical Invariants Audit

## Canon Rules Applied
- Rule A: HabitEntry is sole behavioral truth.
- Rule B: Completion/progress are derived read models, never stored truth.
- Rule C: DayKey is the aggregation boundary and is user-timezone-relative.
- Rule D: Routines and journals do not imply completion.
- Rule E: Goals aggregate from HabitEntries only; goal-owned counters/logs are forbidden.

Primary references:
- `docs/DOMAIN_CANON.md:16-27`
- `docs/reference/V1/02_HABIT_ENTRY.md:14-18`, `:26-29`, `:33-39`, `:170-175`, `:233-240`
- `docs/reference/V1/11_TIME_DAYKEY.md:14-16`, `:48-57`, `:99-107`
- `docs/reference/V2 (Current - iOS focus)/03_Routine.md:218-229`
- `docs/reference/V2 (Current - iOS focus)/07_Metrics.md:24-38`, `:100-107`, `:230-245`

## Violations and Risk Areas
| ID | Status | Severity | Canonical rule violated | Evidence (code) | Why this violates canon | Suggested fix approach |
| --- | --- | --- | --- | --- | --- | --- |
| CI-01 | **Violation** | Critical | **Rule A** (`HabitEntry` sole truth) | `src/server/services/truthQuery.ts:85`, `:144`, `:149`, `:334` | truthQuery still merges DayLogs fallback by default, so non-canonical cache can influence entry views and derived reads. | Set `includeLegacyFallback=false` default; require explicit migration flag for temporary backfill diagnostics only. |
| CI-02 | **Violation** | Critical | **Rule E** (goals aggregate from HabitEntries only) | `src/server/routes/goals.ts:750-901`, `src/server/repositories/goalManualLogRepository.ts:1-138` | Goal-owned manual logs are persisted and included in progress, creating a second truth stream. | Deprecate `/manual-logs`; migrate existing logs into HabitEntries (source=`manual`), then remove goalManualLogs from computations. |
| CI-03 | **Violation** | Critical | **Rule E + Rule A** | `src/server/routes/goals.ts:955`, `:973-1016`, `src/server/utils/goalProgressUtils.ts:9-11`, `:72-106` | Goal detail endpoint computes progress/history from DayLogs + manual logs, bypassing canonical entries-only derivation. | Rewire `GET /api/goals/:id/detail` to use `computeGoalProgressV2` + EntryViews only. |
| CI-04 | **Violation** | High | **Rule A** + one-entry-per-day default (`V1 HabitEntry`) | `src/server/lib/mongoClient.ts:37-39`, `src/server/repositories/habitEntryRepository.ts:370-425` | No unique active constraint on `(userId, habitId, dayKey)`. Upsert does read-then-write and can race to duplicates. | Add unique index for active entries; replace upsert with single atomic upsert statement keyed by `(userId,habitId,dayKey,deletedAt absent)`. |
| CI-05 | **Violation** | High | **Rule C** (DayKey user-relative, immutable aggregation boundary) | `src/server/routes/daySummary.ts:21-35`, `:117`, `src/server/utils/dayKeyNormalization.ts:102` | daySummary default range is server-local date, not explicitly user-timezone day window; fallback defaults to UTC silently in multiple write/read paths. | Derive default windows with provided user timezone; require explicit timezone on writes where dayKey derivation is needed; avoid silent UTC fallback for behavioral entries. |
| CI-06 | **Violation** | High | **Rule D** (routines do not imply completion) | `src/server/routes/routines.ts:817-838`, `docs/reference/V2 (Current - iOS focus)/03_Routine.md:222-229` | Routine submit can auto-create HabitEntries for arbitrary passed IDs in one action, effectively making routine completion equal habit completion. | Move to evidence-confirmation flow: submit creates execution/evidence only; explicit per-habit user confirmation creates/updates HabitEntry. |
| CI-07 | **Violation** | High | **Rule D + HabitPotentialEvidence semantics** | `src/server/routes/habitPotentialEvidence.ts:19`, `src/server/repositories/habitPotentialEvidenceRepository.ts:26-56`, `src/models/persistenceTypes.ts:1200-1224` | Evidence uses hardcoded user ID and persistent DB records with non-canonical shape (`date`, `stepId`, `source='routine-step'`) instead of scoped dayKey/routineExecution semantics. | Use request userId, canonical evidence shape (`dayKey`, `routineExecutionId`, `source='routine'`), TTL/cleanup policy, consume evidence on confirmation. |
| CI-08 | **Violation** | Medium | **Rule B** (stored completion/progress forbidden) | Client: `src/components/TrackerGrid.tsx:1047-1052`; Guardrail: `src/server/domain/canonicalValidators.ts:144-152` | Frontend attempts to persist `completed`, which canonical validators reject. User action path is internally inconsistent. | Remove completion flags from client payloads; express deselection via delete-by-key or zero-value semantics validated per habit type. |
| CI-09 | **Risk** | Medium | **Rule C** | `src/server/routes/daySummary.ts:68`, `src/server/routes/progress.ts:76`, `src/server/routes/dashboard.ts:60` | Reads still tolerate legacy date/dateKey fallbacks; this is transitional but keeps DayKey contract soft and can hide malformed writes. | Add migration checks and telemetry; progressively disallow legacy fallback once data cleanup passes integrity thresholds. |
| CI-10 | **Risk** | Medium | **Rule B** | `src/server/routes/daySummary.ts:155-191`, `src/models/persistenceTypes.ts:1012-1014` | Derived completion/value is persisted as DayLog read model; acceptable as cache only, but still widely consumed and can be mistaken as truth. | Keep DayLogs strictly internal cache or remove from client-facing APIs after entries-first UI migration. |
| CI-11 | **Risk** | Medium | **Rule A** | `src/store/HabitContext.tsx:30`, `:77`, `:397`, `:429`, `:471` | Client mental model is still log-cache-first (`logs` state), not EntryView-first; increases chance of stale completion behavior. | Migrate UI state to EntryView/dayView responses directly; treat DayLog as adapter layer only during migration. |
| CI-12 | **Risk** | Low | **Rule D** (journals orthogonal) | `src/server/routes/journal.ts` and `src/pages/JournalPage.tsx` | No direct violation observed; journal does not feed completion logic. Residual risk is mostly auth/user fallback consistency. | Keep boundary unchanged; add integration test proving journal mutations never alter habit completion APIs. |

## Additional Canonical Drift Signals
- `src/models/persistenceTypes.ts:1176` redefines `PersistenceSchema`, preserving both `logs` and `habitEntries` in one schema; this reflects migration-era duality and type drift.
- `src/server/routes/goals.ts` imports both V1 and V2 progress utilities in same file (`computeGoalProgress` and `computeGoalProgressV2`) indicating incomplete cutover.

## Canonical Compliance Priority Order
1. Remove non-HabitEntry truth paths (truthQuery fallback + goal detail legacy computation + manual logs).
2. Enforce hard DayKey/uniqueness invariants at DB/API boundaries.
3. Complete routine/evidence semantics so routines stay supportive and explicit-confirmation-based.
