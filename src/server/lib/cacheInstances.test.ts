import { describe, expect, it } from 'vitest';
import { buildUserScopedCacheKey } from './cacheInstances';

describe('buildUserScopedCacheKey', () => {
  it('keeps the user prefix used by cache invalidation', () => {
    expect(buildUserScopedCacheKey('user-1', 'home-1', 'UTC', '2026-03-31', 'habit', 30))
      .toMatch(/^user-1:/);
  });

  it.each([
    ['household', ['user-1', 'home-2', 'UTC', '2026-03-31', 'habit', 30]],
    ['timezone', ['user-1', 'home-1', 'America/New_York', '2026-03-31', 'habit', 30]],
    ['calendar day', ['user-1', 'home-1', 'UTC', '2026-04-01', 'habit', 30]],
  ] as const)('isolates cache entries by %s', (_label, args) => {
    const baseline = buildUserScopedCacheKey('user-1', 'home-1', 'UTC', '2026-03-31', 'habit', 30);
    expect(buildUserScopedCacheKey(...args)).not.toBe(baseline);
  });
});
