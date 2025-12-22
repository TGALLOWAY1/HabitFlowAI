import type { WellbeingMetricKey } from '../../models/persistenceTypes';

export type PersonaId = 'emotional_wellbeing';

export type PersonaCheckinKey = WellbeingMetricKey | 'vibe';

export type DashboardWidgetType =
  | 'header'
  | 'currentVibe'
  | 'actionCards'
  | 'gratitudeJar'
  | 'emotionalTrend'
  | 'weeklyTrajectory';

export type DashboardWidgetDescriptor =
  | { type: 'header' }
  | { type: 'currentVibe' }
  | { type: 'actionCards' }
  | { type: 'gratitudeJar' }
  | { type: 'emotionalTrend' }
  | { type: 'weeklyTrajectory' };

/**
 * PersonaConfig
 *
 * IMPORTANT:
 * - Persona config may affect ONLY view composition + UI defaults.
 * - Persona must NEVER affect userId, API routes, or persistence/CRUD behavior.
 */
export interface PersonaConfig {
  id: PersonaId;
  displayName: string;

  /** Ordered list of dashboard widgets (composition only) */
  dashboardWidgets: DashboardWidgetDescriptor[];

  /** Ordered subset of wellbeing metrics to show in Daily Check-in UI */
  checkinSubset: PersonaCheckinKey[];
}


