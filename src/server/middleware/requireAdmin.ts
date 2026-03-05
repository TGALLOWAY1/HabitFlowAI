/**
 * Require authenticated admin (session with role === 'admin').
 * Returns 401 if not authenticated, 403 if not admin.
 */

import type { Request, Response, NextFunction } from 'express';
import type { RequestWithIdentity } from './identity';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const r = req as RequestWithIdentity;
  if (r.householdId == null || r.userId == null) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (r.authUser?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  next();
}
