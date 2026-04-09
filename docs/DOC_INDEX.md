# Documentation Index

## Start Here

- `docs/V1_PRODUCT_DIRECTION.md` — current v1 product direction (personal-use-first, practical).
- `docs/DOMAIN_CANON.md` — minimal invariants and canonical references.
- `docs/ARCHITECTURE.md` — system architecture, identity, dayKey policy, HabitEntries-only truth (post–M6).
- `docs/UI.md` — page inventory and navigation map.
- `docs/API.md` — backend route inventory and API contracts.
- `docs/DATA_MODEL.md` — implemented collections and ownership boundaries (post–M6).
- `docs/DEV_GUIDE.md` — setup, scripts, testing, and runbook.
- `docs/FEATURES.md` — canonical feature list organized by domain (habits, routines, goals, journal, AI, etc.).
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

- `HABITFLOW_PERFORMANCE_ASSESSMENT.md` — Full-stack performance audit: findings (Sections 1-10), implementation status (Section 11), Phase 2 fix specs (Section 12), Phase 3 architecture roadmap (Section 13), verification checklist (Section 14), and full optimization roadmap summary (Section 15).
- `tasks/todo.md` — Deep audit of redundant DB calls (34 issues across all pages) with fix priority phases.

## Historical / Archived

- `docs/archive/PSYCHOLOGICAL_SAFETY_V0.md` — ARCHIVED psychological-safety-first direction (preserved, not current v1 direction).
- `docs/archive/root/` — archived root-level implementation snapshots.
- `docs/reference/V0/` — historical PRDs and migration plans.
- `docs/audits/m6_legacy_removal_map.md` — M6 legacy removal map (DayLogs/manual goal logs removed; historical).
