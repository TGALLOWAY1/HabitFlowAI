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
 * 
 * NOTE: Fitness persona dashboard not yet wired here.
 * Currently only supports EMOTIONAL_PERSONA_ID.
 * Fitness persona routing is handled directly in ProgressDashboard.tsx.
 */
export function DashboardComposer(personaId: PersonaId): DashboardWidgetDescriptor[] {
  switch (personaId) {
    case EMOTIONAL_PERSONA_ID:
      return emotionalWellbeingPersona.dashboardWidgets;
    default:
      return emotionalWellbeingPersona.dashboardWidgets;
  }
}


