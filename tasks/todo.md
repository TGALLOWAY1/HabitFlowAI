# Wellbeing System Redesign — Phase 1+2+3 vertical slice

Scope (confirmed with user): Phase 1 (Wellbeing card + overview + nav), Phase 2 (Morning
check-in redesign + medications), Phase 3 (Evening check-in redesign + reflection + tags),
plus the data-model foundation. Health Hub (Phase 4), Insights tabs (Phase 5) and the
analytics engine are DEFERRED to follow-up PRs. Medications use a NEW dedicated collection.

## Commits

- [ ] 1. Backend: Medication data model — types, `medications`/`medicationLogs` collections,
       repository, routes, app.ts registration, persistenceClient methods.
- [ ] 2. New 1-5 wellbeing metric keys (mood, motivation, brainFog, confidence, irritability,
       socialBattery, productivity, enjoyment, socialConnection, gratitude, fulfillment) +
       reflection/tag string keys (eveningBestPart, eveningChallenge, dayTags) + contract doc.
- [ ] 3. WellbeingCheckInModal — mode-driven morning ("How do I feel right now?") + evening
       ("How did today go?") with required/optional 5-point sliders + notes + evening
       reflection + day-impact tags.
- [ ] 4. Medication UI — MedicationManagerModal + "Medications Taken Today" in morning check-in.
- [ ] 5. WellbeingCard (replaces DailyCheckInCard): status summary + 4 icons (Morning/Evening/
       Health/Insights) + chevron→WellbeingOverviewModal. HealthHubModal (Sleep + Meds entry
       points). Wire into ProgressDashboard/App. Rename Wellbeing History → Insights.
- [ ] 6. Docs: FEATURES.md, HABITFLOW_UI_ARCHITECTURE.md, InfoModal (Basics/AI/Health tabs).

## Notes / decisions
- Contract: WELLBEING_METRIC_KEYS is additive-locked. New keys are 1-5; existing 0-4 keys
  (focus/stress/satisfaction) keep their scale but render as uniform 5-point "Low to High" sliders.
- energy/anxiety reused at native 1-5.
- Medications scoped by householdId+userId (matches category repo pattern); soft-delete via deletedAt.
