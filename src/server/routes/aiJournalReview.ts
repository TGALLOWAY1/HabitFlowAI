/**
 * AI Journal Review Route (Gemini BYOK)
 *
 * POST /api/ai/journal-review
 *
 * Gathers the user's journal entries for a chosen date range, resolves
 * template prompts to readable questions, and asks Gemini to produce a
 * grounded, structured, NON-CLINICAL review of emotional themes, recurring
 * stressors, wins, self-talk patterns, reflection questions, and small
 * next steps.
 *
 * Grounding strategy:
 *  - Only the user's own journal text for the selected range is sent.
 *  - The prompt separates observed evidence, inferred themes, and suggested
 *    next steps, and forbids inventing facts or quoting at length.
 *  - The range boundaries in the response are set by the server, not the model.
 *  - A structured JSON response schema is enforced so the UI gets a stable shape.
 *
 * Safety:
 *  - The model is explicitly told not to diagnose or give medical advice.
 *  - If entries suggest self-harm or crisis, it returns a gentle `crisisNotice`
 *    encouraging real-world support instead of attempting crisis counseling.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { getEntriesByUser } from '../repositories/journal';
import { JOURNAL_TEMPLATES, FREE_WRITE_TEMPLATE } from '../../data/journalTemplates';
import type { JournalTemplate, JournalPrompt } from '../../data/journalTemplates';
import { isValidDayKey } from '../../domain/time/dayKey';
import { GEMINI_MODEL, buildGeminiUrl, GEMINI_THINKING_CONFIG, extractGeminiText } from '../lib/gemini';
import type {
  AIJournalReview,
  EmotionalTheme,
  RecurringStressor,
  JournalWin,
  SelfTalkPattern,
  SuggestedNextStep,
  ReviewConfidence,
} from '../../shared/aiJournalReview';

interface JournalReviewRequest {
  geminiApiKey: string;
  /** Start of the range to review (YYYY-MM-DD). */
  rangeStart: string;
  /** End of the range to review, inclusive (YYYY-MM-DD). */
  rangeEnd: string;
}

/** Fewer than this many entries → flag the review as low-data. */
const LOW_DATA_THRESHOLD = 3;

/** AI-generated summaries are excluded so the review reflects the user's own writing. */
const EXCLUDED_TEMPLATE_IDS = new Set(['ai-weekly-summary']);

/** Build a lookup: promptId → human-readable question text, across all templates. */
function buildPromptLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  const allTemplates: JournalTemplate[] = [...JOURNAL_TEMPLATES, FREE_WRITE_TEMPLATE];
  for (const template of allTemplates) {
    const allPrompts: JournalPrompt[] = [
      ...template.prompts.standard,
      ...(template.prompts.deep ?? []),
    ];
    for (const prompt of allPrompts) {
      lookup.set(prompt.id, prompt.text);
    }
  }
  return lookup;
}

/** Build a lookup: templateId → template title. */
function buildTemplateLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const t of JOURNAL_TEMPLATES) lookup.set(t.id, t.title);
  lookup.set(FREE_WRITE_TEMPLATE.id, FREE_WRITE_TEMPLATE.title);
  return lookup;
}

/** An empty review shell — used for the no-entries case and as normalization defaults. */
function emptyReview(rangeStart: string, rangeEnd: string): AIJournalReview {
  return {
    rangeStart,
    rangeEnd,
    overview: '',
    emotionalThemes: [],
    recurringStressors: [],
    wins: [],
    selfTalkPatterns: [],
    reflectionQuestions: [],
    suggestedNextSteps: [],
    dataLimitations: [],
  };
}

/**
 * POST /api/ai/journal-review
 */
export async function postJournalReview(req: Request, res: Response): Promise<void> {
  try {
    const { geminiApiKey, rangeStart, rangeEnd } = req.body as JournalReviewRequest;

    if (!geminiApiKey || typeof geminiApiKey !== 'string' || geminiApiKey.trim().length < 10) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A valid Gemini API key is required' },
      });
      return;
    }

    if (!isValidDayKey(rangeStart) || !isValidDayKey(rangeEnd)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'rangeStart and rangeEnd must be valid YYYY-MM-DD dates',
        },
      });
      return;
    }

    // Server owns the range boundaries; normalize order so start <= end.
    const [startDate, endDate] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];

    const { userId } = getRequestIdentity(req);

    const allEntries = await getEntriesByUser(userId, { startDate, endDate });
    const entries = allEntries.filter((e) => !EXCLUDED_TEMPLATE_IDS.has(e.templateId));

    const daysJournaled = new Set(entries.map((e) => e.date)).size;

    // ---- Empty state: no entries in range ----
    if (entries.length === 0) {
      res.status(200).json({
        review: {
          ...emptyReview(startDate, endDate),
          overview: 'There are no journal entries in this date range yet.',
          dataLimitations: [
            'No journal entries were found for the selected dates, so no patterns could be identified.',
          ],
        },
        meta: {
          rangeStart: startDate,
          rangeEnd: endDate,
          journalEntriesCount: 0,
          daysJournaled: 0,
          lowData: true,
        },
      });
      return;
    }

    const lowData = entries.length < LOW_DATA_THRESHOLD;

    const promptLookup = buildPromptLookup();
    const templateLookup = buildTemplateLookup();

    // ---- Build readable, paraphrasable journal context ----
    const journalLines: string[] = [];
    for (const entry of entries) {
      const templateTitle = templateLookup.get(entry.templateId) ?? entry.templateId;
      const contentParts = Object.entries(entry.content)
        .filter(([, answer]) => typeof answer === 'string' && answer.trim().length > 0)
        .map(([promptId, answer]) => {
          const question = promptLookup.get(promptId) ?? promptId;
          return `  Q: ${question}\n  A: ${answer}`;
        })
        .join('\n');
      if (contentParts.trim().length === 0) continue;
      journalLines.push(`--- ${entry.date} | ${templateTitle} (${entry.mode}) ---\n${contentParts}`);
    }

    const prompt = `You are a careful, supportive reflection assistant for a journaling app called HabitFlow.
You will be given a single user's own journal entries for a selected date range.
Produce a grounded, structured review that helps them understand their writing.

You are NOT a therapist or doctor. Do NOT diagnose, label, or give medical advice.
NEVER say things like "you are depressed", "you have anxiety", or "this indicates trauma".
Use careful, tentative language: "your entries suggest…", "a recurring theme appears to be…",
"this may be worth reflecting on…", "based on the available entries…".

STRICT GROUNDING RULES:
- Use ONLY the journal entries below. Never invent events, feelings, people, or facts not present.
- Clearly separate OBSERVED EVIDENCE (what the entries actually say) from INFERRED THEMES
  (patterns you noticed) from SUGGESTED NEXT STEPS (forward-looking ideas).
- Do NOT include long direct quotes. Paraphrase briefly; reference at most a few words.
- For each theme/stressor set "confidence" to "low", "medium", or "high" based ONLY on how
  much supporting evidence exists. With few entries, prefer "low".
- If there is little data, DO NOT fabricate themes. Add an honest note to "dataLimitations" instead.
- Provide 3-5 reflection questions and 2-4 small, realistic, NON-MEDICAL next steps.
  Next steps must be specific (e.g. "Add a 5-minute shutdown reflection on nights sleep feels hard"),
  never generic ("fix your anxiety").
- selfTalkPatterns must be careful and non-clinical; describe tone (e.g. "self-critical",
  "compassionate", "future-oriented"), not a condition.

SAFETY:
- If any entry suggests self-harm, suicidal thoughts, or crisis, set "crisisNotice" to a brief,
  warm message gently encouraging the user to reach out to trusted people or local emergency/crisis
  resources. Do NOT attempt crisis counseling and do NOT minimize. Otherwise omit "crisisNotice".

${
  lowData
    ? `NOTE: There are only ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} in this range, which is very few. Keep confidence low and be explicit about this limitation in "dataLimitations".\n`
    : ''
}
JOURNAL ENTRIES (${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} across ${daysJournaled} day(s), ${startDate} to ${endDate}):

${journalLines.join('\n\n')}

Return the review as JSON matching the provided schema.`;

    const confidenceSchema = { type: 'string', enum: ['low', 'medium', 'high'] };
    const responseSchema = {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        emotionalThemes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              theme: { type: 'string' },
              evidence: { type: 'string' },
              confidence: confidenceSchema,
            },
            required: ['theme', 'evidence', 'confidence'],
          },
        },
        recurringStressors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stressor: { type: 'string' },
              evidence: { type: 'string' },
              confidence: confidenceSchema,
            },
            required: ['stressor', 'evidence', 'confidence'],
          },
        },
        wins: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              evidence: { type: 'string' },
            },
            required: ['title', 'evidence'],
          },
        },
        selfTalkPatterns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pattern: { type: 'string' },
              evidence: { type: 'string' },
              suggestion: { type: 'string' },
            },
            required: ['pattern', 'evidence'],
          },
        },
        reflectionQuestions: { type: 'array', items: { type: 'string' } },
        suggestedNextSteps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              rationale: { type: 'string' },
              action: { type: 'string' },
            },
            required: ['title', 'rationale', 'action'],
          },
        },
        dataLimitations: { type: 'array', items: { type: 'string' } },
        crisisNotice: { type: 'string' },
      },
      required: [
        'overview',
        'emotionalThemes',
        'recurringStressors',
        'wins',
        'selfTalkPatterns',
        'reflectionQuestions',
        'suggestedNextSteps',
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
      console.error('[AI Journal Review] Gemini API error:', geminiResponse.status, errorBody);
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

    let parsed: Partial<AIJournalReview>;
    try {
      parsed = JSON.parse(rawText) as Partial<AIJournalReview>;
    } catch {
      console.error('[AI Journal Review] Failed to parse Gemini JSON:', rawText.slice(0, 500));
      res.status(502).json({
        error: { code: 'GEMINI_PARSE_ERROR', message: 'Gemini returned an unexpected format.' },
      });
      return;
    }

    // ---- Normalize / validate (server owns the range boundaries) ----
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const strArray = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
    const validConfidence = (c: unknown): ReviewConfidence =>
      c === 'high' || c === 'medium' || c === 'low' ? c : 'low';
    const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

    const emotionalThemes: EmotionalTheme[] = Array.isArray(parsed.emotionalThemes)
      ? parsed.emotionalThemes
          .filter(isObj)
          .map((t) => ({
            theme: str(t.theme),
            evidence: str(t.evidence),
            confidence: validConfidence(t.confidence),
          }))
          .filter((t) => t.theme.length > 0)
      : [];

    const recurringStressors: RecurringStressor[] = Array.isArray(parsed.recurringStressors)
      ? parsed.recurringStressors
          .filter(isObj)
          .map((s) => ({
            stressor: str(s.stressor),
            evidence: str(s.evidence),
            confidence: validConfidence(s.confidence),
          }))
          .filter((s) => s.stressor.length > 0)
      : [];

    const wins: JournalWin[] = Array.isArray(parsed.wins)
      ? parsed.wins
          .filter(isObj)
          .map((w) => ({ title: str(w.title), evidence: str(w.evidence) }))
          .filter((w) => w.title.length > 0)
      : [];

    const selfTalkPatterns: SelfTalkPattern[] = Array.isArray(parsed.selfTalkPatterns)
      ? parsed.selfTalkPatterns
          .filter(isObj)
          .map((p) => {
            const suggestion = str(p.suggestion);
            return {
              pattern: str(p.pattern),
              evidence: str(p.evidence),
              ...(suggestion.trim().length > 0 ? { suggestion } : {}),
            };
          })
          .filter((p) => p.pattern.length > 0)
      : [];

    const suggestedNextSteps: SuggestedNextStep[] = Array.isArray(parsed.suggestedNextSteps)
      ? parsed.suggestedNextSteps
          .filter(isObj)
          .map((s) => ({
            title: str(s.title),
            rationale: str(s.rationale),
            action: str(s.action),
          }))
          .filter((s) => s.title.length > 0)
      : [];

    const crisisNotice = str(parsed.crisisNotice).trim();

    const review: AIJournalReview = {
      rangeStart: startDate,
      rangeEnd: endDate,
      overview: str(parsed.overview),
      emotionalThemes,
      recurringStressors,
      wins,
      selfTalkPatterns,
      reflectionQuestions: strArray(parsed.reflectionQuestions),
      suggestedNextSteps,
      dataLimitations: strArray(parsed.dataLimitations),
      ...(crisisNotice.length > 0 ? { crisisNotice } : {}),
    };

    res.status(200).json({
      review,
      meta: {
        rangeStart: startDate,
        rangeEnd: endDate,
        journalEntriesCount: entries.length,
        daysJournaled,
        lowData,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Journal Review] Error:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate journal review',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
