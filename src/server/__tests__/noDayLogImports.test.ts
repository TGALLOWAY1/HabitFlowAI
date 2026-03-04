/**
 * Regression test: no server module may import DayLogs routes or repository.
 * Ensures DayLogs removal is complete and no accidental re-introduction.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SERVER_ROOT = join(__dirname, '..');
const FORBIDDEN_PATTERNS = [
  /from\s+['\"].*dayLogRepository['\"]/,
  /require\s*\(\s*['\"].*dayLogRepository['\"]\s*\)/,
  /from\s+['\"].*\/dayLogs['\"]/,
  /from\s+['\"].*routes\/dayLogs['\"]/,
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

describe('No DayLog imports (regression)', () => {
  it('no server source file imports dayLogRepository or dayLogs route', () => {
    const violations: string[] = [];
    for (const { path: filePath, content } of walkTsFiles(SERVER_ROOT)) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${filePath}: matches ${pattern.source}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
