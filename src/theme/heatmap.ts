/**
 * Theme-aware heatmap color resolution.
 *
 * The heatmap intensity ladder (0 = empty, 4 = strongest) is defined
 * per-theme in src/theme/palette.ts. This module exposes a pure function
 * that callers use with their active theme mode.
 *
 * Callers should read the current mode from `useTheme().resolvedMode`
 * and apply the returned hex via inline `style={{ background: ... }}`.
 */

import { palette, type ResolvedThemeMode } from './palette';

/**
 * Return the hex color for a given intensity (0..4) and theme mode.
 * Intensities outside the range are clamped.
 */
export function getHeatmapColor(intensity: number, mode: ResolvedThemeMode): string {
  const ladder = palette[mode].heatmap;
  const idx = Math.max(0, Math.min(intensity, ladder.length - 1));
  return ladder[idx];
}

/**
 * Number of distinct intensity levels in the heatmap ladder.
 * Useful for legends and scale computations.
 */
export const HEATMAP_LEVELS = palette.light.heatmap.length;
