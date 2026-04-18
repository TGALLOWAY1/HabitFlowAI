import type { Category } from '../types';

export const CATEGORY_COLOR_PALETTE = [
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-blue-500',
  'bg-fuchsia-500',
  'bg-cyan-500',
  'bg-green-500',
];

/** Map Tailwind bg-* classes to hex values for use in inline styles (charts, SVG, etc.) */
const BG_TO_HEX: Record<string, string> = {
  'bg-emerald-500': '#10b981',
  'bg-violet-500': '#8b5cf6',
  'bg-rose-500': '#f43f5e',
  'bg-amber-500': '#f59e0b',
  'bg-blue-500': '#3b82f6',
  'bg-fuchsia-500': '#d946ef',
  'bg-cyan-500': '#06b6d4',
  'bg-green-500': '#22c55e',
  'bg-neutral-600': '#525252',
  'bg-neutral-500': '#737373',
};

/** Map Tailwind bg-* classes to their text-* equivalents. */
const BG_TO_TEXT: Record<string, string> = {
  'bg-emerald-500': 'text-emerald-500',
  'bg-violet-500': 'text-violet-500',
  'bg-rose-500': 'text-rose-500',
  'bg-amber-500': 'text-amber-500',
  'bg-blue-500': 'text-blue-500',
  'bg-fuchsia-500': 'text-fuchsia-500',
  'bg-cyan-500': 'text-cyan-500',
  'bg-green-500': 'text-green-500',
  'bg-neutral-600': 'text-neutral-600',
  'bg-neutral-500': 'text-neutral-500',
};

/**
 * Pick the next color from the palette that isn't already used by an existing
 * category. Cycles through the palette once all colors are taken.
 */
export function nextCategoryColor(existingCategories: Category[]): string {
  const usedColors = new Set(existingCategories.map((c) => c.color));
  const available = CATEGORY_COLOR_PALETTE.find((c) => !usedColors.has(c));
  return available ?? CATEGORY_COLOR_PALETTE[existingCategories.length % CATEGORY_COLOR_PALETTE.length];
}

/** Resolve a Tailwind bg-* class (or hex/rgb/hsl value) to a hex color string. */
export function resolveColorHex(color: string): string {
  if (!color.startsWith('bg-')) return color;
  return BG_TO_HEX[color] ?? '#737373';
}

/** Resolve a Tailwind bg-* class to its text-* equivalent. */
export function resolveTextColorClass(color: string): string {
  return BG_TO_TEXT[color] ?? 'text-white';
}
