/**
 * Household user registry routes.
 * GET /api/household/users - list users for current household
 * POST /api/household/users - create user in household (optional displayName; userId generated if not provided)
 */

import { Router, type Request, type Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { getUsersByHousehold, createHouseholdUser } from '../repositories/householdUserRepository';

const router = Router();

router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { householdId } = getRequestIdentity(req);
    const users = await getUsersByHousehold(householdId);
    res.status(200).json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message },
    });
  }
});

router.post('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { householdId } = getRequestIdentity(req);
    const { userId, displayName } = req.body || {};
    const user = await createHouseholdUser(householdId, {
      userId: typeof userId === 'string' ? userId : undefined,
      displayName: typeof displayName === 'string' ? displayName : undefined,
    });
    res.status(201).json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message },
    });
  }
});

export default router;
