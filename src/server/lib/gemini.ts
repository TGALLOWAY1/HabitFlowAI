/**
 * Server-side Gemini helpers (BYOK).
 *
 * Centralizes the model id and the Gemini 3.x request shape so the AI routes
 * don't drift. Gemini 3 requires `thinkingConfig.thinkingLevel` (the legacy
 * `thinkingBudget` must not be sent), and is tuned for its default temperature
 * (1.0) — callers therefore omit `temperature`.
 */

/** Model id for all server-side Gemini calls. */
export const GEMINI_MODEL = 'gemini-3.5-flash';

/**
 * Build the v1beta generateContent endpoint for a user-supplied API key.
 * Caller is responsible for having validated the key is a non-empty string.
 */
export function buildGeminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`;
}

/**
 * Shared `thinkingConfig` fragment for Gemini 3.x. `low` keeps reasoning light
 * for these grounded extraction/summary tasks while staying valid for Gemini 3
 * (which cannot fully disable thinking).
 */
export const GEMINI_THINKING_CONFIG = { thinkingLevel: 'low' as const };

interface GeminiResponseShape {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
}

/**
 * Extract the model's text output from a generateContent JSON response.
 * Skips "thought" parts (from thinking models); returns the first part with
 * text, falling back to the first part, else `undefined`.
 */
export function extractGeminiText(responseJson: unknown): string | undefined {
  const data = responseJson as GeminiResponseShape;
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const outputPart = parts.find((p) => !p.thought && p.text) ?? parts[0];
  return outputPart?.text;
}
