# HabitFlowAI Feature List

**This is the single source of truth for product functionality.** Canonical inventory of all
user-facing features — keep it in sync with the codebase, updating it whenever a feature is added,
removed, or significantly changed. Future/unshipped work belongs in [`../ROADMAP.md`](../ROADMAP.md),
not here.

**Status legend:** **Shipped** (in production) · **Beta** (gated / limited rollout) ·
**Partial** (incomplete) · **In Progress** · **Needs Verification** (status unconfirmed).
Every feature area below is **Shipped** unless an item notes otherwise.

## Status summary

| Area | Status | Notes |
|---|---|---|
| Habits | Shipped | Tracking, scheduling, categories, bundles, linking, streaks, archiving |
| Routines | Shipped | Variants, timers, images, runner, AI variant suggestions, auto-logging |
| Goals & Tracks | Shipped | Cumulative/one-time, milestones, trends, achievements, ordered tracks |
| Tasks | Shipped | Today/Inbox lists; slated to move out of primary nav (see roadmap) |
| Journal | Shipped | Free-write + 11 persona templates, upsert-by-day, AI summary banner |
| Wellbeing | Shipped | Wellbeing card (Morning/Evening/Health/Insights), redesigned check-ins, medication tracking, health hub, Insights views |
| Analytics | Shipped | Consistency, category breakdown, heatmaps, routine/goal/sleep analytics |
| Sleep Analytics | Shipped | Dedicated Sleep tab; Apple Watch sleep score, consistency, correlations |
| AI Features (Gemini BYOK) | Shipped | Weekly Review, Journal Review, summaries, variant suggestions |
| Apple Health Integration | Beta | Email-allowlisted users only; requires external sync bridge |
| Dashboard | Shipped | Daily habits ring, check-in & journal action cards, pinned goals/routines, tasks, setup guide |
| Views | Shipped | Tracker grid, Day view, weekly Schedule view |
| Settings & Account | Shipped | API key, archived habits, delete-all-data |

> Engineering detail for the AI features lives in [`ai-features.md`](ai-features.md).

---

## Habits

- **Create/Edit Habits** — Add or modify habits with name, description, category, and scheduling
- **Tracking Types** — Boolean (done/not done) or Quantity (numeric value with unit)
- **Scheduling** — Assign habits to specific days of the week, set frequency (daily, weekly with times-per-week, required-days-per-week)
- **Categories** — Organize habits into color-coded categories; reorder via drag-and-drop
- **Category Color Customization** — Change the color of any category from an 8-color palette; the new color propagates everywhere the category is rendered (tabs, completion rows, category breakdown chart)
- **Quick Toggle** — Mark habits complete/incomplete from the tracker grid or day view
- **Habit History** — View past completion logs and patterns for any habit
- **Streaks** — Auto-computed current and longest streaks from completion data
- **Habit Bundles (Checklist)** — Group habits together; configure success rule (all, any, count, or percentage)
- **Habit Bundles (Choice)** — Pick one from a set of alternatives each day
- **Bundle Membership Management** — Move habits into/out of bundles; end or archive memberships
- **Habit-Goal Linking** — Link habits to goals so completions count as goal progress. A single habit can be linked to multiple goals simultaneously (e.g., one "study session" habit contributing to a sequence of exam goals in a track).
- **Habit-Routine Linking** — Link habits to routine steps so routine completion auto-logs habits
- **Archiving** — Archive a habit to hide it from active tracking while preserving the habit definition and all entries. The trash icon archives by default (click twice to confirm). Restored from **Settings → View archived habits** with one click; restoration brings the habit back to its original category with full entry history intact
- **Remove Habit Modal (goal-linked habits)** — Removing a habit linked to one or more goals opens a chooser listing affected goals and offering two paths: **Archive** (recommended, restorable) or **Delete permanently** (soft-delete, not restorable from UI). Historical goal progress is preserved either way — past entries keep contributing to the goal — but only Archive lets you bring the habit itself back without re-creating it
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
- **Cumulative Goal Milestones** — Cumulative goals can declare intermediate stages (e.g., 25/50/75 within a 100 Pull-Ups goal). Milestones are server-validated to be unique, positive, and strictly less than the final target (max 20). Completion is derived from HabitEntries — only the configuration and a per-milestone `acknowledgedAt` celebration marker are stored. Each crossed milestone triggers the goal-completed celebration screen and renders as a node on the Achievements gallery's Progressive card.
- **Linked Habits** — Connect habits that contribute to goal progress; completions auto-update progress
- **Progress Visualization** — Real-time progress bar with milestone markers at 25/50/75%
- **Cumulative Chart** — Line graph of total progress over time. Renders from the same server-derived contributions series as the top "currentValue" total, so the two always agree
- **Removed-Habit Contributors** — When a goal has historical progress from habits that have since been deleted, the goal detail page surfaces those contributions in a "Removed habits still contributing" list. The habit name is preserved via soft-delete so users can see exactly which removed habit is contributing how many units
- **Trend Analysis** — Compare actual vs. required pace to hit deadline. Includes an adjustable "Start from" date control: narrowing the window excludes a long inactivity gap (e.g. an injury break) so it no longer dominates the chart or drags down the forecast/required-pace run-rate. Cumulative values are preserved — the actual line is seeded with the running total carried in from before the window, so earlier progress is never lost
- **Weekly Summary** — Aggregated contribution data by week
- **Day-by-Day View** — Chronological list of individual contributions
- **Goal Schedule View** — Calendar showing deadlines, forecasts, and milestones across all goals
- **Achievement Badges** — Auto-generated badges for completed goals
- **Achievements Gallery** — Three structured sections of completed goals: **Single** (one-time wins), **Progressive** (cumulative goals with iteration history *and* in-progress goals with crossed milestones, both rendered as connected milestone nodes — e.g. 25 → 50 → 100), and **Track** (per-track horizontal rows showing earned goal badges plus muted lock stubs for goals not yet earned). In-progress tracks appear here as soon as one goal in the track is earned. In-progress milestone goals appear as soon as at least one milestone is crossed.
- **Goal Extension** — Create a continuation goal with higher target after completion. Extended goals carry an `iteratedFromGoalId` backref so the Achievements gallery can collapse the chain into a single Progressive card showing the full target history. Extension also carries the prior target(s) forward as **pre-acknowledged milestones** on the new goal (50 → 100 stores a milestone at 50; 50 → 100 → 150 stores [50, 100]), so even an *in-progress* extended goal immediately renders milestone progression ("50 done / 100 in progress") instead of a bare bar. Pre-acknowledgement means these already-celebrated checkpoints do not re-pop a celebration the instant the goal is created.
- **Completion Reconciliation** — A cumulative goal's completion stays in sync with the entries it derives from. Editing or deleting habit entries so progress falls back below the target automatically reopens the goal and removes it from the Win Archive (e.g. a fat-fingered "105 job applications" corrected to "15" un-completes the "Complete 100" goal). Completion is never a stale flag that outlives the data that earned it. (One-time goals complete manually; tracked goals are exempt because their completion is bound to the track sequence.)
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
- **Edit Task Title** — Click the task title or the pencil icon to rename; Enter saves, Escape cancels
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

- **Wellbeing Card** — Replaces the old check-in card. Shows today's status (Morning /
  Evening / Sleep complete-or-pending) and four actions: ☀️ Morning, 🌙 Evening, 💊 Health,
  📈 Insights. The chevron opens a **Wellbeing Overview** (today's status, 7-day trend cards,
  quick actions).
- **Morning Check-in** ("How do I feel right now?") — Required 5-point sliders: Mood, Energy,
  Anxiety, Motivation, Focus. Optional: Brain Fog, Stress, Confidence, Irritability, Social
  Battery. Plus a morning notes field and the "Medications Taken Today" list.
- **Evening Check-in** ("How did today go?") — Required 5-point sliders: Satisfaction,
  Productivity, Mood, Stress, Enjoyment. Optional: Social Connection, Gratitude, Fulfillment.
  Plus reflection (best part / biggest challenge) and day-impact quick tags (Poor Sleep, Work
  Stress, Family Stress, Illness, Travel, Social Event, Medication Change).
- **Medication Tracking** — First-class medications (name, dose, schedule, start/end dates,
  dosage timeline) with a daily "taken today" toggle. Managed from the morning check-in or the
  Health hub; stored in dedicated `medications` / `medicationLogs` collections to power future
  correlation analysis.
- **Health Hub** (💊) — Entry point for all health tracking:
  - **Sleep** — Apple Watch sleep score & schedule (sleep entry form)
  - **Medications** — manage medications + daily "taken today" toggle
  - **Supplements** — user-defined supplement list (name, dose, schedule) + daily "taken today"
    toggle; stored in dedicated `supplements` / `supplementLogs` collections
  - **Symptoms** — user-defined symptom list + a daily 1–5 severity log; stored in dedicated
    `symptoms` / `symptomLogs` collections
  - **Weight** — one daily weight reading (lbs), stored as the `weight` wellbeing metric key
  - **Caffeine** — total daily caffeine (mg) with additive drink presets, stored as the
    `caffeineMg` wellbeing metric key
- **Insights** (formerly "Wellbeing History") — A tabbed analytics page (beta-gated)
  driven by a cross-domain insights engine (`/api/insights/*`), computed from canonical
  truth at read time. All correlations use the same statistical approach as Sleep
  Analytics (present/absent day-group split + Cohen's d effect size) and are always
  framed as correlation, never causation. Six tabs:
  - **Overview** — Discoveries & milestones, a top-correlations preview, metric averages,
    plus the original wellbeing visualizations (Heatmap, Weekly Summary, Small Multiples)
  - **Correlations** — Factor↔outcome relationships across habits, medications, supplements,
    symptoms, and behavioral factors vs subjective wellbeing metrics, split into "what's
    helping" and "what's holding you back"
  - **Habits** — Habit performance headline stats (reused from Habit Analytics) plus
    habit↔wellbeing correlations
  - **Medications** — Per-medication adherence (%, taken/logged days, current streak) plus
    medication↔wellbeing correlations
  - **Predictions** — Simple least-squares linear-trend projections per wellbeing metric
    (current → projected, change/week, confidence) with inline sparklines
  - **AI Review** — Gemini BYOK narrative grounded only on the computed insights
    (correlations, predictions, adherence); structured into summary, key findings,
    confidence-tagged patterns, outlook, recommendations, and data limitations
- **Time Window Selection** — View 30, 90, or 180 day periods (applies to all Insights tabs)

## Analytics

- **Habit Analytics** — Consistency score, completion rate, avg habits/day, best day of week, trend direction
- **Streak Analytics** — Current streak, longest streak, perfect days, best week
- **Trend Chart** — Line graph of completion trends over configurable time ranges
- **Category Breakdown** — Completion rates by habit category
- **Insights Panel** — Generated observations about behavior patterns
- **Activity Heatmap** — Calendar view of activity across all habits
  - **Overall view** — Last Year / Last 90 Days / Last 30 Days
  - **By Category view** — Per-category mini heatmap with 7d / 14d / 30d / 90d toggle
- **Routine Analytics** — Completion frequency, variant usage, timing stats
- **Goal Analytics** — Completion rates, progress velocity
- **Sleep Analytics** (Sleep tab) — Dedicated sleep dashboard answering "Am I becoming more consistent at sleeping ~10 PM–6 AM with high quality and less reliance on sleep aids?"
  - **Apple Watch Sleep Score** — Manually-entered overall score (0-100) plus bedtime / duration / interruption sub-scores (the primary signal)
  - **Headline metrics** — Average duration, latency, bedtime, wake time, sleep quality (0-10), each with sample size and period-over-period trend
  - **Sleep Consistency Score** — Rewards similar bedtime AND wake clock times night-to-night (circular std-dev), independent of how long you sleep
  - **Sleep Independence** — Sleep-aid-free nights, current/longest aid-free streak, percent aid-free, and trend
  - **Trend charts** — Bedtime & wake vs target reference lines (10 PM / 6 AM), and duration vs target
  - **Correlation engine** — Ranks tracked behaviors (phone in bed, blue light, wind-down, late eating, caffeine, plus any habit) by their measured effect on sleep outcomes, framed as correlation (Cohen's d, sample-size guards), never causation
  - **Weekly summary & achievements** — Per-week duration/latency/on-target/aid-free/energy rollups and milestone cards
  - **Configurable targets** — User-set target bedtime / wake / duration (default 10 PM / 6 AM / 8h)
  - Data captured via a dedicated **Sleep entry form** on the Daily Check-in (morning), stored as wellbeing entries
  - **Edit any previous night** — The sleep form has a "Night of" date picker (capped at today), and the Sleep tab shows an "Edit a night" list of recent nights; tapping a night opens the form pre-filled to log or correct that day's data

## AI Features (Gemini BYOK)

- **API Key Management** — Store Gemini API key in localStorage (never persisted server-side); configure via Settings
- **Weekly AI Review** — The single, comprehensive weekly report for a selected week (this week / last week), shown on the Habits page (Grid view, below the habit grid). It both tells the story of the week and provides evidence-based analysis. Aggregates habit entries, sleep & mood from wellbeing check-ins, journal activity, and goals into observed facts, then returns a typed review with seven sections: **Week at a Glance** (a natural-language narrative recap, 1–3 paragraphs), **Facts** (objective, measurable observations), **Patterns** (each with a low/medium/high confidence), **Journal Themes** (recurring topics and emotional trends), **Wins**, **Areas for Attention**, and **Recommendations** (max 3–5) — plus honest **Data Limitations**. The prompt separates observed facts from inferred patterns from suggestions and forbids inventing data; low-data weeks are reported honestly via Data Limitations rather than fabricated patterns. (Consolidates the former standalone AI Weekly Summary.)
- **Insights AI Review** — On-demand narrative for the Insights page (AI Review tab). Computes the user's cross-domain insights (correlations, linear-trend predictions, medication adherence, metric averages) and asks Gemini to explain them in plain language. Returns a typed review: **Summary**, **Key Findings** (objective, cited from the computed numbers), **Patterns** (each with a low/medium/high confidence), **Outlook** (caveated read of the trend predictions), **Recommendations** (max 5), and **Data Limitations**. Grounded only on already-computed facts; everything framed as correlation, never causation; the window is server-owned. Generated on demand (not persisted)
- **AI Journal Summary** — Auto-generated weekly journal summary shown as a dismissible banner; persisted as a journal entry in history
- **AI Report History (archive)** — Every generated Weekly AI Review and Journal Summary is saved to a dedicated `aiReports` archive (scoped per user, soft-deleted). The Weekly AI Review card (Habits page) and Journal Summary card expose a wand icon to (re)generate and a clock icon that opens a browsable history of past reports by date; any saved report can be reopened in full or deleted. Reading history requires no Gemini call.
- **AI Journal Review** — On-demand, structured review of journal entries over a user-selected date range (Journal → AI Review tab; presets for last 7/30 days plus custom range). Grounded only in the user's own entries, it returns a typed review: Overview, Emotional Themes, Recurring Stressors, and Self-Talk Patterns (each with paraphrased evidence; themes/stressors carry a low/medium/high confidence), Wins, Reflection Questions, Suggested Next Steps, and Data Limitations. The prompt separates observed evidence from inferred themes from next steps, forbids inventing facts or long quotes, and is deliberately non-clinical (no diagnoses). Empty ranges show a helpful empty state, sparse ranges show a low-data warning, and entries suggesting crisis surface a gentle support notice rather than counseling. Generated on demand (not persisted); regenerate at any time
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

- **Daily Habits Card** — Narrow status card showing the daily completion ring and count (e.g. 0/22)
- **Wellbeing Card** — Wide card showing today's status (Morning / Evening / Sleep) and four actions: ☀️ Morning, 🌙 Evening, 💊 Health, 📈 Insights; chevron opens the Wellbeing Overview
- **Goals at a Glance** — Pinned goals with progress bars (configurable which goals to pin)
- **Pinned Routines Card** — Quick-start buttons for favorite routines
- **Journal Card** — Wide action card with four actions that deep-link to the matching Journal tab: Free, Template, History, and AI (Review)
- **Tasks Card** — Narrow status card showing today's task completion count
- **Setup Guide** — Onboarding walkthrough for new users (dismissible, re-openable from Settings)

> The Weekly AI Review and Journal Summary cards no longer appear on the Dashboard. The **Weekly AI Review** now lives on the Habits page (Grid view, below the habit grid); see Habits / AI Features.

## Views

- **Tracker Grid** — Default view showing all habits by category with toggle controls
- **Day View (Today)** — Focused view of today's scheduled habits
- **Schedule View (Weekly)** — Week-at-a-glance showing habit completion across 7 days

## Settings & Account

- **Gemini API Key** — Add, view, or remove AI integration key
- **Apple Health Link** — Connect health integration (beta users)
- **Setup Guide Reopen** — Re-trigger onboarding walkthrough
- **View Archived Habits** — Modal listing archived habits with Restore (one-click) and Delete-permanently (two-step confirm) actions; shows count when non-empty
- **Delete All Data** — Permanent data wipe with confirmation

## Cross-Cutting

- **Identity Model** — Household + User ID headers on every request; all data user-scoped
- **Timezone-Aware DayKey** — All date logic uses client timezone, not UTC
- **Soft Deletes** — `deletedAt` timestamp pattern for truth records
- **Optimistic UI** — Changes appear instantly with backend sync
- **Responsive Design** — Mobile-first with bottom tab bar (Dashboard, Habits, Routines, Goals)
- **Take a Tour** — Accessible full-page tour that orients new users to the six tracking domains, showcases the shipped Gemini BYOK AI features, and lists the AI features on the roadmap with their status. Reachable from the Compass button in the header, the new-user Setup Guide, and a "Take a tour" link on the **Login screen** (no account or invite code required). Renders in an authenticated `app` mode (CTAs jump into the app) or a pre-login `auth` mode (CTAs point to Create an account / Sign in)
