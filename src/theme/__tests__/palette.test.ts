import { describe, it, expect } from 'vitest';
import { palette, hexToTriplet, type ThemeColors } from '../palette';

const HEX_RE = /^#[0-9a-f]{6}$/i;

describe('palette', () => {
  const modes = ['light', 'dark'] as const;

  for (const mode of modes) {
    describe(mode, () => {
      const p = palette[mode];

      it('has a valid 6-digit hex for every scalar color token', () => {
        (Object.entries(p) as Array<[keyof ThemeColors, unknown]>).forEach(([key, value]) => {
          if (key === 'heatmap') return;
          expect(value, `${mode}.${key}`).toMatch(HEX_RE);
        });
      });

      it('has exactly 5 heatmap steps, all valid hex', () => {
        expect(p.heatmap).toHaveLength(5);
        p.heatmap.forEach((hex, idx) => {
          expect(hex, `${mode}.heatmap[${idx}]`).toMatch(HEX_RE);
        });
      });

      it('heatmap steps are unique', () => {
        expect(new Set(p.heatmap).size).toBe(p.heatmap.length);
      });
    });
  }

  it('light and dark have the same set of keys', () => {
    expect(Object.keys(palette.light).sort()).toEqual(Object.keys(palette.dark).sort());
  });
});

describe('hexToTriplet', () => {
  it('converts #rrggbb to space-separated RGB triplet', () => {
    expect(hexToTriplet('#10b981')).toBe('16 185 129');
    expect(hexToTriplet('#ffffff')).toBe('255 255 255');
    expect(hexToTriplet('#000000')).toBe('0 0 0');
  });

  it('accepts hex without leading #', () => {
    expect(hexToTriplet('10b981')).toBe('16 185 129');
  });

  it('throws on malformed input', () => {
    expect(() => hexToTriplet('#xyz')).toThrow();
    expect(() => hexToTriplet('#fff')).toThrow();
    expect(() => hexToTriplet('')).toThrow();
  });
});
