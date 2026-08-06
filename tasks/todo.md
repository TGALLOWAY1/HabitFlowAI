# Goal Lifecycle Status (Active / Scheduled / Backlog)

Branch: `claude/goal-status-differentiation-6vzdy3`

- [x] 1. Model + create/update validation + lazy auto-activation (persistenceTypes, goals.ts, goalTracks.ts) (commit 1)
- [x] 2. Tests (goals.status.test.ts, added to test:beta) + persistenceClient timeZone (commit 2)
- [x] 3. `buildGoalStacks` three-way grouping + tests (commit 3)
- [x] 4. GoalsPage sub-sections + GoalGridCard status badges (commit 4)
- [x] 5. Create/Edit modal status controls (commit 5)
- [x] 6. Schedule calendar "Starts" event + tests (commit 6)
- [x] 7. Demo seed: scheduled + backlog examples (commit 7)
- [x] 8. Docs (FEATURES, API, DATA_MODEL, UI architecture) + InfoModal (commit 8)
- [x] Verify: npm run build ✓, test:run (601 passed; mongo suites can't run in sandbox — network-blocked binary download; CI covers them via test:beta), lint:beta ✓ (0 errors); push; open PR

Design decisions:
- `Goal.status?: 'active' | 'scheduled' | 'backlog'` — absent/null = active (no migration). `startDate?: string | null` dayKey, only when scheduled; cleared server-side when status leaves scheduled.
- Auto-activation: server-side lazy promotion in GET /api/goals + /api/goals-with-progress (request timezone dayKey), persisted.
- Tracked goals: status/startDate rejected (trackStatus governs); addGoalToTrack clears both.
- Auto-completion untouched — entries are truth; backlog goals can still complete.
