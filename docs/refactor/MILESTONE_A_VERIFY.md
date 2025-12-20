# Milestone A Verification Suite

> **Purpose**: Enforce hardened invariants that HabitEntry is the only historical truth and all reads flow through truthQuery.

## What This Suite Guarantees

### Core Invariants

1. **truthQuery is the single read source**
   - HabitEntry takes precedence over DayLog on conflicts
   - Deterministic sorting (dayKey asc, timestampUtc asc)
   - Conflict flagging when both sources exist with differing values

2. **Goal progress derives from GoalLinks + EntryViews only**
   - Count mode: counts non-deleted EntryViews
   - Sum mode: sums EntryView values (null treated as 0)
   - Deleted entries contribute nothing
   - Boolean habits excluded from cumulative numeric goals

3. **Day View completion derives from EntryViews only**
   - Daily: exists EntryView for (habitId, dayKey) and not deleted
   - Weekly binary: >= 1 entry in week window
   - Weekly frequency: count distinct dayKeys >= target
   - Weekly quantity: sum(entry.value) >= target
   - Bundle parents: derived from children only (never require entries)

4. **Legacy DayLogs are never treated as truth outside truthQuery**
   - All DayLog reads must flow through truthQuery merge logic
   - No direct DayLog reads in goal progress or day view computation

## How to Run

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# truthQuery tests
npm test -- src/server/services/truthQuery.test.ts

# dayViewService tests
npm test -- src/server/services/dayViewService.test.ts
npm test -- src/server/services/dayViewService.unit.test.ts

# goal progress tests
npm test -- src/server/utils/goalProgressUtilsV2.test.ts

# Integration tests
npm test -- src/server/routes/__tests__/milestoneA.integration.test.ts
```

### Run in Watch Mode

```bash
npm test -- --watch
```

## Test Structure

### Unit Tests

- **`truthQuery.test.ts`**: Tests merge preference, sorting, conflict detection
- **`dayViewService.test.ts`**: Tests full dayView computation with mocked data
- **`dayViewService.unit.test.ts`**: Tests pure derivation logic (daily, weekly, bundle)
- **`goalProgressUtilsV2.test.ts`**: Tests goal progress aggregation semantics

### Integration Tests

- **`milestoneA.integration.test.ts`**: Tests endpoints (`/api/entries`, `/api/dayView`, `/api/goalProgress`) with mocked repositories

## What It Intentionally Does NOT Cover Yet

- **Write paths**: Tests focus on read correctness, not write mutations
- **Full DB integration**: Uses mocked repositories for speed and isolation
- **Frontend components**: Backend verification only
- **Performance/load**: Focuses on correctness, not scale
- **Edge cases in legacy migration**: Basic conflict detection only

## Adding New Tests

When adding new features or refactoring:

1. **If changing truthQuery merge logic**: Update `truthQuery.test.ts`
2. **If changing goal progress aggregation**: Update `goalProgressUtilsV2.test.ts`
3. **If changing dayView derivation**: Update `dayViewService.test.ts` and `dayViewService.unit.test.ts`
4. **If adding new endpoints**: Add integration tests in `milestoneA.integration.test.ts`

## Continuous Integration

These tests should run in CI/CD pipelines to prevent regressions. If tests fail:

1. Check if the failure is expected (e.g., intentional behavior change)
2. If unexpected, investigate the invariant violation
3. Update tests if behavior change is intentional and documented

## Debugging Failed Tests

1. Run specific test file to isolate the failure
2. Check test output for detailed error messages
3. Verify mocked data matches expected structure
4. Ensure timezone handling is consistent (tests use UTC)

