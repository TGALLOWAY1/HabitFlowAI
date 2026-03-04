import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as persistenceClient from '../persistenceClient';

describe('persistenceClient identity headers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tasks: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function expectXUserIdPresent(init: RequestInit | undefined): void {
    expect(init?.headers).toBeDefined();
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-User-Id']).toBeDefined();
    expect(typeof headers['X-User-Id']).toBe('string');
    expect(headers['X-User-Id'].length).toBeGreaterThan(0);
  }

  it('sends X-User-Id on GET requests (fetchTasks)', async () => {
    await persistenceClient.fetchTasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectXUserIdPresent(fetchMock.mock.calls[0][1]);
  });

  it('sends X-User-Id on POST requests (recordRoutineStepReached)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await persistenceClient.recordRoutineStepReached('r1', 's1', '2025-06-01');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectXUserIdPresent(fetchMock.mock.calls[0][1]);
  });
});
