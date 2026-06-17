# Wellbeing Metric Key Data Contract

## Purpose
This document defines the **stable, locked** field names and keys used for wellbeing metrics across the HabitFlowAI codebase. These keys must **never be renamed or repurposed** without a formal migration plan to prevent breaking changes and data drift (e.g., the "depression AM/PM" issue).

## Do Not Rename / Do Not Repurpose

The following keys are **LOCKED** and must remain stable across all personas, UI changes, and feature updates.

### Core Wellbeing Session Keys

#### `depression`
- **Type**: `number` (1-5 scale)
- **Location**: 
  - `WellbeingSession.depression` (primary)
  - `DailyWellbeing.depression` (legacy, read-only)
- **Files**:
  - `src/types/index.ts` (WellbeingSession interface)
  - `src/models/persistenceTypes.ts` (WellbeingSession, DailyWellbeing interfaces)
  - `src/components/DailyCheckInModal.tsx` (UI input)
  - `src/components/ProgressRings.tsx` (UI display, charts)
  - `src/server/routes/wellbeingLogs.ts` (API route, legacy field handling)
- **User Input**: Yes (via DailyCheckInModal)
- **Derived**: No
- **Stability Status**: **LOCKED**

#### `anxiety`
- **Type**: `number` (1-5 scale)
- **Location**: 
  - `WellbeingSession.anxiety` (primary)
  - `DailyWellbeing.anxiety` (legacy, read-only)
- **Files**:
  - `src/types/index.ts` (WellbeingSession interface)
  - `src/models/persistenceTypes.ts` (WellbeingSession, DailyWellbeing interfaces)
  - `src/components/DailyCheckInModal.tsx` (UI input)
  - `src/components/ProgressRings.tsx` (UI display, charts)
  - `src/server/routes/wellbeingLogs.ts` (API route, legacy field handling)
- **User Input**: Yes (via DailyCheckInModal)
- **Derived**: No
- **Stability Status**: **LOCKED**

#### `energy`
- **Type**: `number` (1-5 scale)
- **Location**: 
  - `WellbeingSession.energy` (primary)
  - `DailyWellbeing.energy` (legacy, read-only)
- **Files**:
  - `src/types/index.ts` (WellbeingSession interface)
  - `src/models/persistenceTypes.ts` (WellbeingSession, DailyWellbeing interfaces)
  - `src/components/DailyCheckInModal.tsx` (UI input - evening only)
  - `src/components/ProgressRings.tsx` (UI display)
  - `src/server/routes/wellbeingLogs.ts` (API route, legacy field handling)
- **User Input**: Yes (via DailyCheckInModal, evening session)
- **Derived**: No
- **Stability Status**: **LOCKED**

#### `sleepScore`
- **Type**: `number` (0-100 scale)
- **Location**: 
  - `WellbeingSession.sleepScore` (primary)
  - `DailyWellbeing.sleepScore` (legacy, read-only)
- **Files**:
  - `src/types/index.ts` (WellbeingSession interface)
  - `src/models/persistenceTypes.ts` (WellbeingSession, DailyWellbeing interfaces)
  - `src/components/DailyCheckInModal.tsx` (UI input - morning only)
  - `src/components/ProgressRings.tsx` (UI display)
  - `src/server/routes/wellbeingLogs.ts` (API route, legacy field handling)
- **User Input**: Yes (via DailyCheckInModal, morning session)
- **Derived**: No
- **Stability Status**: **LOCKED**

#### `notes`
- **Type**: `string` (optional)
- **Location**: 
  - `WellbeingSession.notes` (primary)
  - `DailyWellbeing.notes` (legacy, read-only)
- **Files**:
  - `src/types/index.ts` (WellbeingSession interface)
  - `src/models/persistenceTypes.ts` (WellbeingSession, DailyWellbeing interfaces)
  - `src/components/DailyCheckInModal.tsx` (UI input)
  - `src/server/routes/wellbeingLogs.ts` (API route, legacy field handling)
- **User Input**: Yes (via DailyCheckInModal)
- **Derived**: No
- **Stability Status**: **LOCKED**

---

## Additive Superset Keys (LOCKED)

These keys were added as an **additive superset** to support multiple personas while preserving continuity.

#### `lowMood`
- **Type**: `number` (0-4 scale, subjective)
- **Location**:
  - `WellbeingSession.lowMood`
  - `DailyWellbeing.lowMood` (legacy/top-level optional)
- **User Input**: Yes
- **Derived**: No
- **Stability Status**: **LOCKED**
- **Notes**: Preferred metric to show in newer Emotional Wellbeing UI (no migration required; `depression` remains supported).

#### `calm`
- **Type**: `number` (0-4 scale, subjective)
- **Location**:
  - `WellbeingSession.calm`
  - `DailyWellbeing.calm` (legacy/top-level optional)
- **User Input**: Yes
- **Derived**: No
- **Stability Status**: **LOCKED**

#### `stress`
- **Type**: `number` (0-4 scale, subjective)
- **Location**:
  - `WellbeingSession.stress`
  - `DailyWellbeing.stress` (legacy/top-level optional)
- **User Input**: Yes
- **Derived**: No
- **Stability Status**: **LOCKED**

#### `focus`
- **Type**: `number` (0-4 scale, subjective)
- **Location**:
  - `WellbeingSession.focus`
  - `DailyWellbeing.focus` (legacy/top-level optional)
- **User Input**: Yes
- **Derived**: No
- **Stability Status**: **LOCKED**

#### `sleepQuality`
- **Type**: `number` (0-4 scale, subjective)
- **Location**:
  - `WellbeingSession.sleepQuality`
  - `DailyWellbeing.sleepQuality` (legacy/top-level optional)
- **User Input**: Yes
- **Derived**: No
- **Stability Status**: **LOCKED**

---

## Sleep Analytics Keys (LOCKED)

Added for the Sleep Analytics dashboard. All are captured via the dedicated **SleepEntryForm**
(launched from the Daily Check-in morning tab), persisted as `WellbeingEntry` records with
`timeOfDay:'morning'` and `source:'checkin'`. They are **not** part of `WellbeingSession` and are
**not** rendered as generic check-in sliders (no `METRIC_UI` entry).

### Outcome keys

| Key | Type / encoding | Notes |
|---|---|---|
| `appleSleepScore` | `number` 0-100 | Apple Watch overall Sleep Score (PRIMARY signal) |
| `appleSleepBedtimeScore` | `number` 0-100 | Apple Watch bedtime sub-score |
| `appleSleepDurationScore` | `number` 0-100 | Apple Watch duration sub-score |
| `appleSleepInterruptionScore` | `number` 0-100 | Apple Watch interruption sub-score |
| `sleepBedtimeMinutes` | `number` 0..1439 | Clock time fell asleep, **minutes-after-noon** (see below) |
| `sleepWakeMinutes` | `number` 0..1439 | Clock time woke, **minutes-after-noon** |
| `sleepDurationMinutes` | `number` minutes | Total time asleep (e.g. 408 = 6h48m) |
| `sleepLatencyMinutes` | `number` minutes | Time to fall asleep (deferred from default form) |
| `sleepAwakenings` | `number` count ≥ 0 | Interruptions during the night (deferred from default form) |
| `sleepAidUsed` | `number` 0/1 | 1 = a sleep aid was used (e.g. clonazepam) |

### Behavioral correlation factor keys

These replace the user's former "Sleep" habit category; the correlation engine treats them
identically to habit-derived factor signals.

| Key | Type / encoding | Notes |
|---|---|---|
| `factorPhoneInBed` | `number` 0/1 | Phone used in bed |
| `factorBlueLightMinutes` | `number` minutes ≥ 0 | Blue-light exposure after target time |
| `factorWindDown` | `number` 0/1 | Completed a wind-down routine |
| `factorLateNightEating` | `number` 0/1 | Ate within ~3h of bed |
| `factorCaffeineAfter12` | `number` count ≥ 0 | Caffeinated drinks after noon |

### Minutes-after-noon encoding (clock times)

Bedtime/wake clock times are stored as **minutes elapsed since 12:00 noon**, wrapped into
`0..1439`, so a normal sleep window stays numerically contiguous across midnight:

```
minutesAfterNoon = ((hour*60 + minute) - 720 + 1440) % 1440
// 10:00 PM → 600, 11:58 PM → 718, 12:05 AM → 725, 6:00 AM → 1083
// inverse: clockMinutes = (minutesAfterNoon + 720) % 1440
```

- **User Input**: Yes (SleepEntryForm). **Derived**: No. **Stability Status**: **LOCKED**.

---

### Session Structure Keys

#### `morning`
- **Type**: `WellbeingSession | undefined` (optional)
- **Location**: `DailyWellbeing.morning`
- **Files**:
  - `src/types/index.ts` (DailyWellbeing interface)
  - `src/models/persistenceTypes.ts` (DailyWellbeing interface)
  - `src/components/DailyCheckInModal.tsx` (UI tab, state management)
  - `src/components/ProgressRings.tsx` (data reading, fallback logic)
  - `src/store/HabitContext.tsx` (state management, merging logic)
  - `src/server/routes/wellbeingLogs.ts` (API route)
- **User Input**: Yes (via DailyCheckInModal morning tab)
- **Derived**: No
- **Stability Status**: **LOCKED**

#### `evening`
- **Type**: `WellbeingSession | undefined` (optional)
- **Location**: `DailyWellbeing.evening`
- **Files**:
  - `src/types/index.ts` (DailyWellbeing interface)
  - `src/models/persistenceTypes.ts` (DailyWellbeing interface)
  - `src/components/DailyCheckInModal.tsx` (UI tab, state management)
  - `src/components/ProgressRings.tsx` (data reading, fallback logic)
  - `src/store/HabitContext.tsx` (state management, merging logic)
  - `src/server/routes/wellbeingLogs.ts` (API route)
- **User Input**: Yes (via DailyCheckInModal evening tab)
- **Derived**: No
- **Stability Status**: **LOCKED**

### Container Keys

#### `date`
- **Type**: `string` (YYYY-MM-DD format)
- **Location**: `DailyWellbeing.date`
- **Files**:
  - `src/types/index.ts` (DailyWellbeing interface)
  - `src/models/persistenceTypes.ts` (DailyWellbeing interface)
  - `src/store/HabitContext.tsx` (state key, API calls)
  - `src/components/DailyCheckInModal.tsx` (date handling)
  - `src/components/ProgressRings.tsx` (date key lookup)
  - `src/server/routes/wellbeingLogs.ts` (API route, MongoDB key)
- **User Input**: No (derived from current date or user selection)
- **Derived**: Yes (from Date object or user input)
- **Stability Status**: **LOCKED**

## Legacy Fields (Backward Compatibility)

The following fields exist on `DailyWellbeing` for **backward compatibility only**. They are **read-only** and should **not be written to** in new code.

- `depression` (top-level, legacy)
- `anxiety` (top-level, legacy)
- `energy` (top-level, legacy)
- `sleepScore` (top-level, legacy)
- `notes` (top-level, legacy)

**Reading Priority**: `evening` → `morning` → legacy top-level

**Migration Status**: These fields are preserved for backward compatibility. After MongoDB migration is complete and all users have migrated, consider deprecating these fields. They should not be written to in new code.

## Guardrails

### Stability Rules

1. **Keys must be stable across personas**
   - Persona changes must never rename metrics
   - Persona-specific interpretations may change, but field names must remain constant

2. **No breaking changes without migration**
   - If a key must be replaced, it must be done via a formal migration plan
   - Old keys must remain readable during migration period
   - Migration must include:
     - Data transformation script
     - Backward compatibility period
     - Documentation of breaking change

3. **Type stability**
   - Field types (number scales, string formats) must remain consistent
   - Scale changes (e.g., 1-5 to 1-10) require migration plan

4. **Session structure stability**
   - `morning` and `evening` session keys are locked
   - Do not add new session types (e.g., `afternoon`) without migration plan
   - Do not rename `morning`/`evening` to `AM`/`PM` or other variants

### Risk Assessment

**High Risk Keys** (most likely to cause drift if renamed):
- `depression` (previously had AM/PM variant issues)
- `anxiety` (similar structure to depression)
- `morning`/`evening` (session structure keys)

**Medium Risk Keys**:
- `energy` (less frequently used, but still critical)
- `sleepScore` (camelCase vs snake_case risk)

**Low Risk Keys**:
- `notes` (optional, less critical for data integrity)
- `date` (standard format, unlikely to change)

## Migration Process

If a key must be changed:

1. **Create migration plan document** with:
   - Rationale for change
   - Data transformation strategy
   - Backward compatibility period
   - Rollback plan

2. **Implement dual-write period**:
   - Write to both old and new keys
   - Read from new key with fallback to old key

3. **Data migration script**:
   - Transform existing data
   - Validate transformation
   - Update all code references

4. **Deprecation period**:
   - Mark old key as deprecated
   - Remove writes to old key
   - Keep reads for backward compatibility

5. **Final removal**:
   - After deprecation period, remove old key entirely
   - Update this contract document

## Related Documents

- `/reference/00_NORTHSTAR.md` - Canonical truth statements
- `/reference/14_JOURNAL_ENTRY.md` - JournalEntry structure (separate from wellbeing)
- `/reference/12_DERIVED_METRICS.md` - Derived metrics (interpretation layer)

