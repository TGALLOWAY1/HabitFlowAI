# Applied AI Features

Implementation detail for HabitFlowAI's applied-AI surfaces. The user-facing inventory of
AI features lives in [`FEATURES.md`](FEATURES.md); this document covers the engineering:
data flow, grounding strategy, and the routes/contracts involved.

All AI features are **BYOK Gemini** — the user supplies their own API key (stored in
`localStorage`, never persisted server-side) and the features are generated on demand with no
new dependencies and no server-side keys.

---

## Weekly AI Review

The **Weekly AI Review** is HabitFlow's single, comprehensive weekly report. It turns a week of
structured habit, sleep, mood, journal, and goal data into a feedback artifact that both tells the
story of the week (a human-readable **Week at a Glance** narrative) and provides grounded analysis.
The system deliberately separates the **narrative recap**, **observed facts**, **inferred patterns**,
**journal themes**, **wins**, **areas for attention**, and **recommendations** so the model produces
useful coaching without hallucinating advice. (It consolidates the former standalone AI Weekly Summary,
whose narrative recap is now the Week at a Glance section.)

**Data / AI flow:**

```
Dashboard card (this week / last week)
   → POST /api/ai/weekly-review  (Gemini BYOK)
      → collect one week, scoped by (householdId, userId):
          habitEntries · wellbeingEntries (sleep & mood) · journalEntries · goals
      → aggregate into compact OBSERVED FACTS
          per-habit days-logged vs. cadence · per-day breakdown (habits/sleep/mood/journaled)
          weekly wellbeing averages · journal consistency · active goals
      → Gemini 2.5 Flash with a JSON responseSchema + grounding rules
      → validate & normalize → typed WeeklyAIReview
   → render: Week at a Glance · Facts · Patterns (confidence) · Journal Themes ·
             Wins · Areas for Attention · Recommendations · Data Limitations
```

**Grounding guarantees:**
- Only facts derived from the database are sent to the model — no raw collections, no free-form dumps.
- The prompt forbids inventing data and requires facts, wins, and areas for attention to cite specific numbers.
- The server (not the model) owns the week boundaries; a response schema enforces a stable shape.
- Thin weeks surface honest **Data Limitations** instead of low-evidence patterns; pattern
  confidence (`low`/`medium`/`high`) is tied to how much supporting data exists.

**Implementation notes:**
- Server route: [`src/server/routes/aiWeeklyReview.ts`](../src/server/routes/aiWeeklyReview.ts);
  shared contract: [`src/shared/weeklyAiReview.ts`](../src/shared/weeklyAiReview.ts).
- Client + UI: `fetchWeeklyAIReview` in [`src/lib/geminiClient.ts`](../src/lib/geminiClient.ts) and
  [`src/components/dashboard/WeeklyAIReviewCard.tsx`](../src/components/dashboard/WeeklyAIReviewCard.tsx).

---

## AI Journal Review

The **AI Journal Review** transforms unstructured journal entries into structured, grounded
feedback. The user picks a date range and gets a reflection aid — emotional themes, recurring
stressors, wins, self-talk patterns, reflection questions, and small next steps — built entirely
from their own writing.

**What user data it uses:** only the user's own `journalEntries` within the selected range
(scoped by `userId`). AI-generated summaries are excluded so the review reflects what the user
actually wrote. No habit, sleep, or wellbeing data is included.

**Data / AI flow:**

```
Journal → "AI Review" tab (last 7/30 days or custom range)
   → POST /api/ai/journal-review  (Gemini BYOK)
      → fetch journalEntries for [rangeStart, rangeEnd], scoped by userId
      → resolve template prompt IDs → readable questions; paraphrasable Q/A context
      → Gemini 2.5 Flash with a JSON responseSchema + grounding & safety rules
      → validate & normalize → typed AIJournalReview
   → render: Overview · Emotional Themes · Recurring Stressors · Wins ·
             Self-Talk Patterns · Reflection Questions · Suggested Next Steps · Data Limitations
```

**How the output is grounded:**
- Only the user's own entries for the chosen range are sent — no other collections, no free-form dumps.
- The prompt separates **observed evidence** from **inferred themes** from **suggested next steps**,
  forbids inventing facts, and forbids long verbatim quotes (paraphrase only).
- The server (not the model) owns the range boundaries; a response schema enforces a stable shape.
- Theme/stressor confidence (`low`/`medium`/`high`) is tied to how much evidence exists. Sparse
  ranges are flagged with a low-data warning and honest **Data Limitations** instead of fabricated patterns.

**How safety / tone are handled:**
- The review is explicitly **non-clinical**: the prompt bans diagnoses and labels
  ("you are depressed", "this indicates trauma") and requires tentative language
  ("your entries suggest…", "this may be worth reflecting on…").
- If entries suggest self-harm or crisis, the model returns a gentle `crisisNotice` that encourages
  reaching out to trusted people or emergency/crisis resources — it does not attempt crisis counseling.
- The empty state guides the user to write or widen the range; nothing is generated when there is no data.

**Why it is interesting as an AI engineering feature:** it shows applied LLM integration with
**schema-constrained structured output**, **strict grounding** in user-selected data, explicit
**evidence/inference/action separation**, **confidence calibration**, **low-data + safety handling**,
and a polished, mobile-friendly UI — generated on demand, with no extra dependencies or server-side keys.

**Implementation notes:**
- Server route: [`src/server/routes/aiJournalReview.ts`](../src/server/routes/aiJournalReview.ts);
  shared contract: [`src/shared/aiJournalReview.ts`](../src/shared/aiJournalReview.ts).
- Client + UI: `fetchJournalReview` in [`src/lib/geminiClient.ts`](../src/lib/geminiClient.ts) and
  [`src/components/Journal/JournalReviewPanel.tsx`](../src/components/Journal/JournalReviewPanel.tsx).

---

## Other AI surfaces

- **AI Journal Summary** — auto-generated weekly journal summary shown as a dismissible banner and
  persisted as a journal entry in history.
- **AI Report History** — generated Weekly Reviews and Journal Summaries are archived to the
  `aiReports` collection (per-user, soft-deleted). The Dashboard cards expose a wand icon to
  generate and a clock icon to browse, reopen, or delete past reports. Routes:
  `GET /api/ai/reports`, `GET /api/ai/reports/:id`, `DELETE /api/ai/reports/:id`
  ([`src/server/routes/aiReports.ts`](../src/server/routes/aiReports.ts),
  [`src/server/repositories/aiReportRepository.ts`](../src/server/repositories/aiReportRepository.ts)).
- **AI Variant Suggestions** — generate routine variants from a routine's title and existing steps.
- **Persona-Driven Journaling** — template personas guide journaling prompts and tone.
