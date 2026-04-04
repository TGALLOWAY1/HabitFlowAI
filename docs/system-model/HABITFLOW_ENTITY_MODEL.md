# HabitFlow Entity Model

> Exhaustive inventory of all core entities in the HabitFlowAI system.
> Last updated: 2026-04-04

---

## Entity Classification

### Truth Stores (Canonical Data)
| Entity | Collection | Role |
|--------|-----------|------|
| **Habit** | `habits` | Trackable unit definition |
| **HabitEntry** | `habitEntries` | **Single source of truth** for completions |
| **Goal** | `goals` | User-defined goals linked to habits |
| **Routine** | `routines` | Structured workflows with steps and variants |
| **RoutineLog** | `routineLogs` | Record of routine executions |
| **JournalEntry** | `journalEntries` | User journal entries |
| **WellbeingEntry** | `wellbeingEntries` | Canonical wellbeing metric observations |
| **Task** | `tasks` | User tasks (inbox/today) |

### Relationship Entities
| Entity | Collection | Role |
|--------|-----------|------|
| **BundleMembership** | `bundleMemberships` | Temporal parent-child bundle relationships |
| **HabitPotentialEvidence** | `habitPotentialEvidence` | Routine-generated habit signals |

### Configuration Entities
| Entity | Collection | Role |
|--------|-----------|------|
| **Category** | `categories` | Grouping for habits, goals, routines |
| **DashboardPrefs** | `dashboardPrefs` | User dashboard preferences |
| **HabitHealthRule** | `habitHealthRules` | Maps habits to health data conditions |

### External Data
| Entity | Collection | Role |
|--------|-----------|------|
| **HealthMetricDaily** | `healthMetricsDaily` | Imported Apple Health data |
| **HealthSuggestion** | `healthSuggestions` | Pending suggestions from health rules |

### Deprecated / Legacy
| Entity | Collection | Role |
|--------|-----------|------|
| **DayLog** | `logs` | DEPRECATED cache derived from HabitEntry |
| **DailyWellbeing** | `wellbeingLogs` | Legacy wellbeing format |

### Gamification (Future)
| Entity | Collection | Role |
|--------|-----------|------|
| **Identity** | `identities` | High-level identity areas |
| **Skill** | `skills` | Learnable capabilities within identities |

### Derived (Not Stored)
| Concept | Computed By | Source |
|---------|------------|--------|
| GoalProgress | `goalProgressUtilsV2.ts` | HabitEntry via truthQuery |
| Streak Metrics | `streakService.ts` | HabitEntry |
| Day View Status | `dayViewService.ts` | HabitEntry via truthQuery |
| Momentum | `momentumService.ts` | HabitEntry (via DayLog-shaped adapter) |
| Analytics | `analyticsService.ts` | HabitEntry |

---

## Entity Details

---

### Habit

**Purpose:** Defines a trackable unit (daily/weekly habit, bundle, or scheduled activity).

**Source:** `src/models/persistenceTypes.ts:83` | **Collection:** `habits`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier (UUID) |
| `categoryId` | string | Yes | FK → Category.id |
| `name` | string | Yes | Display name |
| `description` | string | No | Optional description (not used in UI) |
| `goal` | HabitGoal | Yes | Embedded goal config (see below) |
| `linkedGoalId` | string | No | FK → Goal.id (dual link) |
| `linkedRoutineIds` | string[] | No | FKs → Routine.id[] (dual link) |
| `archived` | boolean | Yes | Whether hidden from active tracking |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `order` | number | No | Display order (lower = first) |
| `type` | `'boolean'\|'number'\|'time'\|'bundle'` | No | Habit type (legacy compat) |
| `subHabitIds` | string[] | No | Legacy: IDs of bundle children |
| `bundleParentId` | string\|null | No | Legacy: parent bundle ID |
| `assignedDays` | number[] | No | Scheduled days (0=Sun..6=Sat) |
| `scheduledTime` | string | No | Preferred time (HH:mm) |
| `durationMinutes` | number | No | Estimated duration |
| `nonNegotiable` | boolean | No | Priority ring indicator |
| `nonNegotiableDays` | number[] | No | Specific non-negotiable days |
| `deadline` | string | No | Deadline time (HH:mm) |
| `freezeCount` | number | No | Freeze inventory (max 3) |
| `timesPerWeek` | number | No | Weekly target count |
| `requiredDaysPerWeek` | number | No | Required completions per week |
| `bundleType` | `'checklist'\|'choice'` | No | Bundle mode |
| `bundleOptions` | Array | No | **DEPRECATED** Choice options (use subHabitIds) |
| `checklistSuccessRule` | object | No | Checklist success criteria |
| `streakType` | `'success'\|'full'\|'any'` | No | Checklist streak override |
| `pinned` | boolean | No | Pinned in Today view |
| `timeEstimate` | number | No | Time estimate in minutes |
| `pace` | string\|null | No | **NOT STORED** — computed completion estimate |

**Embedded: HabitGoal**

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `type` | `'boolean'\|'number'` | Yes | Goal type |
| `target` | number | No | Target value (for number type) |
| `unit` | string | No | Unit label (e.g., 'glasses') |
| `frequency` | `'daily'\|'total'` | Yes | Tracking frequency |

**Embedded: ChecklistSuccessRule**

| Field | Type | Purpose |
|-------|------|---------|
| `type` | `'any'\|'threshold'\|'percent'\|'full'` | Rule type |
| `threshold` | number | Min items (for threshold) |
| `percent` | number | Min percent (for percent) |

**Created:** AddHabitModal, HabitCreationInlineModal (simplified)
**Edited:** AddHabitModal (edit mode), CategoryPickerModal, BundlePickerModal
**Deleted:** Soft delete via `archived: true`
**UI:** Tracker Grid, Day View, Schedule View, Goal Detail, Analytics
**Related to:** Category, HabitEntry, Goal, Routine, BundleMembership

---

### HabitEntry

**Purpose:** Single source of truth for all habit completions. Every completion, logging, or tracking event creates one entry.

**Source:** `src/models/persistenceTypes.ts:1303` | **Collection:** `habitEntries`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier (UUID) |
| `habitId` | string | Yes | FK → Habit.id |
| `timestamp` | string (ISO) | Yes | When the entry occurred |
| `value` | number | No | Value (1 for boolean, amount for numeric, null for choice parents) |
| `source` | `'manual'\|'routine'\|'quick'\|'import'\|'apple_health'\|'test'` | Yes | Entry source |
| `routineId` | string | No | FK → Routine.id (if source=routine) |
| `variantId` | string | No | FK → RoutineVariant.id |
| `dayKey` | string | Yes | **Canonical** aggregation day (YYYY-MM-DD) |
| `date` | string | No | **DEPRECATED** — legacy alias for dayKey |
| `dateKey` | string | No | **DEPRECATED** — legacy alias for dayKey |
| `note` | string | No | Optional note (also used for freeze markers: "freeze:auto") |
| `deletedAt` | string (ISO) | No | Soft delete timestamp |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |
| `bundleOptionId` | string | No | **DEPRECATED** — use choiceChildHabitId |
| `choiceChildHabitId` | string | No | Child habit ID for Choice Bundle V2 |
| `bundleOptionLabel` | string | No | Snapshot of option label |
| `unitSnapshot` | string | No | Snapshot of unit at entry time |
| `optionKey` | string | No | Option key for Choice Bundles |
| `sourceRuleId` | string | No | Health rule that created entry |
| `importedMetricValue` | number | No | Health metric value that triggered auto-log |
| `importedMetricType` | HealthMetricType | No | Health metric type |

**Created:** TrackerGrid toggle, DayView toggle, RoutineRunner finish, healthAutoLogService, HabitHistoryModal
**Edited:** HabitHistoryModal
**Deleted:** Soft delete via `deletedAt` timestamp
**UI:** Drives all completion displays (Tracker, Day View, Progress, Analytics)
**Related to:** Habit (habitId FK)

---

### Goal

**Purpose:** User-defined goal that tracks progress through linked habit entries.

**Source:** `src/models/persistenceTypes.ts:965` | **Collection:** `goals`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `categoryId` | string | No | FK → Category.id |
| `title` | string | Yes | Display title |
| `type` | `'cumulative'\|'onetime'` | Yes | Goal type |
| `targetValue` | number | No | Target to achieve |
| `unit` | string | No | Unit label |
| `linkedHabitIds` | string[] | Yes | FKs → Habit.id[] (dual link) |
| `aggregationMode` | `'count'\|'sum'` | No | How to aggregate progress |
| `countMode` | `'distinctDays'\|'entries'` | No | How to count (for count mode) |
| `linkedTargets` | Array | No | Granular Choice Habit V2 linking |
| `deadline` | string | No | Deadline date (YYYY-MM-DD) |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `completedAt` | string\|null | No | Completion timestamp |
| `notes` | string | No | Free-text notes |
| `badgeImageUrl` | string | No | Badge/image URL |
| `sortOrder` | number | No | Display order within category |

**Created:** CreateGoalModal (2-step wizard)
**Edited:** EditGoalModal
**Deleted:** DeleteGoalConfirmModal (likely hard delete or completedAt-based archival)
**UI:** GoalsPage, GoalDetailPage, GoalCompletedPage, GoalScheduleView, WinArchivePage, Dashboard
**Related to:** Category, Habit (dual link), Task (task.linkedGoalId)

---

### Routine

**Purpose:** Structured workflow with steps, variants, and linked habits. "Doing the work" is separate from "Tracking the outcome."

**Source:** `src/models/persistenceTypes.ts:496` | **Collection:** `routines`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `userId` | string | Yes | Owner user ID |
| `title` | string | Yes | Display title |
| `categoryId` | string | No | FK → Category.id |
| `linkedHabitIds` | string[] | Yes | FKs → Habit.id[] |
| `steps` | RoutineStep[] | Yes | Root-level steps (pre-variant migration) |
| `icon` | string | No | Lucide icon key or emoji |
| `color` | string | No | Tailwind CSS color class |
| `imageId` | string | No | FK → routine_images collection |
| `imageUrl` | string\|null | No | Image URL (set by API) |
| `variants` | RoutineVariant[] | No | Embedded variants array |
| `defaultVariantId` | string | No | Default variant to pre-select |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |

**Created:** RoutineEditorModal
**Edited:** RoutineEditorModal (edit mode)
**Deleted:** Confirmation dialog from RoutineList
**UI:** RoutineList, RoutinePreviewModal, RoutineRunnerModal, Dashboard (pinned)
**Related to:** Category, Habit (dual link), RoutineLog, HabitPotentialEvidence

---

### RoutineVariant (Embedded in Routine)

**Source:** `src/models/persistenceTypes.ts:449`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier within routine |
| `name` | string | Yes | Display name (e.g., "Quick", "Deep") |
| `description` | string | No | Description |
| `estimatedDurationMinutes` | number | Yes | Duration estimate |
| `sortOrder` | number | Yes | Display order |
| `steps` | RoutineStep[] | Yes | Steps for this variant |
| `linkedHabitIds` | string[] | Yes | Computed from steps on save |
| `icon` | string | No | Variant icon |
| `color` | string | No | Variant color |
| `isAiGenerated` | boolean | Yes | Whether AI-generated |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |

---

### RoutineStep (Embedded in RoutineVariant)

**Source:** `src/models/persistenceTypes.ts:392`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier within variant |
| `title` | string | Yes | Step title |
| `instruction` | string | No | Detailed instructions |
| `imageUrl` | string | No | Visual guidance image |
| `timerSeconds` | number | No | Timer duration |
| `timerMode` | `'countdown'\|'stopwatch'` | No | Timer type |
| `linkedHabitId` | string | No | FK → Habit.id (single habit per step) |
| `trackingFields` | TrackingFieldDef[] | No | User-defined tracking fields |

**Embedded: TrackingFieldDef**

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique ID within step |
| `label` | string | Display label (e.g., "Weight") |
| `type` | `'number'\|'text'` | Field type |
| `unit` | string | Unit label |
| `defaultValue` | string\|number | Pre-filled value |

---

### RoutineLog

**Purpose:** Records that a routine was completed on a specific day.

**Source:** `src/models/persistenceTypes.ts:565` | **Collection:** `routineLogs`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `routineId` | string | Yes | FK → Routine.id |
| `variantId` | string | No | FK → RoutineVariant.id |
| `date` | string | Yes | Date (YYYY-MM-DD) |
| `startedAt` | string (ISO) | No | Execution start time |
| `completedAt` | string (ISO) | Yes | Completion timestamp |
| `stepResults` | Record<string, StepStatus> | No | Per-step status (neutral/done/skipped) |
| `actualDurationSeconds` | number | No | Actual execution time |
| `stepTrackingData` | Record<string, Record<string, string\|number>> | No | Per-step tracking values |
| `stepTimingData` | Record<string, number> | No | Per-step time spent |

---

### BundleMembership

**Purpose:** Temporal parent-child relationship for bundles. Defines time ranges during which a child habit belongs to a parent bundle.

**Source:** `src/server/domain/canonicalTypes.ts:153` | **Collection:** `bundleMemberships`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `parentHabitId` | string | Yes | FK → Habit.id (bundle parent) |
| `childHabitId` | string | Yes | FK → Habit.id (bundle child) |
| `activeFromDayKey` | string | Yes | Start of membership (inclusive) |
| `activeToDayKey` | string\|null | No | End of membership (null = active) |
| `daysOfWeek` | number[]\|null | No | Scheduled days within range |
| `graduatedAt` | string\|null | No | When behavior became automatic |
| `archivedAt` | string\|null | No | UX hint to hide from active lists |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |

---

### JournalEntry

**Purpose:** A single journal entry, either free-write or template-guided.

**Source:** `src/models/persistenceTypes.ts:602` | **Collection:** `journalEntries`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `userId` | string | Yes | Owner user ID |
| `templateId` | string | Yes | Template ID (e.g., 'morning-primer', 'free-write') |
| `mode` | `'standard'\|'deep'\|'free'` | Yes | Entry mode |
| `persona` | string | No | Active persona at time of writing |
| `content` | Record<string, string> | Yes | Keyed by prompt ID, value is answer |
| `date` | string | Yes | Date (YYYY-MM-DD) |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |

---

### WellbeingEntry

**Purpose:** Canonical truth for subjective wellbeing check-ins. One document per (userId, dayKey, timeOfDay, metricKey).

**Source:** `src/models/persistenceTypes.ts:883` | **Collection:** `wellbeingEntries`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `userId` | string | Yes | Owner user ID |
| `timestampUtc` | string (ISO) | Yes | When observation occurred |
| `dayKey` | string | Yes | Aggregation boundary (YYYY-MM-DD) |
| `timeOfDay` | `'morning'\|'evening'\|null` | No | Session label |
| `metricKey` | WellbeingMetricKey | Yes | Metric identifier |
| `value` | number\|string\|null | Yes | Metric value |
| `source` | `'checkin'\|'import'\|'test'` | Yes | Source of observation |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |
| `deletedAt` | string (ISO) | No | Soft delete timestamp |

**WellbeingMetricKey values:** depression, anxiety, energy, sleepScore, sleepQuality, lowMood, calm, stress, focus, satisfaction, notes, readiness, soreness, hydration, fueling, recovery

---

### Task

**Purpose:** Simple task with inbox/today placement.

**Source:** `src/types/task.ts:1` | **Collection:** `tasks`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `userId` | string | Yes | Owner user ID |
| `title` | string | Yes | Task title |
| `status` | `'active'\|'completed'\|'deleted'` | Yes | Task status |
| `listPlacement` | `'inbox'\|'today'` | Yes | Where task appears |
| `linkedGoalId` | string | No | FK → Goal.id |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `completedAt` | string (ISO) | No | Completion timestamp |
| `movedToTodayAt` | string (ISO) | No | When moved to today |

---

### Category

**Purpose:** Groups habits, goals, and routines.

**Source:** `src/models/persistenceTypes.ts:23` | **Collection:** `categories`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `color` | string | Yes | Tailwind CSS color class |

---

### HabitPotentialEvidence

**Purpose:** Signal that a user might have completed a habit, generated by routine step execution. Requires user confirmation to become a HabitEntry.

**Source:** `src/models/persistenceTypes.ts:1442` | **Collection:** `habitPotentialEvidence`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `habitId` | string | Yes | FK → Habit.id |
| `routineId` | string | Yes | FK → Routine.id |
| `stepId` | string | Yes | FK → RoutineStep.id |
| `date` | string | Yes | Date (YYYY-MM-DD) |
| `timestamp` | string (ISO) | Yes | When evidence was generated |
| `source` | `'routine-step'` | Yes | Source type |
| `variantId` | string | No | FK → RoutineVariant.id |

---

### DashboardPrefs

**Purpose:** User-scoped view preferences. Must never affect truth stores.

**Source:** `src/models/persistenceTypes.ts:656` | **Collection:** `dashboardPrefs`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `userId` | string | Yes | Owner user ID |
| `pinnedRoutineIds` | string[] | Yes | Pinned routine IDs |
| `checkinExtraMetricKeys` | WellbeingMetricKey[] | No | Extra wellbeing metrics in check-in |
| `hideStreaks` | boolean | No | Hide streak indicators |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |

---

### Health Integration Entities

#### HealthMetricDaily

**Purpose:** Imported daily health data from Apple Health.

**Source:** `src/models/persistenceTypes.ts:1489` | **Collection:** `healthMetricsDaily`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `userId` | string | Yes | Owner user ID |
| `dayKey` | string | Yes | Date (YYYY-MM-DD) |
| `source` | `'apple_health'` | Yes | Data source |
| `steps` | number\|null | No | Step count |
| `activeCalories` | number\|null | No | Active calories |
| `sleepHours` | number\|null | No | Sleep hours |
| `workoutMinutes` | number\|null | No | Workout minutes |
| `weight` | number\|null | No | Weight |
| `rawDataJson` | string | No | Raw data for debugging |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |

#### HabitHealthRule

**Purpose:** Maps a habit to a health data condition. When the condition is met, auto-logs a HabitEntry or creates a suggestion.

**Source:** `src/models/persistenceTypes.ts:1514` | **Collection:** `habitHealthRules`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `userId` | string | Yes | Owner user ID |
| `habitId` | string | Yes | FK → Habit.id |
| `sourceType` | `'apple_health'` | Yes | Data source type |
| `metricType` | HealthMetricType | Yes | steps/sleep_hours/workout_minutes/active_calories/weight |
| `operator` | `'>='\|'<='\|'>'\|'<'\|'exists'` | Yes | Comparison operator |
| `thresholdValue` | number\|null | No | Comparison value |
| `behavior` | `'auto_log'\|'suggest'` | Yes | What to do when condition met |
| `backfillStartDayKey` | string | No | Start date for backfill |
| `active` | boolean | Yes | Whether rule is active |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |

#### HealthSuggestion

**Purpose:** Pending suggestion from health rule evaluation. User must accept to create a HabitEntry.

**Source:** `src/models/persistenceTypes.ts:1537` | **Collection:** `healthSuggestions`

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | Yes | Unique identifier |
| `userId` | string | Yes | Owner user ID |
| `habitId` | string | Yes | FK → Habit.id |
| `ruleId` | string | Yes | FK → HabitHealthRule.id |
| `dayKey` | string | Yes | Date (YYYY-MM-DD) |
| `metricType` | HealthMetricType | Yes | Metric that triggered |
| `metricValue` | number | Yes | Metric value |
| `status` | `'pending'\|'accepted'\|'dismissed'` | Yes | Suggestion status |
| `createdAt` | string (ISO) | Yes | Creation timestamp |
| `updatedAt` | string (ISO) | Yes | Last update timestamp |

---

### Deprecated Entities

#### DayLog (DEPRECATED)

**Purpose:** Legacy completion cache. Derived from HabitEntry. Do NOT write to directly.

**Source:** `src/models/persistenceTypes.ts:282` | **Collection:** `logs`

| Field | Type | Purpose |
|-------|------|---------|
| `habitId` | string | FK → Habit.id |
| `date` | string | Date (YYYY-MM-DD) |
| `value` | number | Tracked value |
| `completed` | boolean | Whether goal met |
| `source` | string | Entry source |
| `routineId` | string | Routine that produced log |
| `isFrozen` | boolean | Whether day was frozen |
| `freezeType` | string | Type of freeze applied |
| `bundleOptionId` | string | Choice option ID (deprecated) |
| `completedOptions` | Record<string, number> | Multi-select options |

#### DailyWellbeing (LEGACY)

**Purpose:** Legacy wellbeing format with morning/evening sessions. Superseded by WellbeingEntry.

**Source:** `src/models/persistenceTypes.ts:796` | **Collection:** `wellbeingLogs`

---

### Gamification Entities (Future)

#### Identity

**Source:** `src/models/persistenceTypes.ts:684` | **Collection:** `identities`

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique identifier |
| `userId` | string | Owner user ID |
| `name` | string | Display name |
| `sortOrder` | number | Display order |
| `icon` | string | Icon/emoji |
| `createdAt` | string (ISO) | Creation timestamp |

#### Skill

**Source:** `src/models/persistenceTypes.ts:712` | **Collection:** `skills`

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique identifier |
| `userId` | string | Owner user ID |
| `identityId` | string | FK → Identity.id |
| `name` | string | Display name |
| `habitIds` | string[] | FKs → Habit.id[] |
| `progressMode` | `'volume'\|'consistency'\|'hybrid'` | How progress is calculated |
| `levelConfig` | object | Level threshold config |
| `sortOrder` | number | Display order |
| `createdAt` | string (ISO) | Creation timestamp |

---

## GoalProgress (Derived Type)

**Purpose:** Computed progress toward a goal. Never stored — always derived from HabitEntry.

**Source:** `src/models/persistenceTypes.ts:1085`

| Field | Type | Purpose |
|-------|------|---------|
| `currentValue` | number | Progress toward goal |
| `percent` | number | Percentage (0-100) |
| `warnings` | GoalProgressWarning[] | Unit mismatch warnings |
| `lastSevenDays` | Array<{date, value, hasProgress}> | Recent daily breakdown |
| `inactivityWarning` | boolean | Whether goal is inactive |
| `forecastedCompletionDate` | string | Estimated completion date |
| `daysToCompletion` | number | Estimated days remaining |
| `dailyRateNeeded` | number | Rate needed to hit deadline |
