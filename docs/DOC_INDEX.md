# Documentation Index

## Documentation Standards

HabitFlow docs follow one rule: **README = what the app is + how to run it; FEATURES = the
product spec; everything else = implementation detail.** Keep duplication out by putting each kind
of content in exactly one home.

| File | Owns | Does **not** contain |
|---|---|---|
| `README.md` (root) | Concise product overview, setup, scripts, tech stack, links | Long feature specs, roadmap, AI implementation detail |
| `docs/FEATURES.md` | Canonical feature inventory **with status** | Install instructions, deep architecture |
| `ROADMAP.md` (root) | Prioritized future work (near-term / later / backlog) | Descriptions of already-shipped features |
| `docs/ai-features.md` | Applied-AI design, data flow, contracts | User-facing feature copy (link to FEATURES instead) |
| `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md` | Technical structure & schema | Product marketing |

**Conventions:**
- **New feature →** add it to `docs/FEATURES.md` (mark `Beta`/`Partial` if not fully shipped) and,
  if user-facing, update `docs/product/HABITFLOW_UI_ARCHITECTURE.md` and the "How HabitFlow Works"
  modal (`src/components/InfoModal.tsx`) per `.claude/CLAUDE.md`.
- **Update status →** edit the Status summary table and the relevant item in `docs/FEATURES.md`.
  Use **Needs Verification** rather than guessing when a status is unconfirmed.
- **Ship a roadmap item →** remove it from `ROADMAP.md` and document it in `docs/FEATURES.md`.
- **Keep README concise** — link to `docs/FEATURES.md` / `ROADMAP.md` instead of duplicating lists.

## Start Here

- `README.md` — product overview, setup, scripts, tech stack (root).
- `ROADMAP.md` — prioritized upcoming work, near-term to backlog (root).
- `CHANGELOG.md` — core milestones over time (root).
- `tasks/todo.md` — active, prioritized task list (manual vs. agent).
- `docs/V1_PRODUCT_DIRECTION.md` — current v1 product direction (personal-use-first, practical).
- `docs/DOMAIN_CANON.md` — minimal invariants and canonical references.
- `docs/ARCHITECTURE.md` — system architecture, identity, dayKey policy, HabitEntries-only truth (post–M6).
- `docs/UI.md` — page inventory and navigation map.
- `docs/API.md` — backend route inventory and API contracts.
- `docs/DATA_MODEL.md` — implemented collections and ownership boundaries (post–M6).
- `docs/DEV_GUIDE.md` — setup, scripts, testing, and runbook.
- `docs/FEATURES.md` — canonical feature list with status, organized by domain (habits, routines, goals, journal, AI, etc.).
- `docs/ai-features.md` — applied-AI features: design, data flow, grounding, routes/contracts.
- `docs/VERIFICATION.md` — consistency and dashboard validation checklist.
- `docs/maintenance/verification.md` — test suite commands and smoke test checklist.
- `docs/semantics/daykey.md` — DayKey and timezone policy (America/New_York fallback).
- `docs/migrations/README.md` — migration scripts and safe-run instructions.

## Canonical References (Authoritative Sources)

- `docs/reference/V1/00_NORTHSTAR.md` — HabitFlow Canonical Vocabulary (v1).
- `docs/reference/iOS release V1/Feature_Prioritization.md` — HabitFlow iOS Feature Spec v1.
- `docs/reference/V2 (Current - iOS focus)/00_Northstar.md` — iOS-first northstar invariants.
- `docs/reference/V1/02_HABIT_ENTRY.md` — HabitEntry contract.
- `docs/reference/V1/11_TIME_DAYKEY.md` — DayKey/time invariants.

Identity and scoping map: `docs/audits/m5_identity_map.md`.

## System Model (Architecture Blueprint)

Comprehensive system model and consistency audit produced 2026-04-04:

- `docs/system-model/HABITFLOW_ENTITY_MODEL.md` — Exhaustive inventory of all 20+ entities, fields, types, and purposes.
- `docs/system-model/HABITFLOW_RELATIONSHIPS.md` — ERD-style relationship diagram with cardinalities and dual-link requirements.
- `docs/system-model/HABITFLOW_UX_PATHS.md` — Every UX path for create/edit/delete/complete across all views and modals.
- `docs/system-model/HABITFLOW_SYSTEM_RULES.md` — Design contract: 30 numbered invariant rules governing truth, completion, scheduling, linking, streaks, goals, and analytics.
- `docs/system-model/HABITFLOW_BUG_ANALYSIS.md` — Identified bugs, inconsistencies, design risks, and tech debt with file/line references.

## Performance

- `docs/audits/HABITFLOW_PERFORMANCE_ASSESSMENT.md` — Full-stack performance audit: findings (Sections 1-10), implementation status (Section 11), Phase 2 fix specs (Section 12), Phase 3 architecture roadmap (Section 13), verification checklist (Section 14), and full optimization roadmap summary (Section 15).
- `docs/audits/redundant-db-calls-audit.md` — Deep audit of redundant DB calls (34 issues across all pages) with fix priority phases (Phases 1–3 mostly complete).

## Historical / Archived

- `docs/archive/PSYCHOLOGICAL_SAFETY_V0.md` — ARCHIVED psychological-safety-first direction (preserved, not current v1 direction).
- `docs/archive/root/` — archived root-level implementation snapshots.
- `docs/reference/V0/` — historical PRDs and migration plans.
- `docs/audits/m6_legacy_removal_map.md` — M6 legacy removal map (DayLogs/manual goal logs removed; historical).
