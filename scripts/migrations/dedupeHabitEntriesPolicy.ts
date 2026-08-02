export type DuplicateEntryLike = {
  deletedAt?: string;
  value?: unknown;
  note?: unknown;
  bundleOptionId?: unknown;
  choiceChildHabitId?: unknown;
};

export type DuplicateResolution =
  | 'remove-deleted-collisions'
  | 'collapse-boolean-duplicates'
  | 'collapse-freeze-duplicates'
  | 'sum-numeric-duplicates'
  | 'manual-review';

export interface DuplicateGroupPlan {
  resolution: DuplicateResolution;
  safeToApply: boolean;
  activeCount: number;
  deletedCount: number;
  replacementValue?: number;
  reason: string;
}

function freezeKind(entry: DuplicateEntryLike): 'freeze' | 'entry' {
  return typeof entry.note === 'string' && entry.note.startsWith('freeze:')
    ? 'freeze'
    : 'entry';
}

function choiceKey(entry: DuplicateEntryLike): string | null {
  const key = entry.choiceChildHabitId ?? entry.bundleOptionId;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/**
 * Build a repair plan that preserves the currently derived history.
 * Numeric duplicates are summed because all current read paths sum active
 * values for the DayKey; boolean duplicates collapse by entry existence.
 */
export function planDuplicateHabitEntries(
  entries: DuplicateEntryLike[],
  goalType?: 'boolean' | 'number',
): DuplicateGroupPlan {
  const active = entries.filter(entry => !entry.deletedAt);
  const deletedCount = entries.length - active.length;

  if (active.length <= 1) {
    return {
      resolution: 'remove-deleted-collisions',
      safeToApply: true,
      activeCount: active.length,
      deletedCount,
      reason: 'At most one active document exists, so visible history is unchanged.',
    };
  }

  const freezeKinds = new Set(active.map(freezeKind));
  if (freezeKinds.size > 1) {
    return {
      resolution: 'manual-review',
      safeToApply: false,
      activeCount: active.length,
      deletedCount,
      reason: 'The same DayKey contains both a freeze marker and ordinary progress.',
    };
  }
  if (freezeKinds.has('freeze')) {
    return {
      resolution: 'collapse-freeze-duplicates',
      safeToApply: true,
      activeCount: active.length,
      deletedCount,
      reason: 'All active documents are equivalent streak-protection markers.',
    };
  }

  const distinctChoices = new Set(active.map(choiceKey).filter((key): key is string => key !== null));
  if (distinctChoices.size > 1) {
    return {
      resolution: 'manual-review',
      safeToApply: false,
      activeCount: active.length,
      deletedCount,
      reason: 'The same DayKey contains different choice selections.',
    };
  }

  if (goalType === 'boolean') {
    return {
      resolution: 'collapse-boolean-duplicates',
      safeToApply: true,
      activeCount: active.length,
      deletedCount,
      reason: 'Boolean completion is based on entry existence, so one active document preserves it.',
    };
  }

  if (goalType === 'number') {
    const values = active.map(entry => entry.value);
    if (values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
      return {
        resolution: 'sum-numeric-duplicates',
        safeToApply: true,
        activeCount: active.length,
        deletedCount,
        replacementValue: (values as number[]).reduce((sum, value) => sum + value, 0),
        reason: 'The replacement keeps the same summed quantity currently derived for this DayKey.',
      };
    }
  }

  return {
    resolution: 'manual-review',
    safeToApply: false,
    activeCount: active.length,
    deletedCount,
    reason: 'Habit type or active values are insufficient for a history-preserving automatic repair.',
  };
}
