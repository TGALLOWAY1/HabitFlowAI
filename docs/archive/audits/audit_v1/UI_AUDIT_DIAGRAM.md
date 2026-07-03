# HabitFlow UI Audit — Visual Diagrams

Generated from the V1 audit findings. These Mermaid diagrams capture information architecture, data flow, issue mapping, and UX pain points.

---

## 1. Information Architecture & Navigation Map

### 1a. App Shell & Primary Navigation

```mermaid
graph TD
    classDef primary fill:#4F46E5,stroke:#3730A3,color:#fff
    classDef secondary fill:#0891B2,stroke:#0E7490,color:#fff
    classDef modal fill:#D97706,stroke:#B45309,color:#fff
    classDef legacy fill:#6B7280,stroke:#4B5563,color:#fff

    APP["HabitFlow App"] --> HEADER["Header Bar"]
    APP --> TAB_BAR["Bottom Tab Bar"]

    HEADER --> SETTINGS_M["Settings Modal"]:::modal
    HEADER --> INFO_M["Info / Tutorial Modal"]:::modal
    HEADER --> USER_MENU["User Menu Dropdown"]

    TAB_BAR --> TAB_DASH["Dashboard"]:::primary
    TAB_BAR --> TAB_HABITS["Habits"]:::primary
    TAB_BAR --> TAB_ROUTINES["Routines"]:::primary
    TAB_BAR --> TAB_GOALS["Goals"]:::primary

    TAB_DASH --> JOURNAL["Journal Page"]:::secondary
    TAB_DASH --> TASKS["Tasks Page"]:::secondary
    TAB_DASH --> WELLBEING["Wellbeing History"]:::secondary
    TAB_DASH --> DEBUG["Debug Entries (dev)"]:::legacy
```

### 1b. Dashboard Domain

```mermaid
graph TD
    classDef modal fill:#D97706,stroke:#B45309,color:#fff
    classDef link fill:#2563EB,stroke:#1D4ED8,color:#fff

    DASH["Progress Dashboard"]

    DASH --> SETUP["Setup Guide\n(Onboarding)"]
    DASH --> CHECKIN["Daily Check-in"]:::modal
    DASH --> PINNED_G["Pinned Goals"]
    DASH --> CAT_COMP["Category Completion"]
    DASH --> PINNED_R["Pinned Routines"]
    DASH --> WEEKLY["Weekly Summary"]
    DASH --> HEATMAP["Activity Heatmap\n(30d / 90d / year)"]

    PINNED_G -->|"click"| GOAL_DETAIL["Goal Detail Page"]:::link
    PINNED_R -->|"play"| ROUTINE_RUNNER["Routine Runner"]:::modal
    CAT_COMP -->|"click"| TRACKER["Tracker (filtered)"]:::link
    DASH --> TASKS_CARD["Tasks Card"]
    DASH --> JOURNAL_CARD["Journal Card"]
    TASKS_CARD -->|"click"| TASKS["Tasks Page"]:::link
    JOURNAL_CARD -->|"click"| JOURNAL["Journal Page"]:::link
    DASH -->|"link"| WELLBEING["Wellbeing History"]:::link
    DASH -->|"+ Goal"| CREATE_GOAL["Create Goal Flow"]:::link
```

### 1c. Habits / Tracker Domain

```mermaid
graph TD
    classDef modal fill:#D97706,stroke:#B45309,color:#fff
    classDef view fill:#6EE7B7,stroke:#059669,color:#065F46

    TRACKER["Tracker Page"]

    TRACKER --> GRID["Grid View (default)"]:::view
    TRACKER --> TODAY["Today View"]:::view
    TRACKER --> WEEKLY["Weekly View"]:::view

    TRACKER -->|"+ Habit"| ADD_HABIT["Add/Edit Habit Modal"]:::modal
    TRACKER -->|"context menu"| CTX["Habit Context Menu"]

    CTX --> HIST["Habit History Modal"]:::modal
    CTX --> LOG["Habit Log Modal"]:::modal
    CTX --> CAT_PICK["Category Picker Modal"]:::modal
    CTX --> BUNDLE_PICK["Bundle Picker Modal"]:::modal
    CTX --> CONVERT["Convert to Bundle Modal"]:::modal
```

### 1d. Routines Domain

```mermaid
graph TD
    classDef modal fill:#D97706,stroke:#B45309,color:#fff

    LIST["Routine Cards List"]

    LIST -->|"+ Routine"| EDITOR["Routine Editor Modal"]:::modal
    LIST -->|"preview"| PREVIEW["Routine Preview Modal"]:::modal
    LIST -->|"play"| RUNNER["Routine Runner Modal"]:::modal

    RUNNER --> COMPLETED["Completed Habits Modal"]:::modal
```

### 1e. Goals Domain

```mermaid
graph TD
    classDef modal fill:#D97706,stroke:#B45309,color:#fff
    classDef page fill:#4F46E5,stroke:#3730A3,color:#fff

    GOALS["Goals List\n(Collapsible Category Stacks)"]

    GOALS -->|"+ Goal"| STEP1["Create Goal Step 1"]:::page
    STEP1 --> STEP2["Step 2: Link Habits"]:::page

    GOALS -->|"click goal"| DETAIL["Goal Detail Page"]:::page
    GOALS -->|"trophy icon"| WINS["Win Archive Gallery"]:::page

    DETAIL --> EDIT["Edit Goal Modal"]:::modal
    GOALS --> DELETE["Delete Goal Confirm"]:::modal

    DETAIL --> COMPLETED["Goal Completed Page"]:::page
    COMPLETED --> WINS
    WINS -->|"click goal"| DETAIL
```

---

## 2. Data Architecture & Canonical Truth Flow

```mermaid
graph LR
    classDef canonical fill:#059669,stroke:#047857,color:#fff
    classDef legacy fill:#DC2626,stroke:#B91C1C,color:#fff
    classDef derived fill:#7C3AED,stroke:#6D28D9,color:#fff
    classDef ui fill:#2563EB,stroke:#1D4ED8,color:#fff

    subgraph UI_LAYER["Frontend (React 19 + Vite)"]
        direction TB
        TRACKER_UI["TrackerGrid"]:::ui
        DAYVIEW_UI["DayView"]:::ui
        DASH_UI["ProgressDashboard"]:::ui
        GOAL_UI["GoalDetailPage"]:::ui
        ROUTINE_UI["RoutineRunner"]:::ui
        JOURNAL_UI["JournalPage"]:::ui
        TASK_UI["TasksPage"]:::ui
        WELLBEING_UI["WellbeingCheckIn"]:::ui
    end

    subgraph STATE["Client State Layer"]
        HABIT_CTX["HabitContext\n(logs: DayLog cache)"]:::legacy
        ROUTINE_CTX["RoutineContext"]
        TASK_CTX["TaskContext\n(raw fetch, no shared client)"]:::legacy
    end

    API_CLIENT["persistenceClient.ts"]

    subgraph SERVER["Backend (Express 5)"]
        direction TB
        subgraph ROUTES["Routes (HTTP Handlers)"]
            ENTRY_RT["/api/entries"]
            DAYSUMMARY_RT["/api/daySummary"]
            DAYVIEW_RT["/api/dayView"]
            GOALS_RT["/api/goals"]
            PROGRESS_RT["/api/progress"]
            DASHBOARD_RT["/api/dashboard"]
            ROUTINES_RT["/api/routines"]
            JOURNAL_RT["/api/journal"]
            TASKS_RT["/api/tasks"]
            WELLBEING_RT["/api/wellbeingEntries"]
            LEGACY_WB["/api/wellbeingLogs"]:::legacy
            LEGACY_DL["/api/dayLogs"]:::legacy
        end

        subgraph SERVICES["Services (Derived Logic)"]
            TRUTH_Q["truthQuery\n(includeLegacyFallback=true)"]:::legacy
            DAYVIEW_SVC["dayViewService\n(entries-first)"]:::canonical
            STREAK_SVC["streakService"]:::derived
            GOAL_PROG_V2["goalProgressV2"]:::canonical
            GOAL_PROG_V1["computeGoalProgress\n(DayLogs + manual logs)"]:::legacy
        end

        subgraph REPOS["Repositories"]
            ENTRY_REPO["habitEntryRepository"]:::canonical
            DAYLOG_REPO["dayLogRepository"]:::legacy
            GOAL_REPO["goalRepository"]
            MANUAL_LOG_REPO["goalManualLogRepository"]:::legacy
            ROUTINE_REPO["routineRepository"]
        end
    end

    subgraph DB["MongoDB Collections"]
        ENTRIES_COL[("habitEntries\n(CANONICAL TRUTH)")]:::canonical
        DAYLOGS_COL[("dayLogs\n(LEGACY CACHE)")]:::legacy
        HABITS_COL[("habits")]
        GOALS_COL[("goals")]
        MANUAL_LOGS_COL[("goalManualLogs\n(LEGACY)")]:::legacy
        ROUTINES_COL[("routines")]
        JOURNAL_COL[("journalEntries")]
        TASKS_COL[("tasks")]
        WB_ENTRIES_COL[("wellbeingEntries")]:::canonical
        WB_LOGS_COL[("wellbeingLogs\n(LEGACY)")]:::legacy
        EVIDENCE_COL[("habitPotentialEvidence")]:::legacy
    end

    UI_LAYER --> STATE
    STATE --> API_CLIENT
    TASK_UI -.->|"raw fetch\n(bypasses client)"| TASKS_RT
    API_CLIENT --> ROUTES

    ENTRY_RT --> ENTRY_REPO --> ENTRIES_COL
    ENTRY_RT -.->|"recomputeDayLog"| DAYLOG_REPO --> DAYLOGS_COL
    DAYSUMMARY_RT --> TRUTH_Q
    DAYVIEW_RT --> DAYVIEW_SVC
    GOALS_RT --> GOAL_PROG_V2
    GOALS_RT -.->|"detail endpoint"| GOAL_PROG_V1
    GOAL_PROG_V1 --> MANUAL_LOG_REPO --> MANUAL_LOGS_COL
    GOAL_PROG_V1 --> DAYLOG_REPO
    TRUTH_Q --> ENTRY_REPO
    TRUTH_Q -.->|"legacy fallback"| DAYLOG_REPO
    DAYVIEW_SVC --> ENTRY_REPO
    ROUTINES_RT --> ROUTINE_REPO --> ROUTINES_COL
    ROUTINES_RT -.->|"auto-log habits"| ENTRY_REPO
```

---

## 3. Audit Issue Severity Map

```mermaid
graph TB
    classDef critical fill:#DC2626,stroke:#991B1B,color:#fff
    classDef high fill:#EA580C,stroke:#C2410C,color:#fff
    classDef medium fill:#D97706,stroke:#B45309,color:#fff
    classDef low fill:#2563EB,stroke:#1D4ED8,color:#fff

    AUDIT["V1 Audit\nTop 10 Issues"]

    subgraph CRITICAL["CRITICAL — Data Integrity"]
        I1["#1 Truth Split\ntruthQuery merges DayLogs\nby default"]:::critical
        I2["#2 Goal Progress\naccepts non-HabitEntry inputs\n(manual logs, DayLogs)"]:::critical
        I3["#3 Uniqueness Gap\n(habitId, dayKey) not enforced\nat DB level"]:::critical
    end

    subgraph HIGH["HIGH — Semantic / Security"]
        I4["#4 Routine Auto-Log\nRoutine submit writes entries\ndirectly (violates canon)"]:::high
        I5["#5 DayKey/Timezone\nInconsistent in aggregators\n(server-local fallbacks)"]:::high
        I6["#6 Evidence Subsystem\nHardcoded user, non-canonical\nfields, persistent storage"]:::high
        I9["#9 Identity/Auth\nAnonymous fallback, Tasks\nbypasses shared client"]:::high
    end

    subgraph MEDIUM["MEDIUM — UX / Frontend"]
        I7["#7 Forbidden Payload\nTrackerGrid sends completed\nfield (400 from validator)"]:::medium
        I8["#8 DayLog-Centric State\nHabitContext uses logs:DayLog\nas primary UI truth"]:::medium
        I10["#10 Mobile UX Friction\nDouble-click delete, 300ms\ndelay, choice bundle TODO"]:::medium
    end

    AUDIT --> CRITICAL
    AUDIT --> HIGH
    AUDIT --> MEDIUM

    I1 -.->|"blocks"| I2
    I1 -.->|"feeds"| I8
    I3 -.->|"race condition"| I1
    I5 -.->|"compounds"| I1
    I8 -.->|"causes"| I7
```

---

## 4. UX Pain Points & Interaction Model

```mermaid
graph TB
    classDef pain fill:#FEE2E2,stroke:#DC2626,color:#991B1B
    classDef fix fill:#D1FAE5,stroke:#059669,color:#065F46
    classDef flow fill:#DBEAFE,stroke:#2563EB,color:#1E40AF

    subgraph LOGGING["Habit Logging (Core Flow)"]
        direction TB
        LOG_GRID["Grid View Logging"]:::flow
        LOG_DAY["Day View Logging"]:::flow
        LOG_ROUTINE["Routine-Based Logging"]:::flow

        PAIN_1["300ms click delay +\ndouble-click delete\n(touch hostile)"]:::pain
        PAIN_2["Choice bundle state\nis TODO in Day View"]:::pain
        PAIN_3["Routine auto-logs\nhabits (blurs support\nvs completion)"]:::pain

        LOG_GRID --> PAIN_1
        LOG_DAY --> PAIN_2
        LOG_ROUTINE --> PAIN_3

        FIX_1["One-tap toggle model\nLong-press for edit/delete"]:::fix
        FIX_2["Unify logging interaction\nacross Grid + Day view"]:::fix
        FIX_3["Routine = end session\nHabits = explicit checklist"]:::fix

        PAIN_1 --> FIX_1
        PAIN_2 --> FIX_2
        PAIN_3 --> FIX_3
    end

    subgraph PERF["Performance & Polish"]
        direction TB
        PAIN_4["100ms polling loops\nin Dashboard + Goals\n(jittery, battery drain)"]:::pain
        PAIN_5["Modal overlays lack\ndialog role, aria-modal,\nfocus trapping"]:::pain
        PAIN_6["PWA uses vite.svg\nfor app icons"]:::pain

        FIX_4["Event-driven invalidation\n(habitflow:* events)"]:::fix
        FIX_5["Standardize top 3 modals\nwith proper dialog semantics"]:::fix
        FIX_6["Add real 192/512 PNG icons"]:::fix

        PAIN_4 --> FIX_4
        PAIN_5 --> FIX_5
        PAIN_6 --> FIX_6
    end

    subgraph DISCOVERABILITY["Navigation & Discoverability Gaps"]
        direction TB
        GAP_1["Journal & Tasks not in\nbottom tab bar"]:::pain
        GAP_2["Wellbeing History buried\n(Dashboard link only)"]:::pain
        GAP_3["Win Archive hard to find\n(small trophy icon)"]:::pain
        GAP_4["Category management hidden\nin inline interactions"]:::pain
        GAP_5["No breadcrumbs on\ndetail pages"]:::pain
    end
```

---

## 5. Feature Surface Coverage Matrix

```mermaid
graph LR
    classDef clean fill:#D1FAE5,stroke:#059669,color:#065F46
    classDef mixed fill:#FEF3C7,stroke:#D97706,color:#92400E
    classDef legacy fill:#FEE2E2,stroke:#DC2626,color:#991B1B

    subgraph SURFACES["Feature Surfaces by Data Path Health"]
        direction TB

        subgraph CLEAN_PATH["Entries-First (Canonical)"]
            S_DAYVIEW["Day View\n(dayViewService)"]:::clean
            S_JOURNAL["Journal\n(journalEntries)"]:::clean
            S_TASKS["Tasks\n(tasks collection)"]:::clean
        end

        subgraph MIXED_PATH["Mixed Canonical + Legacy"]
            S_GRID["Tracker Grid\n(daySummary + truthQuery\nlegacy fallback ON)"]:::mixed
            S_DASH["Dashboard\n(progress overview\nmixed dayKey fallback)"]:::mixed
            S_GOALS_LIST["Goals List\n(goalsWithProgressV2\nbut includes manual logs)"]:::mixed
            S_STREAKS["Streak Dashboard\n(timezone handling\npath-dependent)"]:::mixed
            S_WELLBEING["Wellbeing\n(dual-write entries\n+ legacy logs)"]:::mixed
        end

        subgraph LEGACY_PATH["Legacy-Dependent"]
            S_GOAL_DETAIL["Goal Detail\n(computeGoalProgress V1\nDayLogs + manual logs)"]:::legacy
            S_ROUTINES["Routine Submit\n(auto-log entries\n+ evidence persistence)"]:::legacy
            S_BUNDLES["Bundle Choice\n(legacy completedOptions\nmaps in read models)"]:::legacy
            S_DEBUG["Debug Entries\n(legacy source rows\nstill visible)"]:::legacy
        end
    end
```

---

## 6. Recommended Fix Priority & Dependencies

```mermaid
gantt
    title V1 Audit Fix Roadmap
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Critical - Data Integrity
    Disable legacy fallback in truthQuery        :crit, t1, 2026-04-01, 3d
    Remove DayLog/manual-log from goal detail    :crit, t2, after t1, 3d
    Enforce unique (userId,habitId,dayKey) index :crit, t3, 2026-04-01, 2d

    section High - Semantic and Security
    Fix DayKey/timezone in aggregators           :t4, after t1, 2d
    Decouple routine submit from entry creation  :t5, after t2, 3d
    Fix identity bypass in TaskContext           :t6, 2026-04-01, 1d
    Clean up evidence subsystem                  :t7, after t5, 2d

    section Medium - UX Quick Wins
    Remove forbidden completed field from upsert :t8, 2026-04-01, 1d
    Fix evidence API response contract           :t9, 2026-04-01, 1d
    Add modal accessibility baseline             :t10, 2026-04-03, 2d
    Replace vite.svg PWA icons                   :t11, 2026-04-01, 1d

    section Medium - UX Lifts
    Replace dblclick with one-tap logging        :t12, after t8, 3d
    Move tracker to entries-first state          :t13, after t1, 5d
    Remove 100ms polling loops                   :t14, after t13, 2d
    Streamline goal detail loading               :t15, after t2, 3d
```

---

## Legend

| Color | Meaning |
|-------|---------|
| Purple/Indigo | Primary navigation (tab bar) |
| Cyan | Secondary pages (no tab bar entry) |
| Orange | Modal surfaces |
| Green | Canonical / clean data path |
| Yellow | Mixed canonical + legacy path |
| Red | Legacy-dependent / critical issues |
| Gray | Legacy / deprecated |
