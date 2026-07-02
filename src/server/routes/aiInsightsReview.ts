/**
 * Insights AI Review Route (Gemini BYOK)
 *
 * POST /api/ai/insights-review
 *
 * Computes the user's cross-domain insights (correlations, linear-trend
 * predictions, medication adherence, metric averages, discoveries) from
 * canonical truth, then asks Gemini to turn those *already-computed facts* into
 * a grounded, plain-language narrative with caveated patterns and small,
 * realistic recommendations.
 *
 * Grounding strategy mirrors the Weekly AI Review:
 *  - Only aggregated facts derived from the database are sent to the model.
 *  - The window boundaries are set by the server, not the model.
 *  - A structured JSON response schema keeps the UI shape stable.
 *  - The model is told everything is correlation, never causation.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { resolveTimeZone, getNowDayKey } from '../utils/dayKey';
import { getWellbeingEntries } from '../repositories/wellbeingEntryRepository';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getHabitEntriesByUserInRange } from '../repositories/habitEntryRepository';
import { listMedications, getMedicationLogsInRange } from '../repositories/medicationRepository';
import { listSupplements, getSupplementLogsInRange } from '../repositories/supplementRepository';
import { listSymptoms, getSymptomLogsInRange } from '../repositories/symptomRepository';
import {
  computeInsightsOverview,
  computeCorrelationsForSources,
  computePredictionsForSources,
  computeMedicationInsights,
  startDayKeyForRange,
  type InsightsSources,
} from '../services/insightsService';
import { GEMINI_MODEL, buildGeminiUrl, GEMINI_THINKING_CONFIG, extractGeminiText } from '../lib/gemini';
import { saveAIReport } from '../repositories/aiReportRepository';
import type { ReviewConfidence } from '../../shared/weeklyAiReview';
import type {
  InsightsAIReview,
  InsightsReviewPattern,
  InsightsReviewRecommendation,
} from '../../shared/insightsAiReview';

interface InsightsReviewRequest {
  geminiApiKey: string;
  days?: number;
  timeZone?: string;
}

function parseDays(value: unknown, fallback = 90): number {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (isNaN(raw) || raw < 1 || raw > 365) return fallback;
  return raw;
}

/**
 * POST /api/ai/insights-review
 */
export async function postInsightsReview(req: Request, res: Response): Promise<void> {
  try {
    const { geminiApiKey, days: daysInput, timeZone: tzInput } = req.body as InsightsReviewRequest;

    if (!geminiApiKey || typeof geminiApiKey !== 'string' || geminiApiKey.trim().length < 10) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A valid Gemini API key is required' },
      });
      return;
    }

    const { userId, householdId } = getRequestIdentity(req);
    const timeZone = resolveTimeZone(typeof tzInput === 'string' ? tzInput : undefined);
    const days = parseDays(daysInput, 90);
    const referenceDayKey = getNowDayKey(timeZone);
    const rangeStart = startDayKeyForRange(referenceDayKey, days);

    // ---- Load all sources for the window ----
    const [
      wellbeingEntries,
      habits,
      habitEntries,
      medications,
      medicationLogs,
      supplements,
      supplementLogs,
      symptoms,
      symptomLogs,
    ] = await Promise.all([
      getWellbeingEntries({ userId, startDayKey: rangeStart, endDayKey: referenceDayKey }),
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUserInRange(householdId, userId, rangeStart, referenceDayKey),
      listMedications(householdId, userId),
      getMedicationLogsInRange(householdId, userId, rangeStart, referenceDayKey),
      listSupplements(householdId, userId),
      getSupplementLogsInRange(householdId, userId, rangeStart, referenceDayKey),
      listSymptoms(householdId, userId),
      getSymptomLogsInRange(householdId, userId, rangeStart, referenceDayKey),
    ]);

    const sources: InsightsSources = {
      wellbeingEntries,
      habits,
      habitEntries,
      medications,
      medicationLogs,
      supplements,
      supplementLogs,
      symptoms,
      symptomLogs,
    };

    // ---- Compute the insights the model will narrate ----
    const overview = computeInsightsOverview(sources, referenceDayKey, days, timeZone);
    const correlations = computeCorrelationsForSources(sources, referenceDayKey, days, timeZone);
    const predictions = computePredictionsForSources(sources, referenceDayKey, days);
    const medication = computeMedicationInsights(sources, referenceDayKey, days, timeZone);

    const observedInsights = {
      window: { rangeDays: days, start: rangeStart, end: referenceDayKey, daysWithCheckins: overview.daysWithCheckins },
      metricAverages: overview.metricAverages.map((m) => ({
        metric: m.label,
        average: m.average,
        daysRecorded: m.sampleSize,
        higherIsBetter: m.higherIsBetter,
      })),
      correlations: correlations.map((c) => ({
        factor: c.factorName,
        factorType: c.factorSource,
        outcome: c.outcomeLabel,
        direction: c.direction,
        meanDifference: c.meanDifference,
        effectSize: c.effectSize,
        nPresent: c.nPresent,
        nAbsent: c.nAbsent,
      })),
      predictions: predictions
        .filter((p) => p.predictedValue !== null)
        .map((p) => ({
          metric: p.label,
          current: p.currentValue,
          predicted: p.predictedValue,
          horizonDays: p.horizonDays,
          changePerWeek: p.slopePerWeek,
          direction: p.direction,
          confidence: p.confidence,
        })),
      medicationAdherence: medication.adherence.map((a) => ({
        medication: a.name,
        adherencePercent: a.adherencePercent,
        loggedDays: a.loggedDays,
      })),
    };

    // ---- Build the grounded prompt ----
    const prompt = `You are an analytical wellness coach for a habit-tracking app called HabitFlow.
You will be given COMPUTED INSIGHTS derived directly from one user's database over a ${days}-day window.
These insights are already statistically computed (correlations use Cohen's d effect size on present/absent
day groups; predictions are simple linear trend lines). Your job is to explain them in plain language and
suggest small, realistic next steps. Fill in every section of the schema.

SECTIONS (fill each):
1. "summary" — a natural-language narrative (1-3 short paragraphs) of what the insights show overall:
   the strongest relationships, the clearest trends, and overall data coverage. No recommendations here.
2. "keyFindings" — objective findings drawn directly from the computed numbers (e.g.
   "On days you exercised, mood averaged 1.2 points higher (n=12 vs 9).").
3. "patterns" — inferred relationships, each with a "confidence" of low/medium/high based ONLY on the
   sample sizes and effect sizes provided. Use tentative language; never claim causation.
4. "outlook" — a forward-looking, clearly caveated read of the trend predictions (e.g.
   "If the current trend holds, your energy may reach ~3.8 in two weeks — a simple linear projection, not a guarantee.").
5. "recommendations" — a SMALL number (MAXIMUM 5) of grounded, behaviorally realistic suggestions tied to the data.

STRICT GROUNDING RULES:
- Use ONLY the computed insights below. Never invent factors, outcomes, numbers, or relationships not present.
- Everything here is CORRELATION, not causation. Never imply one thing causes another.
- If there are few correlations or thin data, say so honestly in "dataLimitations" and keep sections short.
- Cite specific numbers (effect sizes, mean differences, sample sizes, predicted values) where relevant.
- Recommendations must be small and realistic (e.g. "keep your wind-down routine on work nights"), never generic.

COMPUTED INSIGHTS (JSON):
${JSON.stringify(observedInsights, null, 2)}

Notes for interpretation:
- "correlations[].direction" is "improves" or "worsens" relative to the outcome's own polarity (higherIsBetter).
- "effectSize" is Cohen's d (|0.2| small, |0.5| medium, |0.8| large). Larger |effectSize| = stronger signal.
- "predictions[].direction" already accounts for whether higher is better for that metric.
- Wellbeing values are on the user's own 1-5 check-in scales; treat them as relative, not absolute.

Return the review as JSON matching the provided schema.`;

    const responseSchema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        keyFindings: { type: 'array', items: { type: 'string' } },
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
        outlook: { type: 'array', items: { type: 'string' } },
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
      required: ['summary', 'keyFindings', 'patterns', 'outlook', 'recommendations', 'dataLimitations'],
    };

    // ---- Call Gemini ----
    const geminiResponse = await fetch(buildGeminiUrl(geminiApiKey.trim()), {
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
      console.error('[AI Insights Review] Gemini API error:', geminiResponse.status, errorBody);
      if (geminiResponse.status === 400 || geminiResponse.status === 403) {
        res.status(401).json({
          error: { code: 'GEMINI_AUTH_ERROR', message: 'Invalid Gemini API key. Please check your key in Settings.' },
        });
        return;
      }
      res.status(502).json({
        error: {
          code: 'GEMINI_API_ERROR',
          message: 'Failed to get response from Gemini. Please try again later.',
          details: process.env.NODE_ENV === 'development' ? `Gemini upstream status ${geminiResponse.status} (model ${GEMINI_MODEL})` : undefined,
        },
      });
      return;
    }

    const rawText = extractGeminiText(await geminiResponse.json());
    if (!rawText) {
      res.status(502).json({ error: { code: 'GEMINI_EMPTY_RESPONSE', message: 'Gemini returned an empty review.' } });
      return;
    }

    let parsed: Partial<InsightsAIReview>;
    try {
      parsed = JSON.parse(rawText) as Partial<InsightsAIReview>;
    } catch {
      console.error('[AI Insights Review] Failed to parse Gemini JSON:', rawText.slice(0, 500));
      res.status(502).json({ error: { code: 'GEMINI_PARSE_ERROR', message: 'Gemini returned an unexpected format.' } });
      return;
    }

    // ---- Normalize / validate (server owns the window) ----
    const strArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
    const validConfidence = (c: unknown): ReviewConfidence =>
      c === 'high' || c === 'medium' || c === 'low' ? c : 'low';

    const patterns: InsightsReviewPattern[] = Array.isArray(parsed.patterns)
      ? parsed.patterns
          .filter((p): p is InsightsReviewPattern => !!p && typeof p === 'object')
          .map((p) => ({ title: String(p.title ?? ''), evidence: String(p.evidence ?? ''), confidence: validConfidence(p.confidence) }))
          .filter((p) => p.title.length > 0)
      : [];

    const recommendations: InsightsReviewRecommendation[] = (
      Array.isArray(parsed.recommendations)
        ? parsed.recommendations
            .filter((r): r is InsightsReviewRecommendation => !!r && typeof r === 'object')
            .map((r) => ({ title: String(r.title ?? ''), reason: String(r.reason ?? ''), suggestedAction: String(r.suggestedAction ?? '') }))
            .filter((r) => r.title.length > 0)
        : []
    ).slice(0, 5);

    const review: InsightsAIReview = {
      rangeDays: days,
      rangeStart,
      rangeEnd: referenceDayKey,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      keyFindings: strArray(parsed.keyFindings),
      patterns,
      outlook: strArray(parsed.outlook),
      recommendations,
      dataLimitations: strArray(parsed.dataLimitations),
    };

    // Archive the report for history (best-effort; never block the response).
    try {
      await saveAIReport(householdId, userId, {
        kind: 'insights_review',
        periodStart: rangeStart,
        periodEnd: referenceDayKey,
        payload: { review },
      });
    } catch (saveErr) {
      console.error('[AI Insights Review] Failed to archive report:', saveErr);
    }

    res.status(200).json({
      review,
      meta: {
        rangeDays: days,
        rangeStart,
        rangeEnd: referenceDayKey,
        daysWithCheckins: overview.daysWithCheckins,
        correlationsFound: correlations.length,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Insights Review] Error:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate insights review',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
