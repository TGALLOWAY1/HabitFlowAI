import type { WellbeingMetricKey } from '../../models/persistenceTypes';
import { DEFAULT_PERSONA_ID, EMOTIONAL_PERSONA_ID } from './personaConstants';

export type PersonaId = typeof DEFAULT_PERSONA_ID | typeof EMOTIONAL_PERSONA_ID;

export type PersonaCheckinKey = WellbeingMetricKey | 'vibe';

export type DashboardWidgetType =
  | 'header'
  | 'currentVibe'
  | 'actionCards'
  | 'gratitudeJar'
  | 'emotionalTrend';

export type DashboardWidgetDescriptor =
  | { type: 'header' }
  | { type: 'currentVibe' }
  | { type: 'actionCards' }
  | { type: 'gratitudeJar' }
  | { type: 'emotionalTrend' };

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


