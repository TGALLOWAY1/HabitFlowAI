/**
 * Regression tests: no server module may import DayLogs or manual goal log modules.
 * Ensures M6 legacy removal is complete and no accidental re-introduction.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SERVER_ROOT = join(__dirname, '..');

const DAYLOG_FORBIDDEN = [
  /from\s+['\"].*dayLogRepository['\"]/,
  /require\s*\(\s*['\"].*dayLogRepository['\"]\s*\)/,
  /from\s+['\"].*\/dayLogs['\"]/,
  /from\s+['\"].*routes\/dayLogs['\"]/,
];

const MANUAL_LOG_FORBIDDEN = [
  /from\s+['\"].*goalManualLogRepository['\"]/,
  /require\s*\(\s*['\"].*goalManualLogRepository['\"]\s*\)/,
  /from\s+['\"].*routes\/.*[Mm]anual[Ll]og['\"]/,
];

function* walkTsFiles(dir: string, relative = ''): Generator<{ path: string; content: string }> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = relative ? `${relative}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      yield* walkTsFiles(join(dir, e.name), rel);
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
      yield {
        path: rel,
        content: readFileSync(join(dir, e.name), 'utf-8'),
      };
    }
  }
}

function collectViolations(patterns: RegExp[]): string[] {
  const violations: string[] = [];
  for (const { path: filePath, content } of walkTsFiles(SERVER_ROOT)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        violations.push(`${filePath}: matches ${pattern.source}`);
      }
    }
  }
  return violations;
}

describe('No legacy DayLog / manual-log imports (M6 guardrails)', () => {
  it('no server source file imports dayLogRepository or dayLogs route', () => {
    const violations = collectViolations(DAYLOG_FORBIDDEN);
    expect(violations).toEqual([]);
  });

  it('no server source file imports goalManualLogRepository or manual-log routes', () => {
    const violations = collectViolations(MANUAL_LOG_FORBIDDEN);
    expect(violations).toEqual([]);
  });
});
