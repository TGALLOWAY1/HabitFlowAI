/**
 * HabitFlow theme palette — single source of truth.
 *
 * Both light and dark themes share the same token keys. Values here are the
 * ONLY place hex strings should live for theming purposes (category colors
 * for data encoding remain in src/utils/categoryColors.ts).
 *
 * These hex values are also emitted as CSS variables at runtime
 * (see src/theme/cssVars.ts), so the Tailwind semantic aliases like
 * `bg-surface-1` and `text-content-muted` resolve correctly for whichever
 * theme class is on the <html> element.
 *
 * Design intent is documented in the plan at
 * /Users/tjgalloway/.claude/plans/purring-growing-corbato.md
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export interface ThemeColors {
  /** App background (page) */
  surface0: string;
  /** Cards, modal panels, primary containers */
  surface1: string;
  /** Elevated surfaces: popovers, tooltips, nested cards, hover tints */
  surface2: string;

  /** Headings, high-emphasis body text */
  contentPrimary: string;
  /** Body copy, labels */
  contentSecondary: string;
  /** Hints, captions, placeholders */
  contentMuted: string;
  /** Text drawn on an accent-colored background (e.g. white on emerald) */
  contentOnAccent: string;

  /** Hairline dividers between sections */
  lineSubtle: string;
  /** Form-field borders, table borders */
  lineStrong: string;

  /** Primary brand fill (buttons, active indicators) */
  accent: string;
  /** Hover / pressed / chart-line deep */
  accentStrong: string;
  /** Tinted soft fill for chips, selection bg, tags */
  accentSoft: string;
  /** Readable accent-flavored text on surface backgrounds */
  accentContrast: string;

  /** Warning solid fill */
  warning: string;
  /** Warning tinted bg (e.g. notification banners) */
  warningSoft: string;
  /** Warning-flavored text on surface backgrounds */
  warningContrast: string;

  /** Danger solid fill */
  danger: string;
  /** Danger tinted bg (delete confirmations, error banners) */
  dangerSoft: string;
  /** Danger-flavored text on surface backgrounds */
  dangerContrast: string;

  /** Focus ring color — visually distinct from accent in light */
  focus: string;

  /** Chart gridlines */
  chartGrid: string;
  /** Chart axis labels */
  chartAxis: string;
  /** Chart tooltip background */
  chartTooltipBg: string;

  /** Heatmap intensity ladder (index 0 = empty, 4 = strongest) */
  heatmap: readonly [string, string, string, string, string];
}

/**
 * Light mode: calm, premium, slightly warm. Cards are the whitest surface;
 * the app background is a softer warm-gray so cards read as elevated.
 */
const light: ThemeColors = {
  surface0: '#fafafa',
  surface1: '#ffffff',
  surface2: '#f5f5f5',

  contentPrimary: '#171717',
  contentSecondary: '#525252',
  contentMuted: '#737373',
  contentOnAccent: '#ffffff',

  lineSubtle: '#e5e5e5',
  lineStrong: '#d4d4d4',

  accent: '#10b981',
  accentStrong: '#059669',
  accentSoft: '#ecfdf5',
  accentContrast: '#047857',

  warning: '#d97706',
  warningSoft: '#fef3c7',
  warningContrast: '#b45309',

  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  dangerContrast: '#b91c1c',

  focus: '#2563eb',

  chartGrid: '#e5e5e5',
  chartAxis: '#737373',
  chartTooltipBg: '#ffffff',

  heatmap: ['#f5f5f5', '#d1fae5', '#6ee7b7', '#10b981', '#047857'],
};

/**
 * Dark mode: preserves the current HabitFlow appearance. Do not tune these
 * values casually — existing users should see no change when they first
 * upgrade to a themed build.
 */
const dark: ThemeColors = {
  surface0: '#171717',
  surface1: '#262626',
  surface2: '#404040',

  contentPrimary: '#ffffff',
  contentSecondary: '#d4d4d4',
  contentMuted: '#a3a3a3',
  contentOnAccent: '#0a0a0a',

  lineSubtle: '#2a2a2a',
  lineStrong: '#404040',

  accent: '#10b981',
  accentStrong: '#34d399',
  accentSoft: '#0a2e23',
  accentContrast: '#34d399',

  warning: '#f59e0b',
  warningSoft: '#3a2a0a',
  warningContrast: '#fbbf24',

  danger: '#fb7185',
  dangerSoft: '#3a0d14',
  dangerContrast: '#fda4af',

  focus: '#10b981',

  chartGrid: '#404040',
  chartAxis: '#a3a3a3',
  chartTooltipBg: '#262626',

  heatmap: ['#262626', '#064e3b', '#047857', '#10b981', '#6ee7b7'],
};

export const palette: Readonly<Record<ResolvedThemeMode, ThemeColors>> = {
  light,
  dark,
};

/**
 * Convert a hex color (#rrggbb) to a space-separated RGB triplet string
 * suitable for use as a CSS variable consumed by Tailwind's
 * `rgb(var(--token) / <alpha-value>)` pattern.
 *
 * @example hexToTriplet('#10b981') === '16 185 129'
 */
export function hexToTriplet(hex: string): string {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length !== 6) {
    throw new Error(`hexToTriplet: expected 6-digit hex, got "${hex}"`);
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) {
    throw new Error(`hexToTriplet: invalid hex digits in "${hex}"`);
  }
  return `${r} ${g} ${b}`;
}
