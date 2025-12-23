import type { PersonaConfig } from './personaTypes';
import { FITNESS_PERSONA_ID } from './personaConstants';

export const fitnessPersona: PersonaConfig = {
  id: FITNESS_PERSONA_ID,
  displayName: 'Fitness Focused',

  dashboardWidgets: [
    { type: 'header' },
    // Readiness snapshot is part of Daily Context card (layout contract)
  ],

  checkinSubset: [
    'readiness',
    'soreness',
    'hydration',
    'fueling',
    'recovery',
    'energy',
  ],
};

