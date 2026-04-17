/**
 * `useThemeColors` — React hook returning the active palette as hex strings.
 *
 * Use inside recharts components, SVG consumers, inline `style={{...}}`
 * gradient builders — anywhere the Tailwind class layer can't reach.
 *
 * Prefer Tailwind semantic classes (`bg-surface-1`, `text-content-muted`)
 * wherever possible. This hook is only for hex consumers.
 */

import { palette, type ThemeColors } from './palette';
import { useTheme } from './ThemeContext';

export function useThemeColors(): ThemeColors {
  const { resolvedMode } = useTheme();
  return palette[resolvedMode];
}
