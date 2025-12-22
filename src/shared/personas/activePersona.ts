import type { PersonaConfig, PersonaId } from './personaTypes';
import { emotionalWellbeingPersona } from './emotionalWellbeingPersona';
import { defaultPersona } from './defaultPersona';
import { ACTIVE_USER_MODE_STORAGE_KEY } from '../demo';
import { DEFAULT_PERSONA_ID, EMOTIONAL_PERSONA_ID } from './personaConstants';

/**
 * Active persona selector (safe defaults).
 *
 * IMPORTANT: Persona is view-only. Do not use persona to affect userId or persistence.
 */
export function resolvePersona(personaId: string | null | undefined): PersonaId {
  if (personaId === EMOTIONAL_PERSONA_ID) return EMOTIONAL_PERSONA_ID;
  if (personaId === DEFAULT_PERSONA_ID) return DEFAULT_PERSONA_ID;

  if (import.meta.env?.DEV && personaId) {
    // Safety rail: never auto-fall back to emotional.
    // Unknown personas must map to DEFAULT.
    // eslint-disable-next-line no-console
    console.warn(`[Persona] Unknown personaId "${personaId}". Falling back to DEFAULT.`);
  }
  return DEFAULT_PERSONA_ID;
}

function getUserMode(): 'real' | 'demo' {
  if (typeof window === 'undefined') return 'real';
  const raw = localStorage.getItem(ACTIVE_USER_MODE_STORAGE_KEY);
  return raw === 'demo' ? 'demo' : 'real';
}

export function getActivePersonaId(): PersonaId {
  // Safe temporary rule (until a persona selector UI exists):
  // - Demo mode defaults to Emotional Wellbeing
  // - Real mode defaults to Default persona (legacy dashboard)
  return getUserMode() === 'demo' ? EMOTIONAL_PERSONA_ID : DEFAULT_PERSONA_ID;
}

export function getActivePersonaConfig(): PersonaConfig {
  const id = getActivePersonaId();
  return id === EMOTIONAL_PERSONA_ID ? emotionalWellbeingPersona : defaultPersona;
}


