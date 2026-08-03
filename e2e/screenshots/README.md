# HabitFlow — Mobile Screenshot Reference

Full-app screenshot set captured at iPhone size (390×844 @2x, mobile Chromium) from the
seeded demo dataset. Regenerate with `npm run screenshots:mobile` (see `e2e/README.md`).

Intended audience: developers building the native iPhone app — every page, tab, modal,
habit type (boolean, numeric, weekly-frequency, checklist bundle, choice bundle), and
major flow is captured below.

## Auth

### Login

Email + password sign-in, forgot-password link, invite-code entry, and tour CTA. Default screen for unauthenticated users.

![Login](01-auth/01-login.png)

### Forgot Password

Email input; always shows a non-committal success message (no account enumeration).

![Forgot Password](01-auth/02-forgot-password.png)

### Invite Redeem

Account creation with an invite code.

![Invite Redeem](01-auth/03-invite-redeem.png)

## Dashboard

### Dashboard

Overview hub: Daily Habits completion ring, Wellbeing card (Morning/Evening/Health), Tasks and Journal cards, pinned routines, pinned goals, activity heatmap.

![Dashboard](02-dashboard/01-dashboard.png)

### Wellbeing Overview

Today's check-in status (Morning/Evening/Sleep), 7-day trends, quick actions. Opened from the Wellbeing card chevron.

![Wellbeing Overview](02-dashboard/02-wellbeing-overview.png)

### Morning Check-in

"How do I feel right now?" — 5-point sliders (Mood, Energy, Anxiety, Motivation, Focus), notes, and Medications Taken Today.

![Morning Check-in](02-dashboard/03-morning-checkin.png)

### Evening Check-in

"How did today go?" — 5-point sliders (Satisfaction, Productivity, Mood, Stress, Enjoyment), reflection, day-impact tags.

![Evening Check-in](02-dashboard/04-evening-checkin.png)

### Health Hub

Entry points for Sleep, Medications, Supplements, Symptoms, Weight, and Caffeine logging.

![Health Hub](02-dashboard/05-health-hub.png)

### Log Sleep

Apple Watch sleep score + sub-scores, bedtime/wake pickers, duration, quality, last-night habit toggles, "Night of" date picker.

![Log Sleep](02-dashboard/06-log-sleep.png)

### Medication Manager

Add/edit/delete medications (dose, schedule), toggle active. Seeded with Loratadine 10mg.

![Medication Manager](02-dashboard/07-medication-manager.png)

### Supplement Manager

User-defined supplements (dose, schedule) + today's taken/not-taken toggle. Seeded with Vitamin D3 and Magnesium glycinate.

![Supplement Manager](02-dashboard/08-supplement-manager.png)

### Symptom Manager

User-defined symptoms + today's 1–5 severity log. Seeded with Headache.

![Symptom Manager](02-dashboard/09-symptom-manager.png)

### Weight Log

Generic once-per-day numeric health factor logger (lbs).

![Weight Log](02-dashboard/10-weight-log.png)

### Caffeine Log

Additive caffeine logger with quick-add presets (Coffee 95mg, Espresso 63mg, Tea 47mg, Soda 40mg).

![Caffeine Log](02-dashboard/11-caffeine-log.png)

## Header

### AI Hub

Wellbeing Summary, Weekly Review, and Journal Insights cards. Without a Gemini key each card shows the latest archived report inline (seeded sample reports).

![AI Hub](03-header/01-ai-hub.png)

### AI Report History

Browse/open/delete archived AI reports of one kind.

![AI Report History](03-header/02-ai-report-history.png)

### Settings

Preferences, API keys, notifications, data management, archived habits, and the "How HabitFlow works" tutorial entry.

![Settings](03-header/03-settings.png)

### How HabitFlow Works — Basics

User-facing reference for habit tracking types and core concepts.

![How HabitFlow Works — Basics](03-header/04-info-basics.png)

### How HabitFlow Works — Advanced

Goal types, bundles, and advanced behaviors.

![How HabitFlow Works — Advanced](03-header/05-info-advanced.png)

### How HabitFlow Works — AI

AI features reference (BYOK Gemini).

![How HabitFlow Works — AI](03-header/06-info-ai.png)

### Archived Habits

Restore or permanently delete archived habits; archive preserves entry history.

![Archived Habits](03-header/07-archived-habits.png)

### User Menu

Display name, hide/show streaks, analytics (beta), sign out / exit demo.

![User Menu](03-header/08-user-menu.png)

## Tracker

### Tracker Grid — Health

Habit grid with day columns. Shows a boolean habit (Morning walk), numeric habit with target (Drink water, 8 glasses), and the Wind-Down Checklist bundle.

![Tracker Grid — Health](04-tracker/01-grid-health.png)

### Checklist Bundle

Wind-Down Checklist bundle with child habits (No screens after 10pm, Evening stretch). Bundle completes when its success rule is met.

![Checklist Bundle](04-tracker/02-checklist-bundle.png)

### Tracker Grid — Fitness

Weekly-frequency habits (Run 3×/week, Strength training 3×/week) and the Daily Movement choice bundle.

![Tracker Grid — Fitness](04-tracker/03-grid-fitness.png)

### Choice Bundle

Daily Movement choice bundle — "Pick one" of Yoga session / Bike ride / Swim satisfies the habit for the day.

![Choice Bundle](04-tracker/04-choice-bundle.png)

### Tracker Grid — Mind

Daily boolean habits (Read 20 minutes, Meditate) with streak display.

![Tracker Grid — Mind](04-tracker/05-grid-mind.png)

### Tracker Grid — Productivity

Deep work block: numeric habit (target 3 hours) scheduled on weekdays only (assigned days).

![Tracker Grid — Productivity](04-tracker/06-grid-productivity.png)

### Numeric Entry Popover

Tapping a numeric habit opens quantity entry with quick-select chips and save/clear actions.

![Numeric Entry Popover](04-tracker/07-numeric-popover.png)

### Habit History

Scrollable month calendar with entry markers plus per-date entry list; select a date to edit/create entries.

![Habit History](04-tracker/09-habit-history.png)

### Edit Habit — Numeric

Add/Edit Habit modal in edit mode for a numeric habit: name, target value + unit, frequency, schedule, category, goal links.

![Edit Habit — Numeric](04-tracker/10-edit-habit-numeric.png)

### Category Picker

Move a habit to a different category.

![Category Picker](04-tracker/11-category-picker.png)

### Bundle Picker

Select an existing bundle to add this habit to.

![Bundle Picker](04-tracker/12-bundle-picker.png)

### Add Habit — Regular

Habit creation: Regular Habit vs Habit Bundle toggle, name, goal type (boolean/numeric), schedule & streak options, category, reminder.

![Add Habit — Regular](04-tracker/13-add-habit.png)

### Add Habit — Bundle Modes

Bundle creation: Checklist ("do multiple items") vs Choice ("any one option satisfies") with sub-habit management.

![Add Habit — Bundle Modes](04-tracker/14-add-habit-bundle.png)

### Today View

Single-day view grouped by category with per-habit completion state.

![Today View](04-tracker/15-today-view.png)

### Schedule (Weekly) View

Week-at-a-glance overview of scheduled habits.

![Schedule (Weekly) View](04-tracker/16-schedule-view.png)

## Routines

### Routines List

Routine cards grouped by category; expanding a card reveals variants, start, edit, and delete.

![Routines List](05-routines/01-routine-list.png)

### Routine Card Expanded

Morning Kickstart expanded: Quick and Standard variants with step counts and estimated durations.

![Routine Card Expanded](05-routines/02-routine-expanded.png)

### Routine Preview

Read-only step list with timers and linked habits before starting the run.

![Routine Preview](05-routines/03-routine-preview.png)

### Routine Runner

Step-by-step execution: instructions, timer (countdown/stopwatch), linked habit logging, next/previous/skip.

![Routine Runner](05-routines/04-routine-runner.png)

### Routine Editor

Title, category, image, variant tabs, step list with summary badges, and "Suggest with AI" (in demo: pre-authored drafts).

![Routine Editor](05-routines/05-routine-editor.png)

### Step Editor Panel

Per-step editing: title, instructions, timer mode, linked habit chips, image, tracking fields.

![Step Editor Panel](05-routines/06-step-editor.png)

## Goals

### Goals — All (Collapsed)

Collapsible category stacks with goal counts. "New Track" and "+" create actions in header.

![Goals — All (Collapsed)](06-goals/01-goals-all-collapsed.png)

### Goals — All (Fitness Expanded)

Fitness stack expanded: goal cards with progress bars plus the Distance Milestones track.

![Goals — All (Fitness Expanded)](06-goals/01b-goals-all-expanded.png)

### Goals — Schedule

Insight calendar with deadline/forecast/milestone event dots, category filter, and date detail panel.

![Goals — Schedule](06-goals/02-goals-schedule.png)

### Goals — Achievements

Three-section gallery: Single wins, Progressive iteration chains with milestone nodes, and Track rows with locked stubs.

![Goals — Achievements](06-goals/03-goals-achievements.png)

### Goal Detail — Cumulative

Cumulative goal with milestone markers: progress charts, entry list, linked habits, deadline forecast.

![Goal Detail — Cumulative](06-goals/04-goal-detail-cumulative.png)

### Goal Detail — One-time (Completed)

A completed one-time goal (Finish a 10K race).

![Goal Detail — One-time (Completed)](06-goals/05-goal-detail-onetime.png)

### Goal Track Detail

Ordered stage goals (Run 40 → 80 → 150 miles) with per-stage states and progress.

![Goal Track Detail](06-goals/06-goal-track-detail.png)

### Create Goal — Cumulative

Step 1: title, Cumulative/One-time type, milestone rows + final target, unit, deadline, category.

![Create Goal — Cumulative](06-goals/07-create-goal-cumulative.png)

### Create Goal — One-time

One-time goal variant: title, event date, category.

![Create Goal — One-time](06-goals/08-create-goal-onetime.png)

### Edit Goal

Modify goal title, milestones, target, deadline, and linked habits.

![Edit Goal](06-goals/09-edit-goal.png)

### Create Goal Track

Create an ordered track of staged goals.

![Create Goal Track](06-goals/10-create-track.png)

### Delete Goal Confirmation

Soft-delete confirmation dialog from the goal detail page.

![Delete Goal Confirmation](06-goals/11-delete-goal-confirm.png)

## Journal

### Journal — Free Write

Freeform journal entry editor.

![Journal — Free Write](07-journal/01-free-write.png)

### Journal — Templates

Template-based guided journaling.

![Journal — Templates](07-journal/02-templates.png)

### Journal — History

Past entries list (seeded with ~10 entries).

![Journal — History](07-journal/03-history.png)

### Journal — AI Review

AI journal insights (seeded sample report shown inline in demo).

![Journal — AI Review](07-journal/04-ai-review.png)

## Tasks

### Tasks

Today and Inbox columns with inline rename, complete, move, and delete actions.

![Tasks](08-tasks/01-tasks.png)

## Insights

### Insights — AI Review

Gemini narrative over wellbeing data (seeded sample shown in demo).

![Insights — AI Review](09-insights/01-ai-review.png)

### Insights — Overview

Discoveries, top correlations, metric averages, heatmap/weekly/multiples.

![Insights — Overview](09-insights/02-overview.png)

### Insights — Correlations

What's helping / what's holding you back (Cohen's d cross-domain correlations).

![Insights — Correlations](09-insights/03-correlations.png)

### Insights — Habits

Habit stats and habit↔wellbeing correlations.

![Insights — Habits](09-insights/04-habits.png)

### Insights — Medications

Adherence and medication↔wellbeing correlations.

![Insights — Medications](09-insights/05-medications.png)

### Insights — Predictions

Linear-trend projections.

![Insights — Predictions](09-insights/06-predictions.png)

## Analytics

### Analytics — Habits

Habit completion statistics and trends.

![Analytics — Habits](10-analytics/01-habits.png)

### Analytics — Routines

Routine completion history and stats.

![Analytics — Routines](10-analytics/02-routines.png)

### Analytics — Goals

Goal progress analytics.

![Analytics — Goals](10-analytics/03-goals.png)

### Analytics — Sleep

Sleep score, consistency, bedtime/wake trends, correlation factors, weekly summary, "Edit a night" list.

![Analytics — Sleep](10-analytics/04-sleep.png)

## Misc

### Roadmap

Future functionality with status chips (In Development / Planned / Exploring); shipped features never appear here.

![Roadmap](11-misc/01-roadmap.png)

### Take a Tour

Guided walkthrough pairing narrative panels with a live read-only preview of the real app.

![Take a Tour](11-misc/02-tour.png)
