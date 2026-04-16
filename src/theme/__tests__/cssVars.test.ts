import { describe, it, expect, beforeEach } from 'vitest';
import { buildThemeCss, ensureThemeVarsInjected } from '../cssVars';

describe('buildThemeCss', () => {
  const css = buildThemeCss();

  it('emits both :root and .dark blocks', () => {
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
  });

  it('emits space-separated RGB triplets (not commas)', () => {
    // Any var declaration must look like `--name: N N N;`
    const varLines = css.match(/--[a-z0-9-]+:\s*[^;]+;/g) ?? [];
    expect(varLines.length).toBeGreaterThan(0);
    for (const line of varLines) {
      expect(line, `bad var line: ${line}`).toMatch(/--[a-z0-9-]+:\s*\d+\s+\d+\s+\d+;/);
      expect(line, `var should not contain comma: ${line}`).not.toContain(',');
      expect(line, `var should not contain rgb(: ${line}`).not.toContain('rgb(');
    }
  });

  it('includes all 5 heatmap steps in each block', () => {
    for (let i = 0; i < 5; i++) {
      expect(css).toContain(`--heatmap-${i}`);
    }
  });
});

describe('ensureThemeVarsInjected', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('creates a <style id="hf-theme-vars"> on first call', () => {
    ensureThemeVarsInjected();
    const node = document.getElementById('hf-theme-vars');
    expect(node).toBeTruthy();
    expect(node?.tagName).toBe('STYLE');
  });

  it('is idempotent — does not duplicate the style node', () => {
    ensureThemeVarsInjected();
    ensureThemeVarsInjected();
    ensureThemeVarsInjected();
    expect(document.querySelectorAll('style#hf-theme-vars')).toHaveLength(1);
  });
});
