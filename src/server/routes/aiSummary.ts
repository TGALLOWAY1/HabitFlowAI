/**
 * AI Weekly Summary Route (Gemini BYOK)
 *
 * POST /api/ai/weekly-summary
 * Accepts a user-provided Gemini API key, gathers last 7 days of
 * habit entries and journal entries, and returns a weekly summary
 * with encouragement from Gemini.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { getEntriesByUser } from '../repositories/journal';
import { getDb } from '../lib/mongoClient';

interface WeeklySummaryRequest {
  geminiApiKey: string;
}

/**
 * POST /api/ai/weekly-summary
 */
export async function postWeeklySummary(req: Request, res: Response): Promise<void> {
  try {
    const { geminiApiKey } = req.body as WeeklySummaryRequest;

    if (!geminiApiKey || typeof geminiApiKey !== 'string' || geminiApiKey.trim().length < 10) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A valid Gemini API key is required' },
      });
      return;
    }

    const { userId, householdId } = getRequestIdentity(req);

    // Calculate date range: last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDayKey = sevenDaysAgo.toISOString().slice(0, 10);
    const endDayKey = now.toISOString().slice(0, 10);

    // Fetch habit entries for the last 7 days
    const db = await getDb();
    const habitEntries = await db
      .collection('habitEntries')
      .find({
        userId,
        householdId,
        dayKey: { $gte: startDayKey, $lte: endDayKey },
        deletedAt: { $exists: false },
      })
      .toArray();

    // Fetch habits to get names
    const habits = await db
      .collection('habits')
      .find({ userId, householdId })
      .toArray();

    const habitNameMap = new Map<string, string>();
    for (const h of habits) {
      habitNameMap.set(h.id, h.name);
    }

    // Fetch journal entries for the last 7 days
    const allJournalEntries = await getEntriesByUser(userId);
    const recentJournalEntries = allJournalEntries.filter(
      (entry) => entry.date >= startDayKey && entry.date <= endDayKey,
    );

    // Build context for Gemini
    const habitSummaryLines: string[] = [];
    const entriesByDay = new Map<string, Map<string, number>>();

    for (const entry of habitEntries) {
      const day = entry.dayKey;
      const habitName = habitNameMap.get(entry.habitId) || entry.habitId;
      if (!entriesByDay.has(day)) entriesByDay.set(day, new Map());
      const dayMap = entriesByDay.get(day)!;
      dayMap.set(habitName, (dayMap.get(habitName) || 0) + (entry.value ?? 1));
    }

    for (const [day, habitMap] of [...entriesByDay.entries()].sort()) {
      const items = [...habitMap.entries()].map(([name, val]) => `${name}: ${val}`).join(', ');
      habitSummaryLines.push(`${day}: ${items}`);
    }

    const journalSummaryLines: string[] = [];
    for (const entry of recentJournalEntries) {
      const contentParts = Object.entries(entry.content)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
      journalSummaryLines.push(`${entry.date} (${entry.templateId}): ${contentParts}`);
    }

    const prompt = `You are a warm, supportive wellness coach for a habit-tracking app called HabitFlow.
The user has been tracking their habits and journaling over the past week.
Please provide a weekly summary that:
1. Highlights their accomplishments and consistency
2. Notes any patterns or trends (positive ones especially)
3. Offers genuine, specific encouragement based on what they actually did
4. Keeps a warm but not patronizing tone
5. Is concise (about 200-300 words)

Here is the user's habit data from the past 7 days (${startDayKey} to ${endDayKey}):

HABIT COMPLETIONS:
${habitSummaryLines.length > 0 ? habitSummaryLines.join('\n') : '(No habit entries recorded this week)'}

JOURNAL ENTRIES:
${journalSummaryLines.length > 0 ? journalSummaryLines.join('\n') : '(No journal entries this week)'}

Please write a weekly summary now. Use markdown formatting for readability.`;

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('[AI Summary] Gemini API error:', geminiResponse.status, errorBody);

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
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const summaryText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Unable to generate summary. Please try again.';

    res.status(200).json({
      summary: summaryText,
      period: { start: startDayKey, end: endDayKey },
      habitDaysTracked: entriesByDay.size,
      journalEntriesCount: recentJournalEntries.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Summary] Error:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate weekly summary',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
