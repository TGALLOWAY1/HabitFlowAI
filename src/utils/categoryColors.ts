import type { Category } from '../types';

const CATEGORY_COLOR_PALETTE = [
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-blue-500',
  'bg-fuchsia-500',
  'bg-cyan-500',
  'bg-green-500',
];

/**
 * Pick the next color from the palette that isn't already used by an existing
 * category. Cycles through the palette once all colors are taken.
 */
export function nextCategoryColor(existingCategories: Category[]): string {
  const usedColors = new Set(existingCategories.map((c) => c.color));
  const available = CATEGORY_COLOR_PALETTE.find((c) => !usedColors.has(c));
  return available ?? CATEGORY_COLOR_PALETTE[existingCategories.length % CATEGORY_COLOR_PALETTE.length];
}
