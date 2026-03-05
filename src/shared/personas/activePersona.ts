import type { PersonaConfig } from './personaTypes';
import { defaultPersona } from './defaultPersona';

/**
 * Active persona config. Always returns the default persona (Mode/persona switch removed).
 * Used by Daily Check-in for checkinSubset.
 */
export function getActivePersonaConfig(): PersonaConfig {
  return defaultPersona;
}
