# HabitFlow Entity Relationships

This document maps all relationships between entities in the HabitFlowAI system. It serves as the canonical reference for how entities connect, which fields carry foreign keys, and where dual-link consistency is required.

All entity types are defined in `src/models/persistenceTypes.ts`, with canonical server-side contracts in `src/server/domain/canonicalTypes.ts` and frontend re-exports in `src/types/index.ts`.

---

## Entity Relationship Diagram (ASCII)

```
┌──────────────────────────────────────────────────────────────────┐
│                    HABITFLOW ENTITY RELATIONSHIPS                │
└──────────────────────────────────────────────────────────────────┘

Category ◄──────────── Habit (categoryId)
Category ◄──────────── Goal (categoryId)
Category ◄──────────── Routine (categoryId)

Habit ──── logged by ────► HabitEntry (entry.habitId → habit.id)
Habit ──── linked to ────► Goal (habit.linkedGoalId → goal.id)  [DUAL]
Goal ──── links to ──────► Habit[] (goal.linkedHabitIds[])       [DUAL]
Habit ──── linked to ────► Routine (habit.linkedRoutineIds[])    [DUAL]
Routine ── links to ─────► Habit[] (routine.linkedHabitIds[])    [DUAL]

Habit (bundle parent) ──► BundleMembership ──► Habit (bundle child)
  parentHabitId                                  childHabitId

Routine ── has ──────────► RoutineVariant[] (embedded)
RoutineVariant ── has ───► RoutineStep[] (embedded)
RoutineStep ── links to ─► Habit (step.linkedHabitId)

Routine ── logged by ────► RoutineLog (log.routineId)
Routine ── generates ────► HabitPotentialEvidence (evidence.routineId)

Habit ──── has rule ─────► HabitHealthRule (rule.habitId)
HabitHealthRule ── eval ─► HealthMetricDaily → HabitEntry (auto-log)
HabitHealthRule ── eval ─► HealthMetricDaily → HealthSuggestion

Task ──── linked to ─────► Goal (task.linkedGoalId)

Identity ── has ─────────► Skill[] (skill.identityId)
Skill ──── links to ─────► Habit[] (skill.habitIds[])
```

---

## Detailed Relationship Tables

### Category Relationships

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Category | Habit | `habit.categoryId` | 1:N | Category owns many Habits | Required. Every habit belongs to exactly one category. |
| Category | Goal | `goal.categoryId` | 1:N | Category owns many Goals | Optional. Used for Skill Tree visualization grouping. |
| Category | Routine | `routine.categoryId` | 1:N | Category owns many Routines | Optional. Used to group routines and filter linked habits. |

### Habit to HabitEntry (Source of Truth)

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Habit | HabitEntry | `entry.habitId` | 1:N | Habit has many Entries | **Most critical relationship.** HabitEntry is the single source of truth. All derived views (day view, streaks, progress, goal progress) are computed from entries at read time. Entries use `dayKey` (YYYY-MM-DD) as the aggregation boundary. Soft-deleted entries have a `deletedAt` timestamp. |

### Habit to Goal (DUAL LINK)

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Habit | Goal | `habit.linkedGoalId` | N:1 | Habit points to one Goal | Optional. A habit can contribute to at most one goal via this field. |
| Goal | Habit | `goal.linkedHabitIds[]` | 1:N | Goal references many Habits | Required array (may be empty). Lists all habits that contribute to this goal. |
| Goal | Habit/Option | `goal.linkedTargets[]` | 1:N | Goal references Habits or Choice options | Optional. Granular linking for Choice Habit V2. Each target is either `{ type: 'habit', habitId }` or `{ type: 'option', parentHabitId, bundleOptionId, aggregation }`. |

**Both sides store the link and must stay in sync.** See [Dual-Link Consistency Requirements](#dual-link-consistency-requirements).

### Habit to Routine (DUAL LINK)

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Habit | Routine | `habit.linkedRoutineIds[]` | N:N | Habit references many Routines | Optional array. Habits know which routines they participate in. |
| Routine | Habit | `routine.linkedHabitIds[]` | N:N | Routine references many Habits | Required array. The habits this routine is "in service of." |
| RoutineVariant | Habit | `variant.linkedHabitIds[]` | N:N | Variant references many Habits | Computed from steps on save. Each variant tracks its own linked habits. |
| RoutineStep | Habit | `step.linkedHabitId` | N:1 | Step links to one Habit | Optional. Reaching this step generates potential evidence for the habit. |

**Both sides store the link and must stay in sync.** See [Dual-Link Consistency Requirements](#dual-link-consistency-requirements).

### Bundle Relationships

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Habit (parent) | BundleMembership | `membership.parentHabitId` | 1:N | Parent has many memberships | Parent habit has `type: 'bundle'` and `bundleType: 'checklist' \| 'choice'`. |
| Habit (child) | BundleMembership | `membership.childHabitId` | 1:N | Child appears in many memberships | A child can belong to different parents over time (temporal). |
| Habit (parent) | Habit (child) | `habit.subHabitIds[]` | 1:N | Legacy static child list | **Legacy.** Pre-migration fallback. Superseded by BundleMembership records. |
| Habit (child) | Habit (parent) | `habit.bundleParentId` | N:1 | Legacy static parent pointer | **Legacy.** Pre-migration fallback. Superseded by BundleMembership records. |

### Routine Internals (Embedded)

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Routine | RoutineVariant | `routine.variants[]` | 1:N | Routine embeds Variants | Embedded array. Post-migration routines have at least one variant. |
| RoutineVariant | RoutineStep | `variant.steps[]` | 1:N | Variant embeds Steps | Embedded array. Each variant owns its own ordered step list. |
| RoutineStep | Habit | `step.linkedHabitId` | N:1 | Step links to one Habit | Optional. When present, completing the step generates HabitPotentialEvidence. |

### Routine Logging

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Routine | RoutineLog | `log.routineId` | 1:N | Routine has many Logs | Composite key: `routineId-date`. One log per routine per day. |
| RoutineVariant | RoutineLog | `log.variantId` | 1:N | Variant referenced in Log | Optional. Undefined for legacy logs pre-variant-migration. |

### Evidence

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Routine | HabitPotentialEvidence | `evidence.routineId` | 1:N | Routine generates Evidence | Evidence is "potential" -- requires user confirmation to become a HabitEntry. |
| Habit | HabitPotentialEvidence | `evidence.habitId` | 1:N | Habit receives Evidence | The habit that might have been completed. |
| RoutineStep | HabitPotentialEvidence | `evidence.stepId` | 1:N | Step is Evidence source | The specific step that generated the evidence signal. |

### Health Integration (Apple Health)

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Habit | HabitHealthRule | `rule.habitId` | 1:1 | Habit has one Rule (V1) | One rule per habit in V1. Unique key: `(userId, habitId)`. |
| HabitHealthRule | HabitEntry | `entry.sourceRuleId` | 1:N | Rule auto-logs Entries | When `behavior: 'auto_log'` and condition is met, a HabitEntry is created with `source: 'apple_health'`. |
| HabitHealthRule | HealthSuggestion | `suggestion.ruleId` | 1:N | Rule creates Suggestions | When `behavior: 'suggest'` and condition is met, a pending suggestion is created for user confirmation. |
| HealthMetricDaily | HabitHealthRule | (evaluated at runtime) | N:N | Metrics evaluated against Rules | HealthMetricDaily is the input data source. Rules define conditions (metricType, operator, thresholdValue) that are evaluated against daily metric values. |

### Task

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Task | Goal | `task.linkedGoalId` | N:1 | Task links to one Goal | Optional. A task can optionally contribute to a goal. |

### Gamification (Identity / Skill Tree)

| From | To | FK Field | Cardinality | Direction | Notes |
|------|----|----------|-------------|-----------|-------|
| Identity | Skill | `skill.identityId` | 1:N | Identity owns many Skills | Required. Every skill belongs to one identity. |
| Skill | Habit | `skill.habitIds[]` | N:N | Skill links to many Habits | Required array. The habits whose entries contribute XP to this skill. |

### Standalone Entities (No FK Relationships)

| Entity | Notes |
|--------|-------|
| WellbeingEntry | Standalone. Keyed by `(userId, dayKey, timeOfDay, metricKey)`. No FK to other entities. |
| DailyWellbeing | Legacy wellbeing format. Standalone, keyed by date. |
| JournalEntry | Standalone. References `userId` and `templateId` (string key, not a FK to another collection). |
| HealthMetricDaily | Standalone imported data. Keyed by `(userId, dayKey, source)`. Evaluated against rules at runtime. |

---

## Dual-Link Consistency Requirements

Relationships where **both sides store the link** and must stay in sync. Updating one side without the other creates data inconsistency.

### 1. Habit.linkedGoalId <-> Goal.linkedHabitIds[]

- **When linking:** Must update both `habit.linkedGoalId = goalId` AND add `habitId` to `goal.linkedHabitIds[]`.
- **When unlinking:** Must clear `habit.linkedGoalId = undefined` AND remove `habitId` from `goal.linkedHabitIds[]`.
- **Risk:** If one side is updated without the other, goal progress calculations will disagree with habit detail views. A habit may show it contributes to a goal while the goal does not count that habit's entries (or vice versa).

### 2. Habit.linkedRoutineIds[] <-> Routine.linkedHabitIds[]

- **When linking:** Must add `routineId` to `habit.linkedRoutineIds[]` AND add `habitId` to `routine.linkedHabitIds[]`.
- **When unlinking:** Must remove from both sides.
- **RoutineVariant.linkedHabitIds[]** is computed from steps on save (not manually maintained). When a routine is saved, each variant's `linkedHabitIds` is recomputed from `variant.steps[].linkedHabitId`.
- **Risk:** If one side is updated without the other, routine completion may not offer to mark the correct habits as complete.

### 3. Habit.subHabitIds[] <-> Habit.bundleParentId (Legacy)

- **Status:** Superseded by `BundleMembership` records.
- **When linking (legacy):** Must add `childId` to `parent.subHabitIds[]` AND set `child.bundleParentId = parentId`.
- **When unlinking (legacy):** Must remove from both sides.
- **Migration path:** New code should use `BundleMembership` records exclusively. Legacy fields remain for backward compatibility with pre-migration data.

---

## Temporal Relationships

Some relationships are time-dependent and change meaning based on DayKey context.

### BundleMembership Temporal Window

- **`activeFromDayKey`** (inclusive): The first day the child belongs to the parent bundle.
- **`activeToDayKey`** (inclusive, nullable): The last day of membership. `null` means currently active (no end date).
- **`daysOfWeek`** (nullable): Within the active window, the child is only scheduled on these days (0=Sun...6=Sat). `null` means every day.
- **`graduatedAt`** (nullable): ISO timestamp marking behavioral graduation. The habit became automatic and no longer needs active tracking within the bundle.
- **`archivedAt`** (nullable): UX hint to hide from active lists. Does not affect temporal membership logic.

### HabitEntry.dayKey as Aggregation Boundary

- All time-based queries group by `dayKey` (YYYY-MM-DD).
- `dayKey` is computed in a timezone (not UTC). Server uses the client's IANA timezone if valid, falls back to America/New_York.
- `dayKey` is the primary field for day-based queries, streak calculations, and goal progress aggregation.

---

## Derived Relationships (Not Stored)

These relationships exist only at computation time. They are calculated from stored data (primarily HabitEntry) and never persisted.

| From | Derived Output | Computed By | Notes |
|------|---------------|-------------|-------|
| Habit | Streak metrics (current streak, best streak, at-risk) | `streakService` | Computed from HabitEntry records. Weekly habits use weekly-window evaluation. |
| Habit | Day completion status | `dayViewService` | Computed from HabitEntry for a given dayKey. Boolean and numeric goal evaluation. |
| Goal | Progress (currentValue, percent, lastSevenDays, lastThirtyDays) | `goalProgressUtilsV2` | Computed from HabitEntry using goal's aggregationMode/countMode. |
| Habit | Momentum state (Strong, Steady, Building, Gentle Restart, Ready) | `momentumService` | Computed from derived DayLog-shaped data. Global and per-category states. |
| Habit | Analytics metrics | `analyticsService` | Computed from HabitEntry for charts, trends, and reporting. |
| Habit | Schedule (is habit scheduled today?) | `scheduleEngine` | Computed from `habit.assignedDays`, `habit.timesPerWeek`, and current dayKey. |
| HabitHealthRule | Auto-logged HabitEntry or HealthSuggestion | health evaluation pipeline | Computed when HealthMetricDaily is imported and rules are evaluated. |
| BundleMembership | Active children for a day | membership query logic | Filtered by `activeFromDayKey <= dayKey <= activeToDayKey` and `daysOfWeek` match. |
