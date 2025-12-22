import type { PersonaConfig, PersonaId } from './personaTypes';
import { emotionalWellbeingPersona } from './emotionalWellbeingPersona';

/**
 * Minimal active persona selector (single-persona MVP).
 *
 * IMPORTANT: Persona is view-only. Do not use persona to affect userId or persistence.
 */
export function getActivePersonaId(): PersonaId {
  return 'emotional_wellbeing';
}

export function getActivePersonaConfig(): PersonaConfig {
  return emotionalWellbeingPersona;
}


