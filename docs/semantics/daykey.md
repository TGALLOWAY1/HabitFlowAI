# DayKey semantics

## Rule

- **DayKey** is the canonical calendar-day identifier: `YYYY-MM-DD` (e.g. `2025-01-15`).
- It is computed in a **timezone**: the same UTC instant can yield different dayKeys in different zones (e.g. near midnight UTC).
- **Single source of truth (server):** `src/server/utils/dayKey.ts`.
  - All HabitEntry write endpoints and date-range read endpoints use this utility so day boundaries are consistent.

## Timezone handling

- If the client sends a valid **timezone** (IANA, e.g. `America/Los_Angeles`, `UTC`), the server uses it for dayKey derivation.
- If the client **omits** the timezone or sends an **invalid** value, the server uses **America/New_York** (no UTC fallback for day boundaries).

## Where it’s used

- **Writes:** POST/PATCH /api/entries (create/update), PUT /api/entries (upsert), routine submit. Normalization lives in `src/server/utils/dayKeyNormalization.ts` and calls the canonical `resolveTimeZone` / `formatDayKeyFromDate` via `src/server/utils/dayKey.ts`.
- **Reads:** GET /api/entries, GET /api/dayView, GET /api/daySummary, GET /api/progress/overview, GET /api/dashboard/streaks. Default timezone for “today” and date ranges is America/New_York when not provided.

## References

- Domain format/validation: `src/domain/time/dayKey.ts`.
- Server canonical default and helpers: `src/server/utils/dayKey.ts` (`DEFAULT_DAYKEY_TIMEZONE`, `resolveTimeZone`, `getDayKeyForDate`, `getNowDayKey`, `getDayKeyForTimestamp`).
