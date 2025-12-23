import type { PersonaConfig, PersonaId } from './personaTypes';
import { emotionalWellbeingPersona } from './emotionalWellbeingPersona';
import { fitnessPersona } from './fitnessPersona';
import { defaultPersona } from './defaultPersona';
import { ACTIVE_USER_MODE_STORAGE_KEY } from '../demo';
import { DEFAULT_PERSONA_ID, EMOTIONAL_PERSONA_ID, FITNESS_PERSONA_ID } from './personaConstants';

/**
 * Active persona selector (safe defaults).
 *
 * IMPORTANT: Persona is view-only. Do not use persona to affect userId or persistence.
 */
export function resolvePersona(personaId: string | null | undefined): PersonaId {
  if (personaId === EMOTIONAL_PERSONA_ID) return EMOTIONAL_PERSONA_ID;
  if (personaId === FITNESS_PERSONA_ID) return FITNESS_PERSONA_ID;
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

/**
 * DEV ONLY: Read persona from URL query parameter
 * @returns PersonaId if valid query param found, null otherwise
 */
function getPersonaFromQueryParam(): PersonaId | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  const personaParam = params.get('persona');
  
  if (!personaParam) return null;
  
  // Map query param values to persona IDs
  switch (personaParam.toLowerCase()) {
    case 'fitness':
      return FITNESS_PERSONA_ID;
    case 'emotional':
      return EMOTIONAL_PERSONA_ID;
    case 'default':
      return DEFAULT_PERSONA_ID;
    default:
      return null;
  }
}

export function getActivePersonaId(): PersonaId {
  // DEV ONLY: Check query param first (highest priority)
  if (import.meta.env.DEV) {
    const queryPersona = getPersonaFromQueryParam();
    if (queryPersona) {
      return queryPersona;
    }
  }
  
  // Safe temporary rule (until a persona selector UI exists):
  // - Demo mode defaults to Emotional Wellbeing
  // - Real mode defaults to Default persona (legacy dashboard)
  return getUserMode() === 'demo' ? EMOTIONAL_PERSONA_ID : DEFAULT_PERSONA_ID;
}

export function getActivePersonaConfig(): PersonaConfig {
  const id = getActivePersonaId();
  if (id === EMOTIONAL_PERSONA_ID) return emotionalWellbeingPersona;
  if (id === FITNESS_PERSONA_ID) return fitnessPersona;
  return defaultPersona;
}


