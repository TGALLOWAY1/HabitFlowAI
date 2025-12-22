import type { DashboardWidgetDescriptor, PersonaId } from './personaTypes';
import { emotionalWellbeingPersona } from './emotionalWellbeingPersona';

/**
 * DashboardComposer (view-only)
 *
 * Input: personaId
 * Output: ordered list of widget descriptors
 *
 * No data fetching allowed here.
 */
export function DashboardComposer(personaId: PersonaId): DashboardWidgetDescriptor[] {
  switch (personaId) {
    case 'emotional_wellbeing':
      return emotionalWellbeingPersona.dashboardWidgets;
    default:
      return emotionalWellbeingPersona.dashboardWidgets;
  }
}


