import { describe, it, expect } from 'vitest';
import {
  GEMINI_MODEL,
  GEMINI_THINKING_CONFIG,
  buildGeminiUrl,
  extractGeminiText,
} from '../gemini';

describe('gemini helpers', () => {
  it('targets the gemini-3.5-flash generateContent endpoint', () => {
    expect(GEMINI_MODEL).toBe('gemini-3.5-flash');
    const url = buildGeminiUrl('abc 123');
    expect(url).toContain('/v1beta/models/gemini-3.5-flash:generateContent');
    // Key is URL-encoded.
    expect(url).toContain('key=abc%20123');
  });

  it('uses Gemini 3 thinkingLevel and never the legacy thinkingBudget', () => {
    expect(GEMINI_THINKING_CONFIG).toEqual({ thinkingLevel: 'low' });
    expect(GEMINI_THINKING_CONFIG).not.toHaveProperty('thinkingBudget');
  });

  it('extracts the first text part, skipping thought parts', () => {
    const text = extractGeminiText({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: 'internal reasoning' },
              { text: 'the answer' },
            ],
          },
        },
      ],
    });
    expect(text).toBe('the answer');
  });

  it('returns undefined when there is no usable output', () => {
    expect(extractGeminiText({ candidates: [{ content: { parts: [] } }] })).toBeUndefined();
    expect(extractGeminiText({})).toBeUndefined();
    expect(extractGeminiText(null)).toBeUndefined();
  });
});
