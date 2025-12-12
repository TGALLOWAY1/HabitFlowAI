/**
 * Routine Log Routes
 * 
 * Express request handlers for routine log resources.
 */

import type { Request, Response } from 'express';
import { getRoutineLogsByUser } from '../repositories/routineLogRepository';

/**
 * Get all routine logs for the authenticated user.
 * 
 * GET /api/routineLogs
 */
export const getRoutineLogs = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        const routineLogs = await getRoutineLogsByUser(userId);

        res.status(200).json({
            routineLogs,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to get routine logs:', errorMessage);
        res.status(500).json({ error: { message: 'Failed to retrieve routine logs' } });
    }
};

