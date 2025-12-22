import type { PersonaConfig } from './personaTypes';
import { DEFAULT_PERSONA_ID } from './personaConstants';

/**
 * Default persona (legacy dashboard)
 *
 * This persona exists to preserve the original dashboard layout.
 * It should be the default for real-user mode.
 */
export const defaultPersona: PersonaConfig = {
  id: DEFAULT_PERSONA_ID,
  displayName: 'Default',
  // Not used for legacy dashboard composition (we do not rebuild legacy via composer).
  dashboardWidgets: [],
  // Default check-in shows the full existing wellbeing check-in fields.
  checkinSubset: ['depression', 'anxiety', 'energy', 'sleepScore'],
};


