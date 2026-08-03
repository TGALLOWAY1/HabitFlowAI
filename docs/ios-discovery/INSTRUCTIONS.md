# iOS Discovery — Standing Instructions

Reread this file at the start of every discovery task.

## Purpose

Produce an evidence-based description of the product **as actually implemented** in this
repository, to serve as the foundation for a native iOS build plan. This is discovery, not
design: document what exists, not what should exist.

## Principles

1. **Document the implemented product**, not an aspirational redesign.
2. **Running code and active production paths are the strongest source of truth.** Route
   registrations in `src/server/app.ts`, live frontend call sites, and repository/service
   code outrank every document.
3. **Tests, schemas, documentation, screenshots, and comments are supporting evidence** —
   useful, but each must be checked against the code before being trusted.
4. **Cite exact repository paths** (and key symbols, e.g. `computeGoalProgressV2`) for every
   substantive claim.
5. **Label uncertainty and contradictions explicitly.** Never present an unverified claim
   as fact.
6. **Classify behavior** as one of: *Implemented*, *Partially implemented*,
   *Documented-only*, *Likely unused / legacy*, or *Suspected bug*.
7. **Do not modify production behavior.** No refactors, no bug fixes, no iOS app code
   during discovery. Suspected bugs are recorded, not fixed.
8. **Stay bounded.** Each task produces only its stated deliverable. Discoveries belonging
   to a later task go into that task's Notes in `TASKS.md`, not into the current document.
9. **Update, don't duplicate.** Extend existing discovery documents rather than creating
   overlapping ones.
10. **Record durable corrections or confirmed interpretations in `DECISIONS.md`** (with
    evidence and confidence). Record high-value source files in `SOURCES.md`.
11. **Verify before reporting.** Every completion claim must be backed by files, commands,
    tests, or other tool results from the current work — reread the output document and
    check the completion criteria before marking anything complete.
12. **Subagents are fine for independent investigations**, but reconcile their findings
    against the repository before accepting them.
13. **Pause only for**: destructive actions, a genuine scope change, or information that
    cannot be determined from the repository. Everything else: proceed.

## Repository ground rules (from `.claude/CLAUDE.md`)

- Work happens on the designated discovery branch; commit per subtask with clear messages.
- Discovery writes only under `docs/ios-discovery/` — it never touches `src/`, other docs,
  or configuration.
- `habitEntries` is the canonical truth collection; derived views are computed at read
  time. Keep this invariant in mind when assessing claims about storage.
