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
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => {
        if (key === 'habitflow_household_id') return 'default-household';
        if (key === 'habitflow_user_id') return 'test-user-id';
        if (key === 'habitflow_active_user_mode') return null;
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function expectIdentityHeadersPresent(init: RequestInit | undefined): void {
    expect(init?.headers).toBeDefined();
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-Household-Id']).toBeDefined();
    expect(typeof headers['X-Household-Id']).toBe('string');
    expect(headers['X-Household-Id'].length).toBeGreaterThan(0);
    expect(headers['X-User-Id']).toBeDefined();
    expect(typeof headers['X-User-Id']).toBe('string');
    expect(headers['X-User-Id'].length).toBeGreaterThan(0);
  }

  it('sends X-Household-Id and X-User-Id on GET requests (fetchTasks)', async () => {
    await persistenceClient.fetchTasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectIdentityHeadersPresent(fetchMock.mock.calls[0][1]);
  });

  it('sends X-Household-Id and X-User-Id on POST requests (recordRoutineStepReached)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await persistenceClient.recordRoutineStepReached('r1', 's1', '2025-06-01');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectIdentityHeadersPresent(fetchMock.mock.calls[0][1]);
  });
});
