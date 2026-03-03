# Performance and Reliability Audit

## Primary Bottlenecks
| Area | Evidence | Bottleneck type | Impact |
| --- | --- | --- | --- |
| Goal detail frontend loading | Sequential per-habit fetch loop in `src/pages/goals/GoalDetailPage.tsx:80-83` | Client N+1 network pattern | Slow detail page for goals with many linked habits. |
| Goal detail backend history | `src/server/routes/goals.ts:973-990` loops linked habits and reads DayLogs | Server N+1 + legacy source | Increased latency and non-canonical compute path. |
| Legacy goal utility | `src/server/utils/goalProgressUtils.ts:87-92` loops through habits and fetches DayLogs per habit | Server N+1 DB reads | Scales poorly with habit count; inconsistent with V2 path. |
| daySummary endpoint | Fetches all user entries + habits each request (`src/server/routes/daySummary.ts:146-154`) and aggregates up to 400-day window | Heavy full-scan aggregation | High CPU/memory on large histories; called frequently from client refresh loops. |
| truthQuery batch habit reads | `getEntryViewsForHabits` fetches all entries + all dayLogs for user then filters (`src/server/services/truthQuery.ts:148-155`) | Broad-scope query then filter | Expensive for large datasets; unnecessary if habit set is small. |
| Client refresh loops | Habit actions call mutation then `refreshDayLogs` (full daySummary refetch) repeatedly (`src/store/HabitContext.tsx:429`, `:471`, `:667`, `:714`) | Overfetch + rerender churn | Sluggish interaction and extra backend load. |

## Polling / Rerender Pressure
- `useGoalsWithProgress` polls cache version every 100ms (`src/lib/useGoalsWithProgress.ts:79-81`).
- `ProgressDashboard` polls URL/persona param every 100ms in dev (`src/components/ProgressDashboard.tsx:113-120`).
- `PersonaSwitcher` polls active persona every 200ms (`src/components/personas/PersonaSwitcher.tsx:37`).

Result: unnecessary timers and wakeups, especially costly on laptops/mobile battery.

## Caching Risks (and Canonical Recomputability)
| Cache / read model | Evidence | Canonical risk |
| --- | --- | --- |
| DayLogs persistent cache | `src/server/routes/dayLogs.ts`, `src/server/repositories/dayLogRepository.ts` | Acceptable only as non-authoritative adapter. Risk rises because truthQuery still consumes it by default. |
| Goal in-memory cache | `src/lib/goalDataCache.ts` | Safe if invalidation is reliable; current polling workaround suggests cache/event design is brittle. |
| Wellbeing dual model | `wellbeingLogs` route writes compatibility adapter to `wellbeingEntries` (`src/server/routes/wellbeingLogs.ts:143-151`) | Transitional duplication can diverge without strict migration checks. |

## Reliability Gaps
1. **Data race risk on entry upsert**
- No unique active `(userId,habitId,dayKey)` constraint and non-atomic upsert flow.

2. **Auth fallback masking bugs**
- Missing user header silently collapses to `anonymous-user` (`src/server/middleware/auth.ts:38-41`), hiding integration mistakes.

3. **API contract drift risk**
- Evidence response shape mismatch already present (`/api/evidence`), indicating missing contract tests.

4. **Offline operation is shell-only**
- No queue/retry for write actions; PWA appears installable but action reliability offline is low.

## Observability / Logging Gaps
- Heavy reliance on `console.log` and `console.error` across route handlers and client contexts.
- No structured request logging (request ID, user ID, endpoint latency, error category).
- No metrics on canonical invariants (duplicate entries per day, legacy fallback usage rate, manual-log usage rate).
- No explicit SLO/SLA-style instrumentation for critical endpoints (`/api/entries`, `/api/daySummary`, `/api/goals-with-progress`).

## Recommended Reliability Upgrades (V1-Sized)
1. Add endpoint-level timing + error counters (middleware-based).
2. Add invariant telemetry counters:
- truthQuery legacy fallback hits
- duplicate active entries detected
- legacy DayLog endpoint usage
3. Replace polling with event-driven invalidation.
4. Add contract tests for high-risk response shapes (`/api/evidence`, goal detail payload).
