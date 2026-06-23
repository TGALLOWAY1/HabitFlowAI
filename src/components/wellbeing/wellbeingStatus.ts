import type { DailyWellbeing } from '../../models/persistenceTypes';

/** Morning check-in metric keys that indicate the morning check-in was completed. */
const MORNING_CHECKIN_KEYS = ['mood', 'energy', 'anxiety', 'motivation', 'focus'] as const;
/** Evening check-in metric keys that indicate the evening check-in was completed. */
const EVENING_CHECKIN_KEYS = ['satisfaction', 'productivity', 'mood', 'stress', 'enjoyment'] as const;
/** Sleep keys that indicate sleep was logged for the day. */
const SLEEP_KEYS = ['appleSleepScore', 'sleepDurationMinutes', 'sleepBedtimeMinutes', 'sleepQuality'] as const;

export interface WellbeingDayStatus {
  morningDone: boolean;
  eveningDone: boolean;
  sleepLogged: boolean;
}

function hasAnyKey(session: Record<string, unknown> | undefined, keys: readonly string[]): boolean {
  if (!session) return false;
  return keys.some((k) => {
    const v = session[k];
    return v !== undefined && v !== null && v !== '';
  });
}

/** Derive today's wellbeing completion status from the aggregated daily log. */
export function getWellbeingDayStatus(daily: DailyWellbeing | undefined): WellbeingDayStatus {
  const morning = daily?.morning as Record<string, unknown> | undefined;
  const evening = daily?.evening as Record<string, unknown> | undefined;
  return {
    morningDone: hasAnyKey(morning, MORNING_CHECKIN_KEYS),
    eveningDone: hasAnyKey(evening, EVENING_CHECKIN_KEYS),
    sleepLogged: hasAnyKey(morning, SLEEP_KEYS),
  };
}
