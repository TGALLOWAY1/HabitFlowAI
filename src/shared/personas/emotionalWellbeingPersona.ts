import type { PersonaConfig } from './personaTypes';
import { EMOTIONAL_PERSONA_ID } from './personaConstants';

export const emotionalWellbeingPersona: PersonaConfig = {
  id: EMOTIONAL_PERSONA_ID,
  displayName: 'Emotional Wellbeing',

  dashboardWidgets: [
    { type: 'header' },
    { type: 'currentVibe' },
    { type: 'actionCards' },
    { type: 'gratitudeJar' },
    { type: 'emotionalTrend' },
    { type: 'weeklyTrajectory' },
  ],

  checkinSubset: [
    // TODO: add 'vibe' once we have a stable, contract-locked place to store it.
    'anxiety',
    'lowMood',
    'calm',
    'stress',
    'energy',
  ],
};


