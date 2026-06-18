# Changelog

All notable changes to HabitFlowAI, focused on **core milestones** rather than every commit.
This is a personal project with no formal version tags, so entries are grouped by milestone and
dated by when the work landed on `main`. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Current and planned work lives in
[`ROADMAP.md`](ROADMAP.md); the full feature inventory is in [`docs/FEATURES.md`](docs/FEATURES.md).

## Unreleased

### Changed
- **Gemini 3.5 Flash upgrade.** All AI routes (Weekly Review, Journal Review, Journal Summary, Variant
  Suggestions) now call `gemini-3.5-flash` through a shared `src/server/lib/gemini.ts` helper (model id,
  URL builder, response-text extraction). Adapted the request to the Gemini 3 API: `thinkingConfig`
  uses `thinkingLevel: 'low'` (the legacy `thinkingBudget` is no longer sent), and the explicit
  `temperature` overrides were removed since Gemini 3 is tuned for its default (1.0). A non-2xx Gemini
  response now surfaces the upstream status in development-only error `details` for easier diagnosis.
- **AI report history (persisted archive).** Generated Weekly Reviews and Journal Summaries are saved to
  a new `aiReports` collection; Dashboard AI cards expose a wand (generate) and clock (history) icon to
  browse, reopen, or delete past reports.
- **Documentation standardization & repo cleanup.** README slimmed to overview + setup; `docs/FEATURES.md`
  made the canonical, status-tagged feature inventory; added `ROADMAP.md`, `docs/ai-features.md`, a
  CHANGELOG, and a Documentation Standards section in `docs/DOC_INDEX.md`. Decluttered the repo root
  (audits → `docs/audits/`, plans/PR descriptions → `docs/archive/root/`, scratch scripts removed) and
  turned `tasks/todo.md` into a prioritized manual-vs-agent task list.

## 2026-06 — Applied AI & Sleep Analytics

### Added
- **Weekly AI Review** — grounded, schema-constrained weekly review (Summary, Wins, Struggles, Patterns
  with confidence, Recommendations, Data Limitations) built from habit, sleep, mood, journal, and goal data.
- **AI Journal Review** — on-demand, non-clinical review of journal entries over a chosen date range
  (themes, stressors, wins, self-talk patterns, reflection questions, next steps) with crisis-safe handling.
- **Sleep Analytics** — dedicated Sleep dashboard: Apple Watch sleep score, consistency score, sleep
  independence (aid-free streaks), trend charts vs. targets, and a behavior→sleep correlation engine.

### Changed
- Upgraded the Gemini model to **3.5 Flash** across all AI routes.

## 2026-05 — Goal depth & accounts

### Added
- **Cumulative goal milestones** — intermediate stages (e.g. 25/50/75) with celebration markers and
  Achievements-gallery nodes.
- **Goal extension / iteration** — continue a completed goal at a higher target; chains collapse into a
  single Progressive achievement card.
- **Goal trend "Start from" window** — exclude long inactivity gaps from the forecast/required-pace run-rate
  without losing carried-in cumulative totals.
- **Password reset** flow.

### Fixed
- Cumulative goal errors, duplicate-goal root cause, and goal-completion option handling.

## 2026-04 (late) — Habits & achievements

### Added
- **Archive habits** — hide a habit from active tracking while preserving its definition and entries;
  one-click restore from Settings.
- **Achievements gallery** — Single / Progressive / Track sections for completed and in-progress goals.
- **Category color customization** (8-color palette) and **habit entry count** indicators.
- **Task editing** and expanded **activity-heatmap timeframes**.

## 2026-04 (early) — Goal Tracks, Journal & Apple Health

### Added
- **Goal Tracks** — ordered sequences of goals within a category with progress isolation, automatic
  advancement, a track detail view, and track achievements.
- **Journal overhaul** — redesigned templates page, persona-driven prompts, weekly journal summary, and the
  AI journal summary banner (persisted as an entry).
- **Apple Health integration (beta)** — sync steps/calories/sleep/workouts/weight, rule-based auto-logging,
  and bounded backfill (allowlisted users).

## Foundational milestones (M1–M5)

> Early history was consolidated; these architectural milestones predate the current git root and are
> documented in `docs/archive/root/PR_DESCRIPTION_M*.md`.

- **M1 — Canonical Truth Lock.** `habitEntries` is the only behavioral truth; all derived views computed
  at read time. Manual goal logs deprecated (410); evidence endpoints user-scoped.
- **M3 — Routine execution flow.** Per-step completion state and a completion modal where the user chooses
  which habits to log; routine completion alone never creates entries.
- **M4 — iPhone/PWA friction cleanup.** Touch-safety, payload/schema alignment, shared API-client
  consistency, and the `(userId, habitId, dayKey)` unique index migration.
- **M5 — Household identity & scoping.** `X-Household-Id` / `X-User-Id` identity middleware; production
  refuses unauthenticated requests; all data access scoped by user.
