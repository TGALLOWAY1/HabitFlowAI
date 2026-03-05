# Release Checklist — Private Beta

Use this checklist before cutting a private beta release. The **beta gate** is a curated subset of tests and lint that must be green.

## Beta gate (CI)

The GitHub Actions workflow **CI Beta** (`.github/workflows/ci-beta.yml`) runs on push/PR to `main`/`master` and executes:

1. **Build** — `npm run build` (TypeScript typecheck + Vite build)
2. **test:beta** — Curated test suite (see below)
3. **lint:beta** — Lint on `src/server`, `src/shared`, `src/domain` (tests excluded; warnings allowed, errors forbidden)

All three must pass for the gate to be green.

## test:beta — What’s included

| Category | Test file(s) |
|----------|----------------|
| Entries-only invariants | `entriesOnly.invariants.test.ts` |
| Goals entries-derived regression | `goals.entriesDerived.test.ts` |
| Routine completion guardrail | `routines.completion-guardrail.test.ts` |
| Identity / auth integration | `auth.integration.test.ts`, `auth.identity.test.ts`, `identity.test.ts` |
| No-legacy-import guard | `noDayLogImports.test.ts` |
| Progress overview core | `progress.overview.test.ts` |
| HabitEntry repository guardrails | `habitEntryRepository.guardrails.test.ts` |

Run locally: `npm run test:beta`

## lint:beta — What’s included

- **Scope:** `src/server/**/*.ts`, `src/shared/**/*.ts`, `src/domain/**/*.ts`
- **Excluded:** `**/__tests__/**`, `**/*.test.ts`
- **Rules:** Same as main config; override for this scope: unused vars with `_` prefix allowed, `no-explicit-any` downgraded to warning. Zero **errors** required; warnings allowed.

Run locally: `npm run lint:beta`

## Pre-release steps

1. Ensure CI Beta is green on the release branch.
2. Run `npm run test:beta` and `npm run lint:beta` locally if you changed server/shared/domain code.
3. Deploy backend (Render/Railway) and frontend (Vercel) per `docs/deploy/runbook_private_beta.md`.
4. Run smoke tests from the runbook (health, login, protected route, logout).

## Out of scope for beta gate

- Full test suite (other suites may fail; they are triaged as non-blockers for beta).
- Full lint on the whole repo (use `npm run lint` for that).
- UI/snapshot or legacy comparison scripts.
