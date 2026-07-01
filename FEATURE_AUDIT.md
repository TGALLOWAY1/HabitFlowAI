# HabitFlow Feature Audit

**Audited:** 2026-07-01 · verified against the actual codebase (routes, services,
repositories, and UI components), not just documentation. This document exists so the
product tour and Demo Mode never imply that unfinished functionality already exists.

**How to read this:**

- ✅ **Implemented** — fully functional today, wired end-to-end (UI → API → MongoDB → derived views).
- 🚧 **Partially Implemented** — works, but with real limitations (gated rollout, missing UI
  surface, or known caveats). The limitation is stated plainly.
- 🗺 **Roadmap** — not yet implemented. Lives in [`ROADMAP.md`](ROADMAP.md); never presented
  in the app as an existing feature.

Related docs: [`docs/FEATURES.md`](docs/FEATURES.md) (canonical shipped-feature inventory),
[`ROADMAP.md`](ROADMAP.md) (future work), [`docs/DEMO_ARCHITECTURE.md`](docs/DEMO_ARCHITECTURE.md)
(how the public demo works).

---

## ✅ Implemented

### Habits

Everything below is verified working end-to-end (`src/server/routes/habits.ts`,
`src/components/TrackerGrid.tsx`, `src/components/AddHabitModal.tsx`, and related services):

- Create/edit/delete habits with **boolean** (done/not-done) and **quantity** (numeric value + unit) tracking types
- Scheduling: specific days of week, times-per-week, required-days-per-week
- Color-coded categories with drag-and-drop reorder and an 8-color palette
- Quick toggle from tracker grid, day view, and weekly schedule view
- **Habit bundles** — Checklist bundles (success rule: all / any / count / percent) and Choice bundles (pick one alternative per day), with full membership lifecycle (move in/out, end, archive)
- Habit↔goal linking (one habit can feed multiple goals) and habit↔routine linking (routine completion auto-logs habits)
- Streaks (current + longest), computed live from entries — never stored
- Heatmaps: year/90-day/30-day overall, plus per-category mini heatmaps
- Archiving with one-click restore (entries and history preserved); goal-linked deletion shows an Archive-vs-Delete chooser that preserves historical goal progress either way
- Per-habit history modal with edit/create of past entries

**Architectural note (and the reason derived views are trustworthy):** `habitEntries` is the
single source of truth. Streaks, day summaries, progress, and goal contributions are computed
from entries at read time — there is no stored completion state that can drift.

### Goals & Goal Tracks

Verified in `src/server/routes/goals.ts`, `src/server/services/` (progress derivation),
`src/pages/goals/`:

- **Cumulative goals** (numeric target, count or sum aggregation) and **one-time goals** (binary milestone)
- Progress derived 100% from linked habit entries; **completion reconciliation** — if entries are edited/deleted so progress drops below target, the goal automatically reopens
- Milestones on cumulative goals (server-validated, max 20), each with its own celebration
- Trend analysis: actual vs. required pace with an adjustable "Start from" window (excludes inactivity gaps without losing cumulative history)
- Weekly summary, day-by-day contribution list, cumulative chart (same server-derived series as the headline total)
- Removed-habit contributors surfaced by name (soft-delete preserves attribution)
- **Goal tracks**: ordered goal sequences with automatic advancement, date-windowed progress isolation (shared habits don't leak progress forward), and track achievements
- Goal extension (continuation goals carry prior targets as pre-acknowledged milestones)
- Achievements gallery (Single / Progressive / Track sections), badges, schedule calendar view

### Routines

Verified in `src/server/routes/routines.ts`, `src/components/RoutineRunnerModal.tsx`,
`src/components/RoutineEditorModal.tsx`:

- Multi-step routines with variants (e.g. Quick / Standard / Deep), variant copy
- Steps with instructions, countdown/stopwatch timers, and images (JPEG/PNG/WebP up to 5MB, stored server-side)
- Guided step-by-step runner with progress indicator
- Linked-habit auto-logging on completion
- Pinned routines on the dashboard, completion logs with timestamps
- AI variant suggestions (see AI section)

### Tasks

Verified in `src/server/routes/tasks.ts`, `src/pages/TasksPage.tsx`, `src/context/TaskContext.tsx`:

- One-off to-dos in **Today** and **Inbox** lists, move between lists, inline title edit, complete, soft-delete, auto-sorting (active first, newest first)
- Intentionally simple — a clear finish line separate from recurring habits

### Journal

Verified in `src/server/routes/journal.ts`, `src/components/Journal/`, `src/data/journalTemplates.ts`:

- Free-write plus **11 structured templates** across 6 categories, each with a persona and tone (e.g. "The Strategic Coach"); some templates offer optional deeper questions
- Upsert-by-day: same template + same day updates the existing entry (idempotent daily check-ins)
- Entry history (last 90 days) with edit/delete
- AI weekly journal summary banner (see AI section)

### Wellbeing & Health Tracking

Verified in `src/server/routes/wellbeingEntries.ts`, `medications.ts`, `supplements.ts`,
`symptoms.ts`, `src/components/wellbeing/`:

- **Morning check-in** (mood, energy, anxiety, motivation, focus + optional metrics, notes, medications-taken list) and **evening check-in** (satisfaction, productivity, mood, stress, enjoyment + reflection and day-impact tags)
- **Health Hub**: medications (dose, schedule, dosage timeline, daily taken toggle), supplements, symptoms (1–5 severity), daily weight, daily caffeine (with drink presets)
- **Sleep entry form**: bedtime/wake times, duration, quality, Apple Watch sleep score (manually entered), latency, interruptions, sleep aids, morning energy; any past night editable

### Sleep Analytics

Verified in `src/server/services/sleepAnalyticsService.ts` (~500 lines of real statistics):

- Headline metrics with sample sizes and period-over-period trends
- **Sleep consistency score** (circular standard deviation of bed/wake clock times)
- Sleep independence (aid-free nights, streaks, trend)
- Bedtime/wake/duration trend charts vs. configurable targets
- **Correlation engine**: ranks behaviors (phone in bed, caffeine, wind-down, any habit…) by measured effect on sleep outcomes using Cohen's d with sample-size guards — always framed as correlation, never causation

### Analytics & Insights

Verified in `src/server/services/analyticsService.ts`, `insightsService.ts`,
`correlationEngine.ts`:

- Habit analytics (consistency score, completion rate, best day, trend direction), streak analytics, trend charts, category breakdown, activity heatmaps, routine analytics, goal analytics
- **Insights engine**: cross-domain correlations (habits/medications/supplements/symptoms ↔ wellbeing metrics) using present/absent day-group splits and Cohen's d effect size, with minimum sample-size (5 days/group) and minimum effect-size (|d| ≥ 0.2) guards
- Linear-trend predictions per wellbeing metric (current → projected, change/week, confidence)
- All computed from canonical entries at read time; a short-lived in-memory cache only deduplicates repeated computation

### AI Features (Gemini, bring-your-own-key)

All of these make **real Gemini API calls** — none are templates or mocks. Verified in
`src/server/routes/aiWeeklyReview.ts`, `aiJournalReview.ts`, `aiJournalSummary.ts`,
`aiInsightsReview.ts`, `aiVariantSuggestion.ts`, `aiReports.ts`. The user's Gemini API key
lives in browser localStorage, is sent per-request, and is never persisted server-side.

- **Weekly AI Review** — the server aggregates a week of real data (per-habit days-logged vs. cadence, sleep, mood, journal consistency, active goals) into *observed facts*, then requests a schema-constrained review: Week at a Glance, Facts, Patterns (with low/medium/high confidence), Journal Themes, Wins, Areas for Attention, Recommendations, and honest **Data Limitations** for thin weeks. The prompt forbids inventing data.
- **AI Journal Review** — structured review of a chosen date range: Overview, Emotional Themes, Recurring Stressors, Self-Talk Patterns (with paraphrased evidence and confidence), Wins, Reflection Questions, Suggested Next Steps. Deliberately non-clinical: no diagnoses, no long verbatim quotes; entries suggesting crisis surface a gentle support notice.
- **AI Journal Summary** — auto-generated weekly summary shown as a dismissible banner, persisted into journal history
- **Insights AI Review** — plain-language narrative grounded *only* in the already-computed correlations/predictions/adherence numbers
- **AI Variant Suggestions** — routine variants generated from title + existing steps
- **AI Report History** — every generated review/summary archived per-user; re-reading history never spends an API call

### Platform

- Session-cookie auth with invite-code registration, password reset via email (Resend)
- Household + user identity model; every record user-scoped; all deletes are soft deletes (`deletedAt`)
- Timezone-aware DayKey (client IANA timezone, fallback America/New_York) as the aggregation boundary
- Genuinely responsive: one codebase, Tailwind breakpoints, mobile bottom tab bar, safe-area insets, 44px touch targets — no separate mobile build
- Optimistic UI with backend sync; PWA manifest + service worker in production
- 40+ integration test suites (Vitest + Supertest + mongodb-memory-server)

---

## 🚧 Partially Implemented

Be precise with these — each one works, but with a real limitation:

| Feature | What works | The limitation |
|---|---|---|
| **Apple Health integration** | Sync endpoint, per-habit health rules (auto-log/suggest when a metric crosses a threshold), suggestion banner, bounded backfill (7/30/90 days), auto-logged entry indicators — all wired end-to-end (`src/server/routes/health.ts`, `habitHealthRules.ts`, `healthSuggestions.ts`) | **Beta, email-allowlisted** (single user). Requires an **external sync bridge** to move data out of Apple Health — the bridge is not part of this repo. Not available to general users. |
| **Analytics page** (`?view=analytics`) | All four tabs (Habits, Routines, Goals, Sleep) render real derived data | **Beta, email-gated** client-side (`src/pages/AnalyticsPage.tsx`); the demo identity can view it. Promotion into primary nav is an in-progress roadmap item. |
| **Insights page** | Full six-tab insights engine (Overview, Correlations, Habits, Medications, Predictions, AI Review) with real statistics | **Beta, email-gated** client-side (`src/pages/WellbeingHistoryPage.tsx`); the demo identity can view it. |
| **Multi-user households** | Identity model (household + user) exists throughout the API and data layer | **No UI** for invites, sharing, or per-user views. Single-user in practice. Roadmap item. |
| **Personas (app-level)** | Persona definitions exist (`src/shared/personas/`); journal template personas are fully functional | App-level persona *switching* is disabled — `getActivePersonaConfig()` always returns the default. Roadmap ("Persona Switching UX"). |
| **Habit description field** | Stored on the model | Never displayed or editable in the UI. |
| **Bundle membership day-of-week windows** | Supported by the API (`daysOfWeek` on memberships) | No UI to configure it. |

---

## 🗺 Roadmap

Not yet implemented. Source of truth: [`ROADMAP.md`](ROADMAP.md). Never presented in the app
as existing functionality — the in-app Roadmap page (`?view=roadmap`) mirrors this list with
explicit status labels.

| Item | Status | Notes |
|---|---|---|
| Analytics page promotion into primary nav | In Development | Replacing Tasks in primary nav |
| Historical linkage / archive remediation | In Development | Data-integrity hardening for deletion/unlink flows |
| Path-based shareable URLs | Planned | Currently query-string routing (`?view=...`) |
| Multi-user household UI | Planned | Invites, shared habits, per-user views on the existing identity model |
| Pluggable AI providers (Anthropic / OpenAI) | Planned | Currently Gemini BYOK only |
| Journal questionnaire templates | Planned | Guided check-ins from reusable prompt sets |
| Dictation journal mode | Planned | Voice-first journaling |
| Native iOS/Android wrappers | Exploring | Real push notifications; currently responsive web only |
| Skills / skill tree | Exploring | Deferred from V1 prioritization |
| Persona switching UX | Exploring | Smoother coaching-persona switching |
| Identity prompts & coaching | Exploring | Identity-based coaching direction |

---

## What this means for the demo & tour

- Everything the tour shows inside the live demo is **✅ Implemented** — real screens backed by real API responses derived from seeded entries.
- **🚧 Partial** items appear in the tour only with their limitation stated (e.g. Apple Health is described as beta and is not shown as a working screen).
- **🗺 Roadmap** items appear only on the Roadmap page and roadmap-labeled callouts, never intermixed with implemented features.
