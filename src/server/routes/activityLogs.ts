/**
 * Activity Log Routes
 * 
 * Express request handlers for activity log resources.
 */

import type { Request, Response } from 'express';
import { getActivityLogsByUser } from '../repositories/activityLogRepository';

/**
 * Get all activity logs for the authenticated user.
 * 
 * GET /api/activityLogs
 */
export const getActivityLogs = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        const activityLogs = await getActivityLogsByUser(userId);

        res.status(200).json({
            activityLogs,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to get activity logs:', errorMessage);
        res.status(500).json({ error: { message: 'Failed to retrieve activity logs' } });
    }
};
