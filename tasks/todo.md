# Wellbeing System Redesign — Phase 1+2+3 vertical slice

Scope (confirmed with user): Phase 1 (Wellbeing card + overview + nav), Phase 2 (Morning
check-in redesign + medications), Phase 3 (Evening check-in redesign + reflection + tags),
plus the data-model foundation. Health Hub (Phase 4), Insights tabs (Phase 5) and the
analytics engine are DEFERRED to follow-up PRs. Medications use a NEW dedicated collection.

## Commits

- [x] 1. Backend: Medication data model — types, `medications`/`medicationLogs` collections,
       repository, routes, app.ts registration, persistenceClient methods.
- [x] 2. New 1-5 wellbeing metric keys + reflection/tag string keys + contract doc.
- [x] 3. WellbeingCheckInModal — mode-driven morning + evening with sliders, notes,
       reflection, day-impact tags.
- [x] 4. Medication UI — MedicationManagerModal + "Medications Taken Today" in morning check-in.
- [x] 5. WellbeingCard (replaces DailyCheckInCard) + WellbeingOverviewModal + HealthHubModal;
       wired into ProgressDashboard/App; renamed Wellbeing History → Insights; removed old
       DailyCheckInCard/Modal.
- [x] 6. Docs: FEATURES.md, HABITFLOW_UI_ARCHITECTURE.md, InfoModal.

## Verification
- `npm run build` (tsc -b + vite build): GREEN.
- `npm run lint:beta`: 0 errors (pre-existing `any` warnings only).
- `npm run test:beta`: 4 suites pass (20 tests); 5 suites fail ONLY because
  mongodb-memory-server cannot download its Mongo binary in this sandbox (HTTP 403) —
  environmental, not a code regression.

## Phase 4 — Health Hub (DONE)

Hybrid data model (confirmed with user): simple daily numbers reuse `wellbeingEntries`
metric keys; user-defined lists get medication-style definition+log collections.

- [x] 1. Backend keys: `weight`, `caffeineMg` added to
       `WELLBEING_METRIC_KEYS` + documented in the wellbeing key data contract.
       (Alcohol excluded per user — not tracked.)
- [x] 2. Symptoms backend: `symptoms`/`symptomLogs` collections, repository, routes,
       app.ts registration, persistenceClient methods, repository test.
- [x] 3. Supplements backend: `supplements`/`supplementLogs` (medication-style), repository,
       routes, app.ts registration, persistenceClient methods, repository test.
- [x] 4. Health factor UI: generic `HealthFactorLogModal` + Weight/Caffeine wired
       into Health Hub (caffeine quick-add presets).
- [x] 5. Symptoms UI: `SymptomManagerModal` (CRUD + 1–5 severity) wired into Health Hub.
- [x] 6. Supplements UI: `SupplementManagerModal` (CRUD + taken toggle) wired into Health Hub;
       all trackers live, "Coming soon" block removed.
- [x] 7. Docs: FEATURES.md, HABITFLOW_UI_ARCHITECTURE.md, InfoModal (Advanced → Health Hub).

Verification: `npm run build` GREEN; `npm run lint:beta` 0 errors (pre-existing `any`
warnings only).

## Phase 5 — Insights tabs + analytics engine (DONE)

Direction (confirmed with user): all six tabs in one PR; keep the page beta-gated;
reuse the Sleep Analytics Cohen's d correlation approach (not literal Pearson); fold
the existing heatmap/weekly/multiples wellbeing views into the new Overview tab.

- [x] 1. Backend: shared `correlationEngine.ts` (Cohen's d + present/absent split,
       extracted from sleepAnalyticsService) + `insightsService.ts` (factor↔outcome
       correlations across habits/medications/supplements/symptoms/behavioral factors,
       linear-trend predictions, discoveries/milestones, medication adherence). Unit tests.
- [x] 2. Backend: `routes/insights.ts` — GET /api/insights/{overview,correlations,habits,
       medications,predictions}, cached via analyticsCache; registered in app.ts.
- [x] 3. Backend: `routes/aiInsightsReview.ts` — POST /api/ai/insights-review (Gemini BYOK,
       grounded on computed insights); registered in app.ts.
- [x] 4. Frontend: `lib/insightsClient.ts` — typed fetch methods for all endpoints + AI review.
- [x] 5. Frontend: tabbed Insights shell (restructured WellbeingHistoryPage, beta gate kept)
       + Overview tab folding in the existing heatmap/weekly/multiples views.
- [x] 6. Frontend: Correlations + Predictions tabs.
- [x] 7. Frontend: Habits + Medications tabs (Habits reuses habit analytics summary).
- [x] 8. Frontend: AI Review tab (BYOK flow mirroring WeeklyAIReviewCard).
- [x] 9. Docs: FEATURES.md, HABITFLOW_UI_ARCHITECTURE.md, InfoModal (AI tab).

Verification: `npm run build` (tsc -b + vite) GREEN; new unit tests pass; sleep tests
unchanged. AI Review is generate-on-demand (not archived) for this phase.

Note: "milestone alerts / personal discoveries" are surfaced as the Overview tab's
Discoveries section (correlation/trend/coverage-milestone derived).
