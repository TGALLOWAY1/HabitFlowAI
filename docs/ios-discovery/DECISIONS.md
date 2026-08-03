# iOS Discovery — Decision Log

Durable corrections and confirmed interpretations. One entry per decision, newest first.
Entry format:

- **Date:** YYYY-MM-DD
- **Topic:** short label
- **Confirmed interpretation:** the accepted reading
- **Evidence:** exact paths/symbols/commands
- **Alternatives / contradictions:** other readings and why they were rejected, or what
  remains contradictory
- **Confidence:** High / Medium / Low

---

## 2026-08-03 — Goal creation is a 2-step modal, not a full-page flow

- **Date:** 2026-08-03
- **Topic:** Goal creation UX (doc self-contradiction resolved)
- **Confirmed interpretation:** Goal creation runs entirely inside
  `src/components/CreateGoalModal.tsx` as a two-step modal (`step` state `1 | 2` at line
  16: details → link habits). The UI architecture doc's §7 claim of a "full-page flow" and
  its §6 references to `CreateGoalPage` / `CreateGoalLinkHabits` components are wrong —
  no such components exist; the doc's own §3 screen inventory correctly labels both steps
  "Modal".
- **Evidence:** `src/components/CreateGoalModal.tsx:16,127-129,219-223`; mounted at
  `src/App.tsx:798-801`; grep for `CreateGoalPage`/`CreateGoalLinkHabits` returns nothing.
- **Alternatives / contradictions:** `docs/product/HABITFLOW_UI_ARCHITECTURE.md` §6/§7 vs
  §3 (internal contradiction — §3 is the accurate one).
- **Confidence:** High.

## 2026-08-03 — No screenshots exist in the repository

- **Date:** 2026-08-03
- **Topic:** Screenshot inventory for discovery
- **Confirmed interpretation:** The repository contains no product screenshots. The only
  image assets are app icons (`public/icon-*.png`, `apple-touch-icon.png`, `icon.svg`) and
  two uploaded routine images (`public/uploads/routine-images/`). No Markdown doc embeds an
  image. Visual/UI discovery must rely on code plus
  `docs/product/HABITFLOW_UI_ARCHITECTURE.md`.
- **Evidence:** `find` across the working tree (excluding `node_modules`, `.git`) for
  `*screenshot*` names and for `*.png|*.jpg|*.jpeg|*.webp`; `grep -r '!['` over `docs/`
  returned no image links. Run during Task 1 (2026-08-03).
- **Alternatives / contradictions:** The discovery brief assumed screenshots exist;
  they may live outside the repository (not accessible here).
- **Confidence:** High (for repository contents).

## 2026-08-03 — Legacy `wellbeingLogs` API is still live and written to by the frontend

- **Date:** 2026-08-03
- **Topic:** Wellbeing truth collection
- **Confirmed interpretation:** Despite `.claude/CLAUDE.md` stating `wellbeingEntries`
  "replaces legacy `wellbeingLogs`", the `wellbeingLogs` endpoints remain registered and the
  frontend still writes through them: `saveWellbeingLog` POSTs to `/wellbeingLogs` while a
  comment marks reads as coming from `wellbeingEntries`. The exact read/write topology
  (dual-write? server-side bridging?) is **unresolved** and assigned to Task 4.
- **Evidence:** Routes registered at `src/server/app.ts:190-197`; frontend write path
  `src/lib/persistenceClient.ts:865-867`; read-path comment `src/lib/persistenceClient.ts:328`;
  UI usage in `src/components/wellbeing/WellbeingCheckInModal.tsx:104`.
- **Alternatives / contradictions:** CLAUDE.md / `docs/ARCHITECTURE.md` describe
  `wellbeingEntries` as canonical. Both endpoints coexisting suggests migration-in-progress
  rather than completed replacement.
- **Confidence:** High that both paths are live; Low on the intended end-state until Task 4.
