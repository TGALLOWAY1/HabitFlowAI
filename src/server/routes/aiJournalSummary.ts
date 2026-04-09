/**
 * AI Journal Summary Route (Gemini BYOK)
 *
 * POST /api/ai/journal-summary
 * Accepts a user-provided Gemini API key, gathers last 7 days of
 * journal entries, resolves template prompts to readable questions,
 * and returns a structured weekly journal summary from Gemini.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { getEntriesByUser } from '../repositories/journal';
import { JOURNAL_TEMPLATES, FREE_WRITE_TEMPLATE } from '../../data/journalTemplates';
import type { JournalTemplate, JournalPrompt } from '../../data/journalTemplates';

interface JournalSummaryRequest {
  geminiApiKey: string;
}

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
  for (const t of JOURNAL_TEMPLATES) {
    lookup.set(t.id, t.title);
  }
  lookup.set(FREE_WRITE_TEMPLATE.id, FREE_WRITE_TEMPLATE.title);
  return lookup;
}

/**
 * POST /api/ai/journal-summary
 */
export async function postJournalSummary(req: Request, res: Response): Promise<void> {
  try {
    const { geminiApiKey } = req.body as JournalSummaryRequest;

    if (!geminiApiKey || typeof geminiApiKey !== 'string' || geminiApiKey.trim().length < 10) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A valid Gemini API key is required' },
      });
      return;
    }

    const { userId } = getRequestIdentity(req);

    // Calculate date range: last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);

    // Fetch journal entries for the period
    const entries = await getEntriesByUser(userId, { startDate, endDate });

    if (entries.length === 0) {
      res.status(200).json({
        summary: 'No journal entries found for the past week. Start journaling to get your weekly summary!',
        period: { start: startDate, end: endDate },
        journalEntriesCount: 0,
        templatesUsed: [],
      });
      return;
    }

    const promptLookup = buildPromptLookup();
    const templateLookup = buildTemplateLookup();

    // Build readable journal context for Gemini
    const journalLines: string[] = [];
    const templatesUsedSet = new Set<string>();

    for (const entry of entries) {
      const templateTitle = templateLookup.get(entry.templateId) ?? entry.templateId;
      templatesUsedSet.add(templateTitle);

      const contentParts = Object.entries(entry.content)
        .map(([promptId, answer]) => {
          const question = promptLookup.get(promptId) ?? promptId;
          return `  Q: ${question}\n  A: ${answer}`;
        })
        .join('\n');

      journalLines.push(`--- ${entry.date} | ${templateTitle} (${entry.mode}) ---\n${contentParts}`);
    }

    const templatesUsed = [...templatesUsedSet];

    const prompt = `You are a thoughtful, insightful wellness coach reviewing a user's journal entries from the past week in a habit-tracking app called HabitFlow.

Analyze the journal entries below and produce a weekly journal summary with exactly these four sections:

## Themes & Patterns
Identify recurring topics, emotional themes, and patterns you notice across the week's entries. What feelings, situations, or concerns keep coming up?

## Highlights & Wins
Call out specific accomplishments, positive moments, breakthroughs, or things that went well — based on what the user actually wrote.

## Actionable Feedback
Offer 2-3 gentle, specific coaching suggestions based on patterns you noticed. Be concrete (e.g., "You mentioned stress around deadlines 3 times — consider a 5-minute breathing exercise before starting work"). Avoid generic advice.

## Reminders & Follow-ups
Extract any action items, intentions, goals, or commitments the user mentioned in their entries and surface them as friendly reminders (e.g., "You planned to start reading before bed — how's that going?").

Guidelines:
- Be warm but not patronizing
- Reference specific things the user wrote — don't be vague
- Keep each section concise (3-5 bullet points max)
- Use markdown formatting
- Total length: 300-500 words

Here are the user's journal entries from ${startDate} to ${endDate} (${entries.length} entries across ${templatesUsed.length} template(s)):

${journalLines.join('\n\n')}

Please write the weekly journal summary now.`;

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('[AI Journal Summary] Gemini API error:', geminiResponse.status, errorBody);

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
        },
      });
      return;
    }

    const geminiData = await geminiResponse.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    };

    const parts = geminiData?.candidates?.[0]?.content?.parts ?? [];
    const outputPart = parts.find(p => !p.thought && p.text) ?? parts[0];
    const summaryText = outputPart?.text ?? 'Unable to generate journal summary. Please try again.';

    res.status(200).json({
      summary: summaryText,
      period: { start: startDate, end: endDate },
      journalEntriesCount: entries.length,
      templatesUsed,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Journal Summary] Error:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate journal summary',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
