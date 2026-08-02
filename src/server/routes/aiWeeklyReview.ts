/**
 * Weekly AI Review Route (Gemini BYOK)
 *
 * POST /api/ai/weekly-review
 *
 * Gathers a single week of the user's real data (habit entries, sleep & mood
 * from wellbeing check-ins, journal entries, and goals), aggregates it into
 * a compact set of *observed facts*, and asks Gemini to produce a grounded,
 * structured weekly review.
 *
 * Grounding strategy:
 *  - Only aggregated facts derived from the database are sent to the model.
 *  - The prompt explicitly separates observed facts, inferred patterns, and
 *    suggestions, and instructs the model never to invent data.
 *  - The week boundaries in the response are set by the server, not the model.
 *  - A structured JSON response schema is enforced so the UI gets a stable shape.
 */

import type { Request, Response } from 'express';
import { startOfWeek, endOfWeek, parseISO, format, getDay } from 'date-fns';
import { getRequestIdentity } from '../middleware/identity';
import { getEntriesByUser } from '../repositories/journal';
import { getWellbeingEntries } from '../repositories/wellbeingEntryRepository';
import { getGoalsByUser } from '../repositories/goalRepository';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getHabitEntriesByUserInRange } from '../repositories/habitEntryRepository';
import { saveAIReport } from '../repositories/aiReportRepository';
import { GEMINI_MODEL, buildGeminiUrl, GEMINI_THINKING_CONFIG, extractGeminiText } from '../lib/gemini';
import { resolveTimeZone, getNowDayKey } from '../utils/dayKey';
import { isValidDayKey } from '../../domain/time/dayKey';
import {
  getWeeklyQuotaTargetOnDay,
  isHabitScheduledOnDay,
  matchesHabitScheduleOnDay,
} from '../../domain/habits/schedule';
import { buildDayStatesByHabit } from '../services/analyticsService';
import type {
  WeeklyAIReview,
  WeeklyReviewPattern,
  WeeklyReviewRecommendation,
  ReviewConfidence,
} from '../../shared/weeklyAiReview';

interface WeeklyReviewRequest {
  geminiApiKey: string;
  /** Any day within the desired week (YYYY-MM-DD). Defaults to the current week. */
  weekStart?: string;
  timeZone?: string;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Wellbeing metrics worth surfacing to the model, with friendly labels. */
const WELLBEING_LABELS: Record<string, string> = {
  appleSleepScore: 'Sleep score (0-100)',
  sleepScore: 'Sleep score',
  sleepQuality: 'Sleep quality',
  sleepDurationMinutes: 'Sleep duration (minutes)',
  energy: 'Energy',
  calm: 'Calm',
  stress: 'Stress',
  anxiety: 'Anxiety',
  lowMood: 'Low mood',
  depression: 'Depression',
  focus: 'Focus',
  satisfaction: 'Satisfaction',
  readiness: 'Readiness',
  recovery: 'Recovery',
};

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * POST /api/ai/weekly-review
 */
export async function postWeeklyReview(req: Request, res: Response): Promise<void> {
  try {
    const { geminiApiKey, weekStart: requestedWeek, timeZone: tzInput } =
      req.body as WeeklyReviewRequest;

    if (!geminiApiKey || typeof geminiApiKey !== 'string' || geminiApiKey.trim().length < 10) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A valid Gemini API key is required' },
      });
      return;
    }

    const { userId, householdId } = getRequestIdentity(req);
    const timeZone = resolveTimeZone(typeof tzInput === 'string' ? tzInput : undefined);

    // ---- Resolve the week window (Monday..Sunday) ----
    const referenceKey =
      typeof requestedWeek === 'string' && isValidDayKey(requestedWeek)
        ? requestedWeek
        : getNowDayKey(timeZone);
    const refDate = parseISO(referenceKey);
    const weekStartDate = startOfWeek(refDate, { weekStartsOn: 1 });
    const weekEndDate = endOfWeek(refDate, { weekStartsOn: 1 });
    const startDayKey = format(weekStartDate, 'yyyy-MM-dd');
    const endDayKey = format(weekEndDate, 'yyyy-MM-dd');

    const weekDayKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + i);
      weekDayKeys.push(format(d, 'yyyy-MM-dd'));
    }

    // ---- Collect raw data for the week ----
    const [habits, habitEntries, allJournal, wellbeingEntries, goals] = await Promise.all([
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUserInRange(householdId, userId, startDayKey, endDayKey),
      getEntriesByUser(userId, { startDate: startDayKey, endDate: endDayKey }),
      getWellbeingEntries({ userId, startDayKey, endDayKey }),
      getGoalsByUser(householdId, userId),
    ]);

    const activeHabits = habits.filter((habit) => !habit.archived && !habit.deletedAt);
    const habitNameMap = new Map<string, string>();
    for (const h of habits) habitNameMap.set(h.id, h.name);

    // ---- Per-habit weekly aggregation (canonical completed days vs. target) ----
    // Bundle parents are derived from children and do not own entries. The
    // review reports leaf habits so a parent is not falsely described as 0/7.
    const dayStatesByHabit = buildDayStatesByHabit(habitEntries, activeHabits, timeZone);
    const isReviewOpportunity = (habit: typeof activeHabits[number], dayKey: string) => (
      isHabitScheduledOnDay(habit, dayKey, timeZone)
      || (
        dayStatesByHabit.get(habit.id)?.has(dayKey) === true
        && matchesHabitScheduleOnDay(habit, dayKey)
      )
    );
    const reviewHabits = activeHabits.filter((habit) => {
      if (habit.type === 'bundle') return false;
      return weekDayKeys.some(dayKey => isReviewOpportunity(habit, dayKey));
    });

    const habitFacts = reviewHabits.map((habit) => {
      const completedDays = weekDayKeys.filter(dayKey => (
        isReviewOpportunity(habit, dayKey)
        && dayStatesByHabit.get(habit.id)?.get(dayKey)?.completed
      ));
      const weekEndQuota = getWeeklyQuotaTargetOnDay(habit, endDayKey);
      const targetDays = weekEndQuota ?? weekDayKeys.filter(
        dayKey => isReviewOpportunity(habit, dayKey),
      ).length;
      return {
        name: habit.name,
        daysCompleted: completedDays.length,
        targetDays,
        cadence: weekEndQuota != null ? `${weekEndQuota}x/week` : 'scheduled days',
      };
    });

    // ---- Per-day breakdown (enables correlation patterns) ----
    const journalDays = new Set(allJournal.map((j) => j.date));
    const wellbeingByDay = new Map<string, Map<string, number[]>>();
    for (const w of wellbeingEntries) {
      if (typeof w.value !== 'number') continue;
      if (!WELLBEING_LABELS[w.metricKey]) continue;
      if (!wellbeingByDay.has(w.dayKey)) wellbeingByDay.set(w.dayKey, new Map());
      const m = wellbeingByDay.get(w.dayKey)!;
      if (!m.has(w.metricKey)) m.set(w.metricKey, []);
      m.get(w.metricKey)!.push(w.value);
    }

    const completedHabitIdsByDay = new Map<string, Set<string>>();
    for (const habit of reviewHabits) {
      const dayMap = dayStatesByHabit.get(habit.id);
      if (!dayMap) continue;
      for (const dayKey of weekDayKeys) {
        if (!isReviewOpportunity(habit, dayKey)) continue;
        if (!dayMap.get(dayKey)?.completed) continue;
        const completedHabitIds = completedHabitIdsByDay.get(dayKey) ?? new Set<string>();
        completedHabitIds.add(habit.id);
        completedHabitIdsByDay.set(dayKey, completedHabitIds);
      }
    }

    const habitDataDays = new Set<string>();
    for (const entry of habitEntries) {
      if (isValidDayKey(entry.dayKey)) habitDataDays.add(entry.dayKey);
    }

    const dayBreakdown = weekDayKeys.map((dayKey) => {
      const weekday = WEEKDAY_NAMES[getDay(parseISO(dayKey))];
      const habitsCompleted = completedHabitIdsByDay.get(dayKey)?.size ?? 0;
      const metrics: Record<string, number> = {};
      const dayMetrics = wellbeingByDay.get(dayKey);
      if (dayMetrics) {
        for (const [key, vals] of dayMetrics) {
          const a = avg(vals);
          if (a !== null) metrics[WELLBEING_LABELS[key]] = a;
        }
      }
      return {
        date: dayKey,
        weekday,
        habitsCompleted,
        journaled: journalDays.has(dayKey),
        wellbeing: Object.keys(metrics).length > 0 ? metrics : undefined,
      };
    });

    // ---- Weekly wellbeing averages ----
    const wellbeingTotals = new Map<string, number[]>();
    for (const w of wellbeingEntries) {
      if (typeof w.value !== 'number' || !WELLBEING_LABELS[w.metricKey]) continue;
      if (!wellbeingTotals.has(w.metricKey)) wellbeingTotals.set(w.metricKey, []);
      wellbeingTotals.get(w.metricKey)!.push(w.value);
    }
    const wellbeingAverages: Array<{ metric: string; average: number; daysRecorded: number }> = [];
    for (const [key, vals] of wellbeingTotals) {
      const a = avg(vals);
      if (a !== null) {
        wellbeingAverages.push({ metric: WELLBEING_LABELS[key], average: a, daysRecorded: vals.length });
      }
    }

    // ---- Journal facts (consistency-focused, with short snippets) ----
    const journalFacts = allJournal.map((j) => {
      const snippet = Object.values(j.content)
        .filter((v) => typeof v === 'string' && v.trim().length > 0)
        .join(' • ')
        .slice(0, 280);
      return { date: j.date, template: j.templateId, snippet };
    });

    // ---- Goal facts ----
    const goalFacts = goals
      .filter((g) => !g.completedAt)
      .map((g) => ({
        title: g.title,
        type: g.type,
        target: g.targetValue ?? null,
        unit: g.unit ?? null,
        deadline: g.deadline ?? null,
        linkedHabits: (g.linkedHabitIds ?? []).map((id) => habitNameMap.get(id) ?? id),
      }));

    const wellbeingDaysRecorded = new Set(
      wellbeingEntries.filter((w) => WELLBEING_LABELS[w.metricKey]).map((w) => w.dayKey),
    ).size;

    const observedFacts = {
      weekStart: startDayKey,
      weekEnd: endDayKey,
      habits: habitFacts,
      dayByDay: dayBreakdown,
      wellbeingAverages,
      journal: journalFacts,
      goals: goalFacts,
      totals: {
        activeHabits: reviewHabits.length,
        daysWithHabitData: habitDataDays.size,
        journalEntries: journalFacts.length,
        wellbeingDaysRecorded,
      },
    };

    // ---- Build the grounded prompt ----
    const prompt = `You are an analytical wellness coach for a habit-tracking app called HabitFlow.
You will be given OBSERVED FACTS derived directly from one user's database for a single week.
Produce a single, comprehensive weekly review that both tells the story of the week AND provides
evidence-based analysis. Fill in every section of the schema.

SECTIONS (fill each):
1. "summary" — "Week at a Glance": a natural-language narrative that tells the story of the week
   in 1-3 short paragraphs. Cover overall consistency, notable progress, mood/energy trends, and the
   single most notable success. Read naturally. Do NOT include recommendations here.
2. "facts" — ONLY objective, measurable observations directly supported by the data
   (e.g. "Completed 24 of 28 planned habits (86%).", "Journaled on 5 of 7 days.",
   "Average sleep score was 71."). No interpretation, no speculation, no recommendations.
3. "patterns" — trends and relationships supported by the data. Use tentative language
   ("appears associated with", "correlates with", "may indicate"). Never claim causation.
4. "journalThemes" — recurring topics, emerging themes, frequently mentioned challenges, and
   emotional tone/trends drawn ONLY from the journal snippets. Focus on recurring themes across
   entries, not individual entries. If there are no journal entries, return an empty array.
5. "wins" — the most meaningful accomplishments. Encouraging without exaggeration. Cite specifics.
6. "areasForAttention" — issues, risks, or recurring challenges. Observational, non-judgmental.
7. "recommendations" — a SMALL number of actionable suggestions (MAXIMUM 5, prefer 3-5),
   high-impact and grounded in the observed data.

STRICT GROUNDING RULES:
- Use ONLY the observed facts below. Never invent habits, numbers, sleep data, moods, or events that are not present.
- Clearly distinguish facts (section 2) from inferred patterns (section 3) from recommendations (section 7).
- In "patterns", set "confidence" to "low", "medium", or "high" based ONLY on how much supporting data exists. If there are few data points, use "low".
- If a category has little or no data (e.g. no journal entries, no sleep/mood data), DO NOT fabricate content about it. Instead add an honest note to "dataLimitations" and leave that section's array short or empty.
- Wins, facts, and areasForAttention must cite specific numbers from the data (e.g. "logged X 5 of 7 days").
- Recommendations must be small and behaviorally realistic (e.g. "move your workout earlier on Thursdays"), never generic ("be more disciplined").
- Provide 2-5 facts, 2-5 wins, 2-5 areasForAttention when the data supports them; fewer is fine when it does not.

OBSERVED FACTS (JSON):
${JSON.stringify(observedFacts, null, 2)}

Notes for interpretation:
- "daysCompleted" vs "targetDays" reflects how often each habit reached its completion target on a scheduled day this week. Partial numeric progress is not completion.
- "dayByDay" lets you look for relationships (e.g. sleep score vs. next-day habits completed, mood vs. journaling).
- Wellbeing values are on the user's own check-in scales; treat them as relative within this week, not absolute.
- "journal[].snippet" holds short excerpts of what the user wrote; use these for "journalThemes" only.

Return the review as JSON matching the provided schema.`;

    const responseSchema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        facts: { type: 'array', items: { type: 'string' } },
        patterns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              evidence: { type: 'string' },
              confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
            required: ['title', 'evidence', 'confidence'],
          },
        },
        journalThemes: { type: 'array', items: { type: 'string' } },
        wins: { type: 'array', items: { type: 'string' } },
        areasForAttention: { type: 'array', items: { type: 'string' } },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              reason: { type: 'string' },
              suggestedAction: { type: 'string' },
            },
            required: ['title', 'reason', 'suggestedAction'],
          },
        },
        dataLimitations: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'summary',
        'facts',
        'patterns',
        'journalThemes',
        'wins',
        'areasForAttention',
        'recommendations',
        'dataLimitations',
      ],
    };

    // ---- Call Gemini (structured JSON output) ----
    const geminiUrl = buildGeminiUrl(geminiApiKey.trim());

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: GEMINI_THINKING_CONFIG,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('[AI Weekly Review] Gemini API error:', geminiResponse.status, errorBody);
      if (geminiResponse.status === 400 || geminiResponse.status === 403) {
        res.status(401).json({
          error: {
            code: 'GEMINI_AUTH_ERROR',
            message: 'Invalid Gemini API key. Please check your key in Settings.',
          },
        });
        return;
      }
      res.status(502).json({
        error: {
          code: 'GEMINI_API_ERROR',
          message: 'Failed to get response from Gemini. Please try again later.',
          details:
            process.env.NODE_ENV === 'development'
              ? `Gemini upstream status ${geminiResponse.status} (model ${GEMINI_MODEL})`
              : undefined,
        },
      });
      return;
    }

    const rawText = extractGeminiText(await geminiResponse.json());

    if (!rawText) {
      res.status(502).json({
        error: { code: 'GEMINI_EMPTY_RESPONSE', message: 'Gemini returned an empty review.' },
      });
      return;
    }

    let parsed: Partial<WeeklyAIReview>;
    try {
      parsed = JSON.parse(rawText) as Partial<WeeklyAIReview>;
    } catch {
      console.error('[AI Weekly Review] Failed to parse Gemini JSON:', rawText.slice(0, 500));
      res.status(502).json({
        error: { code: 'GEMINI_PARSE_ERROR', message: 'Gemini returned an unexpected format.' },
      });
      return;
    }

    // ---- Normalize / validate (server owns the week boundaries) ----
    const strArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];

    const validConfidence = (c: unknown): ReviewConfidence =>
      c === 'high' || c === 'medium' || c === 'low' ? c : 'low';

    const patterns: WeeklyReviewPattern[] = Array.isArray(parsed.patterns)
      ? parsed.patterns
          .filter((p): p is WeeklyReviewPattern => !!p && typeof p === 'object')
          .map((p) => ({
            title: String(p.title ?? ''),
            evidence: String(p.evidence ?? ''),
            confidence: validConfidence(p.confidence),
          }))
          .filter((p) => p.title.length > 0)
      : [];

    // Cap recommendations at 5 per the product spec (small, high-impact set).
    const recommendations: WeeklyReviewRecommendation[] = (
      Array.isArray(parsed.recommendations)
        ? parsed.recommendations
            .filter((r): r is WeeklyReviewRecommendation => !!r && typeof r === 'object')
            .map((r) => ({
              title: String(r.title ?? ''),
              reason: String(r.reason ?? ''),
              suggestedAction: String(r.suggestedAction ?? ''),
            }))
            .filter((r) => r.title.length > 0)
        : []
    ).slice(0, 5);

    const review: WeeklyAIReview = {
      weekStart: startDayKey,
      weekEnd: endDayKey,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      facts: strArray(parsed.facts),
      patterns,
      journalThemes: strArray(parsed.journalThemes),
      wins: strArray(parsed.wins),
      areasForAttention: strArray(parsed.areasForAttention),
      recommendations,
      dataLimitations: strArray(parsed.dataLimitations),
    };

    // Archive the report for history (best-effort; never block the response).
    try {
      await saveAIReport(householdId, userId, {
        kind: 'weekly_review',
        periodStart: startDayKey,
        periodEnd: endDayKey,
        payload: { review },
      });
    } catch (saveErr) {
      console.error('[AI Weekly Review] Failed to archive report:', saveErr);
    }

    res.status(200).json({
      review,
      meta: {
        weekStart: startDayKey,
        weekEnd: endDayKey,
        habitsTracked: reviewHabits.length,
        daysWithHabitData: habitDataDays.size,
        journalEntries: journalFacts.length,
        wellbeingDaysRecorded,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Weekly Review] Error:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate weekly review',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
