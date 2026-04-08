import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TTLCache } from '../cache';

describe('TTLCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for missing keys', () => {
    const cache = new TTLCache<string>(1000);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('stores and retrieves values', () => {
    const cache = new TTLCache<string>(1000);
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('expires entries after TTL', () => {
    const cache = new TTLCache<string>(1000);
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    vi.advanceTimersByTime(999);
    expect(cache.get('key1')).toBe('value1');

    vi.advanceTimersByTime(2);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('evicts oldest entry when at maxEntries', () => {
    const cache = new TTLCache<string>(10_000, 3);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.size).toBe(3);

    cache.set('d', '4');
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('d')).toBe('4');
  });

  it('invalidates a specific key', () => {
    const cache = new TTLCache<string>(10_000);
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.invalidate('key1');
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
  });

  it('invalidates by prefix', () => {
    const cache = new TTLCache<string>(10_000);
    cache.set('user1:progress', 'data1');
    cache.set('user1:analytics', 'data2');
    cache.set('user2:progress', 'data3');
    cache.invalidateByPrefix('user1:');
    expect(cache.get('user1:progress')).toBeUndefined();
    expect(cache.get('user1:analytics')).toBeUndefined();
    expect(cache.get('user2:progress')).toBe('data3');
  });

  it('clears all entries', () => {
    const cache = new TTLCache<string>(10_000);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('stores complex objects', () => {
    const cache = new TTLCache<{ score: number; items: string[] }>(5000);
    const data = { score: 95, items: ['a', 'b'] };
    cache.set('complex', data);
    expect(cache.get('complex')).toEqual(data);
  });
});
