# Open Questions

## Needs User Input
| QID | Question | Why this is needed | Blocks / impacts |
| --- | --- | --- | --- |
| UQ-01 | What is the intended production auth model for V1 (single local user, shared household, or multi-user SaaS)? | Current `X-User-Id` header model is insecure for production, but migration path differs by intended deployment model. | M4 auth hardening scope and timeline. |
| UQ-02 | For existing goal manual logs, should we migrate them into HabitEntries (`source='manual'`) or archive and remove from active progress? | Canon says goals derive from HabitEntries only; migration choice changes user-visible historical progress. | M1 goal/manual-log cutover plan. |
| UQ-03 | Should routine submit be allowed to auto-create HabitEntries in V1, or should routines remain evidence-only with explicit user confirmation? | Current behavior conflicts with canonical routine semantics; product decision required before code removal. | M1/M3 routine logging UX and backend behavior. |
| UQ-04 | Is temporary backward compatibility for `/api/dayLogs` and `GET /api/goals/:id/detail` legacy fields still required by any external clients? | Removing legacy shape can break unknown consumers. | M1 and M5 deprecation speed. |
| UQ-05 | What timezone should be used when client does not provide one (`UTC` fallback today)? | Canon requires user-relative DayKey, but server currently defaults to UTC in multiple paths. | M2 DayKey derivation policy. |
| UQ-06 | Are admin migration/integrity routes expected to be callable in production environments? | Routes are currently unguarded beyond user header identity. | M4 admin route gating strategy. |
| UQ-07 | What is acceptable downtime/risk window for adding unique indexes on live collections? | Unique index rollout may fail if duplicates already exist and may require staged cleanup. | M2 migration sequencing and rollback planning. |
| UQ-08 | Should goal badge uploads remain publicly accessible via `/uploads` URLs, or require authenticated file serving? | Privacy/security policy is unclear for user-uploaded assets. | M4 upload hardening design. |

## Needs Runtime Reproduction
| QID | Runtime check needed | Code evidence | Why code-only audit is insufficient |
| --- | --- | --- | --- |
| RQ-01 | Confirm iPhone/PWA friction severity for tracker interactions (single tap vs delete gestures). | `src/components/TrackerGrid.tsx:1083-1186` uses delayed single-click + double-click deletion. | Real device interaction timing and accidental tap rate need manual validation. |
| RQ-02 | Confirm whether evidence endpoint mismatch causes visible user failure or is silently tolerated. | Route returns raw array (`src/server/routes/habitPotentialEvidence.ts:96`), client expects `{ evidence }` (`src/lib/persistenceClient.ts:1090-1092`). | Behavior depends on calling path, error handling, and current UI usage frequency. |
| RQ-03 | Validate duplicate HabitEntry creation under concurrent writes. | Non-atomic upsert + no unique `(userId,habitId,dayKey)` (`habitEntryRepository.ts:370-425`, `mongoClient.ts:38`). | Requires concurrent load test to quantify real-world duplicate rate. |
| RQ-04 | Reproduce day-boundary errors near midnight/DST with mixed timezones. | `daySummary` default range is server-local (`src/server/routes/daySummary.ts:28-35`), normalization UTC fallback (`dayKeyNormalization.ts:102`). | Needs controlled timezone simulation and timestamp fixtures. |
| RQ-05 | Verify whether `freezeHabit()` dead path is still reachable from UI. | Client helper exists (`src/lib/persistenceClient.ts:413-418`) with no corresponding server route in `src/server/routes/habits.ts`. | Reachability depends on current UI bindings and feature flags. |
| RQ-06 | Measure goal detail latency at realistic scale (many linked habits + long history). | N+1 fetch loops in `src/pages/goals/GoalDetailPage.tsx:80-83` and `src/server/routes/goals.ts:973-990`. | Requires seeded dataset and profiling under realistic data volume. |
| RQ-07 | Validate category reorder durability during failure scenarios. | `reorderCategories` deletes all then inserts (`src/server/repositories/categoryRepository.ts:174-185`). | Needs fault-injection test to confirm recovery behavior. |
| RQ-08 | Confirm actual behavior of raw `fetch` calls when identity mode switches between demo/real users. | Raw calls in `TaskContext.tsx` and `RoutineContext.tsx` bypass shared client identity logic. | Requires runtime toggling of user mode and cross-feature writes. |
