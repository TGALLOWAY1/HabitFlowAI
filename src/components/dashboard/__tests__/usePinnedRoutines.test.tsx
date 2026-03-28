import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPinnedRoutinesCacheForTests,
  PINNED_ROUTINES_STORAGE_KEY,
  usePinnedRoutines,
} from '../PinnedRoutinesCard';
import { fetchDashboardPrefs, updateDashboardPrefs } from '../../../lib/persistenceClient';

vi.mock('../../../lib/persistenceClient', () => ({
  fetchDashboardPrefs: vi.fn(),
  updateDashboardPrefs: vi.fn(),
}));

const fetchDashboardPrefsMock = vi.mocked(fetchDashboardPrefs);
const updateDashboardPrefsMock = vi.mocked(updateDashboardPrefs);

describe('usePinnedRoutines', () => {
  beforeEach(() => {
    __resetPinnedRoutinesCacheForTests();
    localStorage.clear();
    vi.clearAllMocks();
    fetchDashboardPrefsMock.mockResolvedValue({
      userId: 'u1',
      pinnedRoutineIds: [],
      checkinExtraMetricKeys: [],
      updatedAt: new Date().toISOString(),
    });
    updateDashboardPrefsMock.mockResolvedValue({
      userId: 'u1',
      pinnedRoutineIds: [],
      checkinExtraMetricKeys: [],
      updatedAt: new Date().toISOString(),
    });
  });

  it('pins a routine and persists via localStorage + backend write', async () => {
    const { result } = renderHook(() => usePinnedRoutines());

    await act(async () => {
      result.current.togglePin('routine-1');
    });

    expect(result.current.pinnedIds).toEqual(['routine-1']);
    expect(localStorage.getItem(PINNED_ROUTINES_STORAGE_KEY)).toBe(JSON.stringify(['routine-1']));
    expect(updateDashboardPrefsMock).toHaveBeenCalledWith({ pinnedRoutineIds: ['routine-1'] });
  });

  it('hydrates from backend persisted state on bootstrap', async () => {
    fetchDashboardPrefsMock.mockResolvedValue({
      userId: 'u1',
      pinnedRoutineIds: ['routine-2'],
      checkinExtraMetricKeys: [],
      updatedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => usePinnedRoutines());

    await waitFor(() => {
      expect(result.current.pinnedIds).toEqual(['routine-2']);
    });
  });

  it('keeps pinned routines across navigation remount when backend returns empty', async () => {
    localStorage.setItem(PINNED_ROUTINES_STORAGE_KEY, JSON.stringify(['routine-3']));

    const firstMount = renderHook(() => usePinnedRoutines());
    await waitFor(() => {
      expect(firstMount.result.current.pinnedIds).toEqual(['routine-3']);
    });
    firstMount.unmount();

    const secondMount = renderHook(() => usePinnedRoutines());
    await waitFor(() => {
      expect(secondMount.result.current.pinnedIds).toEqual(['routine-3']);
    });
  });

  it('restores pinned routines from persisted local state after full app reload', async () => {
    localStorage.setItem(PINNED_ROUTINES_STORAGE_KEY, JSON.stringify(['routine-4']));
    __resetPinnedRoutinesCacheForTests(); // Simulate full page reload resetting module state

    const { result } = renderHook(() => usePinnedRoutines());

    await waitFor(() => {
      expect(result.current.pinnedIds).toEqual(['routine-4']);
    });
  });
});

