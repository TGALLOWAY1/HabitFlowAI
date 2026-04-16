# HabitFlowAI Feature List

Canonical inventory of all user-facing features. Keep this document in sync with the codebase — update it whenever a feature is added, removed, or significantly changed.

---

## Habits

- **Create/Edit Habits** — Add or modify habits with name, description, category, and scheduling
- **Tracking Types** — Boolean (done/not done) or Quantity (numeric value with unit)
- **Scheduling** — Assign habits to specific days of the week, set frequency (daily, weekly with times-per-week, required-days-per-week)
- **Categories** — Organize habits into color-coded categories; reorder via drag-and-drop
- **Quick Toggle** — Mark habits complete/incomplete from the tracker grid or day view
- **Habit History** — View past completion logs and patterns for any habit
- **Streaks** — Auto-computed current and longest streaks from completion data
- **Habit Bundles (Checklist)** — Group habits together; configure success rule (all, any, count, or percentage)
- **Habit Bundles (Choice)** — Pick one from a set of alternatives each day
- **Bundle Membership Management** — Move habits into/out of bundles; end or archive memberships
- **Habit-Goal Linking** — Link habits to goals so completions count as goal progress. A single habit can be linked to multiple goals simultaneously (e.g., one "study session" habit contributing to a sequence of exam goals in a track).
- **Habit-Routine Linking** — Link habits to routine steps so routine completion auto-logs habits
- **Archiving** — Archive habits instead of deleting; soft-delete pattern
- **Deletion with Goal Warning** — Deleting a habit linked to one or more goals surfaces a confirmation modal listing the affected goals. Historical progress on those goals is preserved — past entries continue to count — but the habit is removed from the goal's linked-habits list and can no longer be logged
- **Reordering** — Drag-and-drop to reorder habits within categories

## Routines

- **Create/Edit Routines** — Build multi-step routines with title, category, and description
- **Routine Variants** — Create multiple versions (e.g., Quick, Standard, Deep) with different steps and durations
- **Variant Copy** — Duplicate an existing variant as a starting point
- **AI Variant Suggestions** — Generate variant ideas via Gemini AI based on routine title and existing steps
- **Steps** — Ordered steps with title, instruction text, and optional timer
- **Step Timers** — Countdown timer or stopwatch mode per step
- **Step Images** — Upload images for visual guidance (JPEG, PNG, WebP, max 5MB)
- **Routine Runner** — Step-by-step guided execution modal with progress indicator
- **Linked Habit Auto-Logging** — Completing a routine auto-marks its linked habits as done
- **Pinned Routines** — Pin frequently-used routines to the dashboard for quick access
- **Routine Logs** — Track completion history with timestamps

## Goals

- **Create/Edit Goals** — Set goals with title, type, target, deadline, category, and linked habits
- **Goal Types: Cumulative** — Track total progress toward a numeric target (e.g., "Run 100 miles")
- **Goal Types: One-time** — Binary milestone achievement (e.g., "Pass the B2 exam")
- **Linked Habits** — Connect habits that contribute to goal progress; completions auto-update progress
- **Progress Visualization** — Real-time progress bar with milestone markers at 25/50/75%
- **Cumulative Chart** — Line graph of total progress over time
- **Trend Analysis** — Compare actual vs. required pace to hit deadline
- **Weekly Summary** — Aggregated contribution data by week
- **Day-by-Day View** — Chronological list of individual contributions
- **Goal Schedule View** — Calendar showing deadlines, forecasts, and milestones across all goals
- **Achievement Badges** — Auto-generated badges for completed goals
- **Win Archive** — Gallery of completed goals with badges
- **Goal Extension** — Create a continuation goal with higher target after completion
- **Mark Complete** — Manually mark goals as achieved
- **Goal Ordering** — Drag-and-drop reorder within category groups
- **Inactivity Coaching** — Rule-based popup suggestions when a goal is stagnant
- **Goal Tracks** — Create ordered sequences of goals within a category (e.g., Exam 1 → Exam 2 → Exam 3)
- **Track Progress Isolation** — Progress only counts from when a goal becomes active in a track; shared habits don't leak progress forward. The same habit can be linked to every goal in a track and each goal computes its own date-windowed contribution using the goal's `activeWindowStart` / `activeWindowEnd`
- **Track Advancement** — Completing the active goal automatically activates the next goal in the sequence
- **Track Detail View** — Dedicated page showing track progress, goal states (completed/active/locked), and drag-and-drop reordering
- **Track Ordering** — Drag-and-drop reorder of goal tracks within a category group on the Goals page
- **Track Achievements** — Earn achievements for completing goal tracks (Journey Complete, Triple Step, Grand Journey)

## Tasks

- **Create Tasks** — Add one-time actionable items
- **Today / Inbox Lists** — Separate columns for today's tasks and backlog
- **Task Completion** — Mark tasks as done
- **Auto-Sorting** — Active tasks first, then sorted by newest

## Journal

- **Free Write** — Open-ended journaling with no structure
- **Templated Entries** — 11 structured templates across 6 categories (Daily Structure, Mental Health, Physical Health, Habits & Behavior, Personal Growth, Relationships)
- **Standard / Deep Modes** — Templates offer standard prompts; some have optional deeper questions
- **Persona-Driven Prompts** — Each template has a persona and tone (e.g., "The Strategic Coach", "The Compassionate Therapist")
- **Entry History** — Browse, edit, and delete past journal entries (last 90 days)
- **Upsert by Key** — Same template + same day = updates existing entry (idempotent daily check-ins)
- **AI Journal Summary Banner** — Auto-generated weekly summary (when Gemini API key is configured) shown as a dismissible banner on the journal page; always saved as a journal entry in history

## Wellbeing

- **Daily Check-Ins** — Morning and evening wellness assessments
- **Wellbeing Metrics** — Track anxiety, low mood, calm, energy, stress on simple scales
- **Configurable Extra Metrics** — Choose additional metrics to include in check-in
- **Wellbeing History Page** — Three visualization modes:
  - **Heatmap** — Calendar grid showing metric intensity over time
  - **Weekly Summary** — Stacked bars showing weekly proportions
  - **Small Multiples** — Individual heatmap per metric
- **Time Window Selection** — View 30, 90, or 180 day periods

## Analytics

- **Habit Analytics** — Consistency score, completion rate, avg habits/day, best day of week, trend direction
- **Streak Analytics** — Current streak, longest streak, perfect days, best week
- **Trend Chart** — Line graph of completion trends over configurable time ranges
- **Category Breakdown** — Completion rates by habit category
- **Insights Panel** — Generated observations about behavior patterns
- **Activity Heatmap** — Calendar view of activity across all habits
- **Routine Analytics** — Completion frequency, variant usage, timing stats
- **Goal Analytics** — Completion rates, progress velocity

## AI Features (Gemini BYOK)

- **API Key Management** — Store Gemini API key in localStorage (never persisted server-side); configure via Settings
- **AI Weekly Summary** — General recap of habits and journal entries from the past week (Dashboard)
- **AI Journal Summary** — Auto-generated weekly journal summary shown as a dismissible banner; persisted as a journal entry in history
- **AI Variant Suggestions** — Generate routine variants based on routine title and steps
- **Persona-Driven Journaling** — Template personas guide journaling prompts

## Apple Health Integration (Beta)

- **Health Metric Syncing** — Import steps, active calories, sleep hours, workout minutes, weight
- **Health Rules** — Auto-log habits when health data meets a threshold
- **Health Suggestions** — Receive suggestions to log habits based on health data
- **Bounded Backfill** — Create entries from already-synced Apple Health data over a selectable lookback window: 7 / 30 (default) / 90 days, capped server-side at 365 days. Backfill never overwrites existing entries and only creates entries for days where the rule's condition is met.
- **Auto-Logged Entry Indicators** — Health-sourced entries marked with icon in tracker
- **Feature Gate** — Available to authorized users only (email allowlist)

## Dashboard

- **Daily Completion Ring** — Progress indicator showing habits done today vs. scheduled
- **Daily Check-In Card** — Quick access to morning/evening wellbeing check-in
- **Goals at a Glance** — Pinned goals with progress bars (configurable which goals to pin)
- **Pinned Routines Card** — Quick-start buttons for favorite routines
- **AI Weekly Summary Card** — Generate AI recap of the week
- **Journal Card** — Recent entries and shortcuts to Free Write / Templates / History
- **Tasks Card** — Today's task completion status
- **Setup Guide** — Onboarding walkthrough for new users (dismissible, re-openable from Settings)

## Views

- **Tracker Grid** — Default view showing all habits by category with toggle controls
- **Day View (Today)** — Focused view of today's scheduled habits
- **Schedule View (Weekly)** — Week-at-a-glance showing habit completion across 7 days

## Settings & Account

- **Appearance (Theme)** — Light / Dark / System. User-menu quick toggle + labeled Settings section. Preference syncs across devices via `DashboardPrefs.themeMode`; `system` mode tracks `prefers-color-scheme` at runtime. Default is Dark.
- **Gemini API Key** — Add, view, or remove AI integration key
- **Apple Health Link** — Connect health integration (beta users)
- **Setup Guide Reopen** — Re-trigger onboarding walkthrough
- **Delete All Data** — Permanent data wipe with confirmation

## Cross-Cutting

- **Identity Model** — Household + User ID headers on every request; all data user-scoped
- **Timezone-Aware DayKey** — All date logic uses client timezone, not UTC
- **Soft Deletes** — `deletedAt` timestamp pattern for truth records
- **Optimistic UI** — Changes appear instantly with backend sync
- **Responsive Design** — Mobile-first with bottom tab bar (Dashboard, Habits, Routines, Goals)
