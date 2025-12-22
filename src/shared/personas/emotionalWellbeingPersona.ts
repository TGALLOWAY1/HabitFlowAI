import type { PersonaConfig } from './personaTypes';

export const emotionalWellbeingPersona: PersonaConfig = {
  id: 'emotional_wellbeing',
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
    'depression',
    'anxiety',
    'energy',
    'sleepScore',
  ],
};


