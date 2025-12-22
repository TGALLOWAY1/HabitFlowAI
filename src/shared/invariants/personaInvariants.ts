/**
 * Persona Invariants (Dev-only guardrails)
 *
 * Persona MUST be view-only:
 * - must never affect active userId
 * - must never change data-layer endpoint selection
 * - must never be passed into HabitEntry CRUD payloads/headers/query
 *
 * These checks are intentionally lightweight and warn-only by default.
 */

export function warnIfPersonaLeaksIntoHabitEntryRequest(input: {
  endpoint: string;
  headers?: Record<string, string>;
  body?: unknown;
}): void {
  if (!import.meta.env.DEV) return;

  // HabitEntry endpoints in this app:
  // - /entries (create)
  // - /entries/:id (update/delete)
  // - /entries/key... (delete by key)
  const isHabitEntryEndpoint =
    input.endpoint.includes('/entries');

  if (!isHabitEntryEndpoint) return;

  const headerPersona = input.headers?.['X-Persona'] || input.headers?.['x-persona'];
  const hasPersonaHeader = typeof headerPersona === 'string' && headerPersona.trim().length > 0;

  let hasPersonaInBody = false;
  try {
    if (typeof input.body === 'string') {
      const parsed = JSON.parse(input.body);
      hasPersonaInBody = !!(parsed?.personaId || parsed?.activePersonaId || parsed?.persona);
    } else if (typeof input.body === 'object' && input.body !== null) {
      const b: any = input.body;
      hasPersonaInBody = !!(b.personaId || b.activePersonaId || b.persona);
    }
  } catch {
    // ignore parse errors
  }

  const hasPersonaInEndpoint = /[?&]persona(Id)?=/.test(input.endpoint);

  if (hasPersonaHeader || hasPersonaInBody || hasPersonaInEndpoint) {
    // eslint-disable-next-line no-console
    console.warn('[PersonaInvariant] Persona data leaked into HabitEntry request. This must never happen.', {
      endpoint: input.endpoint,
      hasPersonaHeader,
      hasPersonaInEndpoint,
      hasPersonaInBody,
    });
  }
}


