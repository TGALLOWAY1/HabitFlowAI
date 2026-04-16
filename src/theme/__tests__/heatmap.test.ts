import { describe, it, expect } from 'vitest';
import { getHeatmapColor, HEATMAP_LEVELS } from '../heatmap';

describe('getHeatmapColor', () => {
  it('returns 5 distinct hex values per mode', () => {
    for (const mode of ['light', 'dark'] as const) {
      const values = Array.from({ length: HEATMAP_LEVELS }, (_, i) => getHeatmapColor(i, mode));
      expect(new Set(values).size).toBe(HEATMAP_LEVELS);
      values.forEach((hex) => expect(hex).toMatch(/^#[0-9a-f]{6}$/i));
    }
  });

  it('clamps intensities below 0 and above max', () => {
    expect(getHeatmapColor(-1, 'light')).toBe(getHeatmapColor(0, 'light'));
    expect(getHeatmapColor(99, 'dark')).toBe(getHeatmapColor(HEATMAP_LEVELS - 1, 'dark'));
  });

  it('light and dark ladders are different', () => {
    const light = Array.from({ length: HEATMAP_LEVELS }, (_, i) => getHeatmapColor(i, 'light'));
    const dark = Array.from({ length: HEATMAP_LEVELS }, (_, i) => getHeatmapColor(i, 'dark'));
    expect(light).not.toEqual(dark);
  });
});
