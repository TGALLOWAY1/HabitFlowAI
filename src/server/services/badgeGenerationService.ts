/**
 * Badge Generation Service
 *
 * Generates achievement badge images for goals using the HF Inference API.
 * Runs asynchronously (fire-and-forget) after goal creation — never blocks
 * the API response. The generated image is stored as a base64 data URL in
 * the goal's `badgeImageUrl` field.
 *
 * Style consistency is enforced via a shared prompt template.
 */

import { updateGoal } from '../repositories/goalRepository';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HF_MODEL = 'Tongyi-MAI/Z-Image-Turbo';
const HF_PROVIDER = 'wavespeed';
const HF_INFERENCE_URL = `https://router.huggingface.co/v1/images/generations`;

/**
 * Shared style suffix appended to every prompt so all badges look consistent.
 */
const STYLE_PROMPT =
  'Flat-design achievement badge icon. ' +
  'Minimalist circular medal, vibrant gradient, clean vector style, ' +
  'no text, no letters, no words, dark background, centered composition, ' +
  'high contrast, bold colors, simple shapes.';

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build a deterministic, style-consistent prompt from a goal title.
 */
function buildBadgePrompt(goalTitle: string): string {
  return `A badge icon representing the achievement: "${goalTitle}". ${STYLE_PROMPT}`;
}

// ---------------------------------------------------------------------------
// HF Inference API call
// ---------------------------------------------------------------------------

/**
 * Call the HF Inference API to generate a badge image.
 * Returns raw image bytes (PNG) or null on failure.
 */
async function generateImageBytes(prompt: string, hfToken: string): Promise<Buffer | null> {
  const response = await fetch(HF_INFERENCE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_MODEL,
      prompt,
      provider: HF_PROVIDER,
      // Keep images small for fast loading
      width: 256,
      height: 256,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`HF Inference API error ${response.status}: ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // OpenAI-compatible /v1/images/generations returns JSON with base64
  if (contentType.includes('application/json')) {
    const json = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = json.data?.[0];
    if (item?.b64_json) {
      return Buffer.from(item.b64_json, 'base64');
    }
    if (item?.url) {
      // Fetch the image from the returned URL
      const imgResponse = await fetch(item.url);
      if (!imgResponse.ok) return null;
      const arrayBuffer = await imgResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    return null;
  }

  // Direct binary image response
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a badge image for a goal and persist the result.
 *
 * This function is designed to be called fire-and-forget — it never throws.
 * Errors are logged and the goal simply keeps no badge image (the frontend
 * falls back to the deterministic Lucide icon).
 */
export async function generateBadgeForGoal(
  goalId: string,
  goalTitle: string,
  householdId: string,
  userId: string,
): Promise<void> {
  try {
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      console.warn('[BadgeGen] HF_TOKEN not set — skipping badge generation');
      return;
    }

    const prompt = buildBadgePrompt(goalTitle);
    console.log(`[BadgeGen] Generating badge for goal "${goalTitle}" (${goalId})…`);

    const imageBytes = await generateImageBytes(prompt, hfToken);
    if (!imageBytes) {
      console.warn(`[BadgeGen] No image bytes returned for goal ${goalId}`);
      return;
    }

    // Store as base64 data URL (PNG)
    const base64 = imageBytes.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    await updateGoal(goalId, householdId, userId, { badgeImageUrl: dataUrl });
    console.log(`[BadgeGen] Badge saved for goal ${goalId} (${Math.round(base64.length / 1024)}KB)`);
  } catch (error) {
    // Never let badge generation crash the server
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[BadgeGen] Failed for goal ${goalId}: ${msg}`);
  }
}
