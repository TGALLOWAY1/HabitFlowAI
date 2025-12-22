import type { DashboardWidgetDescriptor, PersonaId } from './personaTypes';
import { emotionalWellbeingPersona } from './emotionalWellbeingPersona';
import { EMOTIONAL_PERSONA_ID } from './personaConstants';

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
    case EMOTIONAL_PERSONA_ID:
      return emotionalWellbeingPersona.dashboardWidgets;
    default:
      return emotionalWellbeingPersona.dashboardWidgets;
  }
}


