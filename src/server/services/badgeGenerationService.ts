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
import type { Goal } from '../../models/persistenceTypes';

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
// Image validation helpers
// ---------------------------------------------------------------------------

/** Minimum plausible image size in bytes (a real 256x256 image is thousands of bytes). */
const MIN_IMAGE_BYTES = 100;

/**
 * Detect the MIME type of an image buffer by inspecting magic bytes.
 * Returns null for unrecognized formats.
 */
function detectImageMimeType(buf: Buffer): string | null {
  if (buf.length < 4) return null;

  // PNG: \x89PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: \xFF\xD8\xFF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50   // WEBP
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Validate that a buffer contains a recognizable image format.
 */
function validateImageBuffer(buf: Buffer): { valid: boolean; mimeType: string | null } {
  if (buf.length < MIN_IMAGE_BYTES) return { valid: false, mimeType: null };
  const mimeType = detectImageMimeType(buf);
  return { valid: mimeType !== null, mimeType };
}

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
      size: '256x256',
      response_format: 'b64_json',
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
      const buf = Buffer.from(item.b64_json, 'base64');
      if (!validateImageBuffer(buf).valid) {
        console.warn('[BadgeGen] b64_json response failed image validation');
        return null;
      }
      return buf;
    }
    if (item?.url) {
      // Fallback: fetch image from the returned URL
      const imgResponse = await fetch(item.url);
      if (!imgResponse.ok) return null;
      const buf = Buffer.from(await imgResponse.arrayBuffer());
      if (!validateImageBuffer(buf).valid) {
        console.warn('[BadgeGen] URL-fetched response failed image validation');
        return null;
      }
      return buf;
    }
    return null;
  }

  // Direct binary image response
  const buf = Buffer.from(await response.arrayBuffer());
  if (!validateImageBuffer(buf).valid) {
    console.warn('[BadgeGen] Binary response failed image validation');
    return null;
  }
  return buf;
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

    // Detect actual image format and store as properly-typed data URL
    const mimeType = detectImageMimeType(imageBytes);
    if (!mimeType) {
      console.warn(`[BadgeGen] Unrecognized image format for goal ${goalId}`);
      return;
    }
    const base64 = imageBytes.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    await updateGoal(goalId, householdId, userId, { badgeImageUrl: dataUrl });
    console.log(`[BadgeGen] Badge saved for goal ${goalId} (${Math.round(base64.length / 1024)}KB)`);
  } catch (error) {
    // Never let badge generation crash the server
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[BadgeGen] Failed for goal ${goalId}: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Badge backfill for existing goals
// ---------------------------------------------------------------------------

/** Track goals already queued for backfill to avoid duplicate API calls. */
const backfillAttempted = new Set<string>();

/**
 * Returns true if a goal's badge should be regenerated.
 *
 * Triggers on:
 *  - Missing badgeImageUrl (never generated or generation failed)
 *  - badgeImageUrl with hardcoded image/png MIME (from the old buggy code that
 *    always labelled images as PNG regardless of actual format)
 */
function needsBadgeRegeneration(goal: Goal): boolean {
  if (!goal.badgeImageUrl) return true;
  if (goal.badgeImageUrl.startsWith('data:image/png;base64,')) return true;
  return false;
}

/**
 * Fire-and-forget backfill of badges for goals that are missing them or have
 * corrupt data URLs from the old generation code.
 *
 * Designed to be called after responding to the client — never blocks the
 * HTTP response.  Uses an in-memory Set so each goal is only attempted once
 * per server lifetime.
 */
export function backfillGoalBadges(
  goals: Goal[],
  householdId: string,
  userId: string,
): void {
  const candidates = goals.filter(
    g => !backfillAttempted.has(g.id) && needsBadgeRegeneration(g),
  );
  if (candidates.length === 0) return;

  console.log(`[BadgeGen] Backfilling badges for ${candidates.length} goal(s)`);

  for (const goal of candidates) {
    backfillAttempted.add(goal.id);
  }

  // Stagger calls to avoid hammering the HF API
  candidates.forEach((goal, i) => {
    setTimeout(
      () => generateBadgeForGoal(goal.id, goal.title, householdId, userId),
      i * 2000,
    );
  });
}
