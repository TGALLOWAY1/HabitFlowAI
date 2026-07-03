# M6 Final Verification Pass

**Goal:** Final stop/go gate for M6 legacy removal; lightweight guardrails for the future.

## Verification Script

A single CI-like script runs typecheck, lint, and the full test suite:

```bash
npm run verify
# or
./scripts/verify.sh
```

**Steps (in order):**

1. **Typecheck** — `npx tsc -b`
2. **Lint** — `npm run lint` (eslint)
3. **Tests** — `npm run test:run` (vitest run)

If any step fails, the script exits with a non-zero code.

## Invariant Tests Added

### 1. HabitEntries required for completion (existing)

- **`src/server/routes/__tests__/entriesOnly.invariants.test.ts`** — Ensures day view, day summary, progress overview, and goal progress derive only from HabitEntries; no entries ⇒ incomplete, create entry ⇒ completion agrees across endpoints, delete ⇒ recomputes to incomplete.
- **`src/server/routes/__tests__/routines.completion-guardrail.test.ts`** — Routine completion does not auto-log habits; day view and progress unchanged when no habits are logged.

### 2. No DayLog / manual-log imports (grep-based)

- **`src/server/__tests__/noDayLogImports.test.ts`** — Two tests:
  - No server source file imports `dayLogRepository` or `dayLogs` route.
  - No server source file imports `goalManualLogRepository` or manual-log routes.

Prevents accidental re-introduction of DayLog or goalManualLog modules.

### 3. Debug routes not in production

- **`src/server/__tests__/debug.routes.test.ts`** — With `NODE_ENV=production`, `GET /api/debug/whoami` and `POST /api/dev/*` return 404 (not registered). With `NODE_ENV !== 'production'`, whoami returns 200 and identity/env info.

## Verification Results (M6 cut)

| Step       | Result |
|-----------|--------|
| Typecheck | ⚠️ Pre-existing TS errors in codebase (unrelated to M6) |
| Lint      | ✅ Pass |
| Test suite| ⚠️ Pre-existing failures (see below) |

The verify script runs all three steps; once typecheck and test failures are addressed, `npm run verify` serves as the single gate.

**Invariant / guardrail tests:** All pass when run in isolation:

- `noDayLogImports.test.ts` — 2 tests pass
- `entriesOnly.invariants.test.ts` — 5 tests pass
- `routines.completion-guardrail.test.ts` — 1 test pass
- `debug.routes.test.ts` — 4 tests pass

**Full suite:** As of this pass, 14 test files fail (72 tests total failed) due to pre-existing issues (e.g. `progress.overview.test.ts` identity not set, `routines.submit.test.ts` / `routines.validation.test.ts` expectations or setup). These are not introduced by M6; fixing them is out of scope for this verification. Once addressed, `npm run verify` should pass end-to-end.

## How to Re-run

```bash
# Full gate (typecheck + lint + all tests)
npm run verify

# Invariant tests only (fast smoke)
npm run test:run -- src/server/__tests__/noDayLogImports.test.ts src/server/routes/__tests__/entriesOnly.invariants.test.ts src/server/__tests__/debug.routes.test.ts src/server/routes/__tests__/routines.completion-guardrail.test.ts
```

## References

- `docs/maintenance/verification.md` — Test suite and smoke checklist
- `docs/audits/m6_dead_code_removed.md` — M6 dead code and legacy removal summary
- `docs/audits/m6_legacy_removal_map.md` — Legacy removal map (historical)
