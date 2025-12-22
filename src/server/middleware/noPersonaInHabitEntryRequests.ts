/**
 * Dev-only guard: persona must never be sent to HabitEntry endpoints.
 *
 * This middleware:
 * - warns if persona data is present (query/header/body)
 * - strips persona fields from body to prevent accidental persistence pollution
 * - never blocks requests (warn-only)
 */

import type { Request, Response, NextFunction } from 'express';

const PERSONA_BODY_FIELDS = ['personaId', 'activePersonaId', 'persona'];

export function noPersonaInHabitEntryRequests(req: Request, _res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production') {
    next();
    return;
  }

  // We only care about HabitEntry routes:
  // /api/entries, /api/entries/:id, /api/entries/key, etc.
  if (!req.path.startsWith('/api/entries')) {
    next();
    return;
  }

  const hasPersonaQuery = typeof (req.query as any)?.persona !== 'undefined' || typeof (req.query as any)?.personaId !== 'undefined';
  const headerPersona = req.headers['x-persona'] || (req.headers as any)['X-Persona'];
  const hasPersonaHeader = typeof headerPersona === 'string' && headerPersona.trim().length > 0;

  let hasPersonaBody = false;
  if (req.body && typeof req.body === 'object') {
    for (const f of PERSONA_BODY_FIELDS) {
      if ((req.body as any)[f] !== undefined) {
        hasPersonaBody = true;
        // Strip to avoid persistence pollution
        delete (req.body as any)[f];
      }
    }
  }

  if (hasPersonaQuery || hasPersonaHeader || hasPersonaBody) {
    // eslint-disable-next-line no-console
    console.warn('[PersonaGuard] Persona data detected on HabitEntry request. This is not allowed; ignoring/stripping.', {
      path: req.path,
      hasPersonaQuery,
      hasPersonaHeader,
      hasPersonaBody,
    });
  }

  next();
}


