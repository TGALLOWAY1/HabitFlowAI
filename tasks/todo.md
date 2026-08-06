# Goal Lifecycle Status (Active / Scheduled / Backlog)

Branch: `claude/goal-status-differentiation-6vzdy3`

- [ ] 1. Model + create/update validation (persistenceTypes, goals.ts, goalTracks.ts, goals.status.test.ts) (commit 1)
- [ ] 2. Lazy auto-activation on read (`promoteDueScheduledGoals` + persistenceClient timeZone) (commit 2)
- [ ] 3. `buildGoalStacks` three-way grouping + tests (commit 3)
- [ ] 4. GoalsPage sub-sections + GoalGridCard status badges (commit 4)
- [ ] 5. Create/Edit modal status controls (commit 5)
- [ ] 6. Schedule calendar "Starts" event + tests (commit 6)
- [ ] 7. Demo seed: scheduled + backlog examples (commit 7)
- [ ] 8. Docs (FEATURES, API, DATA_MODEL, UI architecture) + InfoModal (commit 8)
- [ ] Verify: npm run build, test:run, lint:beta; push; open PR

Design decisions:
- `Goal.status?: 'active' | 'scheduled' | 'backlog'` — absent/null = active (no migration). `startDate?: string | null` dayKey, only when scheduled; cleared server-side when status leaves scheduled.
- Auto-activation: server-side lazy promotion in GET /api/goals + /api/goals-with-progress (request timezone dayKey), persisted.
- Tracked goals: status/startDate rejected (trackStatus governs); addGoalToTrack clears both.
- Auto-completion untouched — entries are truth; backlog goals can still complete.
