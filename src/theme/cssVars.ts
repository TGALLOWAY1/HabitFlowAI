/**
 * Runtime CSS-variable emission for the HabitFlow theme.
 *
 * The Tailwind config consumes semantic token names (e.g. `bg-surface-1`,
 * `text-content-muted`) that resolve through CSS variables. This module
 * emits those variables from the TypeScript palette so the CSS and TS
 * values can never drift apart.
 *
 * `index.css` also contains hand-written `:root` / `.dark` blocks as a
 * pre-hydration fallback so the first paint is never unstyled.
 */

import { palette, hexToTriplet, type ThemeColors } from './palette';

const STYLE_TAG_ID = 'hf-theme-vars';

/**
 * Map token keys (camelCase in TS) to CSS variable names (kebab).
 * Heatmap is emitted as an indexed family (--heatmap-0 .. --heatmap-4)
 * and is handled specially.
 */
const VAR_NAMES: Readonly<Record<keyof Omit<ThemeColors, 'heatmap'>, string>> = {
  surface0: '--surface-0',
  surface1: '--surface-1',
  surface2: '--surface-2',
  contentPrimary: '--content-primary',
  contentSecondary: '--content-secondary',
  contentMuted: '--content-muted',
  contentOnAccent: '--content-on-accent',
  lineSubtle: '--line-subtle',
  lineStrong: '--line-strong',
  accent: '--accent',
  accentStrong: '--accent-strong',
  accentSoft: '--accent-soft',
  accentContrast: '--accent-contrast',
  warning: '--warning',
  warningSoft: '--warning-soft',
  warningContrast: '--warning-contrast',
  danger: '--danger',
  dangerSoft: '--danger-soft',
  dangerContrast: '--danger-contrast',
  focus: '--focus-ring',
  chartGrid: '--chart-grid',
  chartAxis: '--chart-axis',
  chartTooltipBg: '--chart-tooltip-bg',
};

function emitBlock(selector: string, colors: ThemeColors): string {
  const lines: string[] = [];
  (Object.keys(VAR_NAMES) as Array<keyof typeof VAR_NAMES>).forEach((key) => {
    const varName = VAR_NAMES[key];
    const hex = colors[key];
    lines.push(`  ${varName}: ${hexToTriplet(hex)};`);
  });
  colors.heatmap.forEach((hex, idx) => {
    lines.push(`  --heatmap-${idx}: ${hexToTriplet(hex)};`);
  });
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * Generate the full CSS text for both theme blocks.
 * Light is the default (`:root`); dark is activated by `.dark` on <html>.
 */
export function buildThemeCss(): string {
  return [
    emitBlock(':root', palette.light),
    emitBlock('.dark', palette.dark),
  ].join('\n\n');
}

/**
 * Inject (or update) the theme CSS variables into the document head.
 * Safe to call repeatedly; idempotent.
 *
 * In JSDOM / test environments where `document` is defined, this still
 * works and the vars will be readable by any assertion that parses them
 * from the style node.
 */
export function ensureThemeVarsInjected(): void {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  const css = buildThemeCss();

  if (existing) {
    if (existing.textContent !== css) {
      existing.textContent = css;
    }
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = css;
  document.head.appendChild(style);
}
