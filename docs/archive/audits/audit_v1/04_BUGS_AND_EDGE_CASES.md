# Bugs and Edge Cases

## Confirmed Bugs
| ID | Severity | Impacted flow | Evidence | Repro / Why it fails |
| --- | --- | --- | --- | --- |
| BUG-01 | High | Routine evidence hints in habit UI | Server returns raw array `res.json(evidence)` in `src/server/routes/habitPotentialEvidence.ts:96`; client expects `{ evidence: HabitPotentialEvidence[] }` in `src/lib/persistenceClient.ts:1090-1093` | `fetchPotentialEvidence()` resolves with `response.evidence` undefined, returning `[]`. Evidence appears missing even when records exist. |
| BUG-02 | High | Habit freeze action | Client calls `POST /api/habits/:id/freeze` (`src/lib/persistenceClient.ts:413-418`); no route in `src/server/routes/habits.ts` and no mount in `src/server/index.ts` | Any call to `freezeHabit()` returns 404. |
| BUG-03 | Medium | Choice bundle deselect in tracker | `TrackerGrid` sends `{ completed: false }` in upsert (`src/components/TrackerGrid.tsx:1047-1052`); validator rejects completion fields (`src/server/domain/canonicalValidators.ts:144-152`) | Deselect flow can produce 400 and stale UI state for legacy virtual options. |
| BUG-04 | Medium | Cross-view user identity consistency | `TaskContext` uses raw `fetch('/api/tasks')` without `X-User-Id` (`src/context/TaskContext.tsx:32-53`) while most app uses `apiRequest` with `X-User-Id` (`src/lib/persistenceClient.ts:95-101`) | Tasks may bind to fallback `anonymous-user` dataset instead of active client identity. |
| BUG-05 | Medium | Evidence route user scoping | Hardcoded `USER_ID = 'anonymous-user'` in `src/server/routes/habitPotentialEvidence.ts:19` | Multi-user separation is broken for evidence data and can leak/merge records across users. |
| BUG-06 | Low | Goal detail linked entry IDs | Goal detail maps EntryViews with fallback synthetic IDs `entry-${habitId}-${dayKey}` (`src/pages/goals/GoalDetailPage.tsx:86-98`) | Multiple entries on same day/habit can collide in client list semantics and editing references. |

## High-Risk Likely Bugs (Code-Backed)
| ID | Severity | Impacted flow | Likely failure mode | Evidence |
| --- | --- | --- | --- | --- |
| L-01 | High | Concurrent logging (same habit/day) | Duplicate active HabitEntries possible under concurrent upserts | No unique active `(userId,habitId,dayKey)` index (`src/server/lib/mongoClient.ts:37-39`) + read-then-write upsert (`src/server/repositories/habitEntryRepository.ts:370-425`). |
| L-02 | High | Day boundary correctness around timezone changes | Entries may aggregate into wrong day when timezone is omitted and UTC fallback is used | `normalizeHabitEntryPayload(... timeZone || 'UTC')` (`src/server/utils/dayKeyNormalization.ts:102`) + mixed route defaults. |
| L-03 | Medium | Routine evidence date correctness | `toLocaleDateString('en-CA')` in routine context may produce locale/runtime-dependent day strings and bypass canonical DayKey utility | `src/store/RoutineContext.tsx:202-227`. |
| L-04 | Medium | Touch/mobile habit deletion | Double-click-based delete path not discoverable/reliable on touch devices | `src/components/TrackerGrid.tsx:1083-1186`. |

## Edge Cases Likely Broken or Fragile
| Area | Severity | Why risky | Evidence |
| --- | --- | --- | --- |
| DaySummary default range across user timezones | Medium | Range uses server-local date components despite receiving `timeZone` | `src/server/routes/daySummary.ts:21-35`, `:117-144`. |
| Offline-ish behavior in PWA | Medium | Service worker caches shell only and excludes `/api/*`; no retry queue for mutations | `public/sw.js:29`, `:31-44`. |
| Large goal detail loads | Medium | N sequential `GET /api/entries` calls for linked habits with unbounded range | `src/pages/goals/GoalDetailPage.tsx:80-83`; `fetchHabitEntries` defaults no window (`src/lib/persistenceClient.ts:927-941`). |
| Evidence lifecycle cleanup | Medium | Canon expects ephemeral evidence, but implementation persists without TTL cleanup policy | `src/server/repositories/habitPotentialEvidenceRepository.ts:26-92`. |
| Legacy fallback drift | Medium | Entry views can include DayLog legacy values, causing conflict flags and mixed provenance in UI | `src/server/services/truthQuery.ts:85-96`, `:334-370`; debug page exposes `source='legacy'` paths. |
| Multi-tab cache coherence | Low | Goal hooks poll version every 100ms; stale/mutation timing may still race | `src/lib/useGoalsWithProgress.ts:65-85`, `src/lib/goalDataCache.ts`. |

## Flows with Highest User Pain Probability
1. Tracker choice-toggle behavior on mobile (invalid payload + double-click assumptions).
2. Goal detail performance and correctness for users with many linked habits.
3. Evidence-based routine support UX (data may silently disappear due response mismatch).
