# M3 Routines semantics

**Rule:** **Routines never imply completion; only HabitEntries do.**

- Completing a routine (RoutineLog, “routine done”) does **not** by itself create HabitEntries or change streaks.
- Day view, progress overview, and goals derive completion **only** from HabitEntries (M1 entries-only invariant).
- HabitPotentialEvidence (step-reached) is stored separately and is **never** used as completion for progress/streaks/day view; it is for UI hints and for the user to confirm into HabitEntries (e.g. via the completion modal).
- The only ways to create HabitEntries from a routine are:
  1. User confirms selected habits in the “Completed Habits” modal → `POST /api/entries/batch`.
  2. Legacy path: “Complete + Log Habits” → `POST /api/routines/:id/submit` with `habitIdsToComplete` (optional, still supported).
- If a routine is submitted with no habits selected (empty `habitIdsToComplete` or user cancels the modal), only RoutineLog is written; no HabitEntries are created and day view/progress are unchanged.

Regression coverage: `src/server/routes/__tests__/routines.completion-guardrail.test.ts`.
