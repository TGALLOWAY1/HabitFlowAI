
import express from 'express';
import { getSkillTree } from '../services/skillTreeService';

const router = express.Router();

/**
 * GET /api/skill-tree
 * Returns the full skill tree with aggregated progress metrics.
 */
router.get('/', async (_req, res) => {
    try {
        // Mock user ID for now - In real app, get from auth middleware
        const userId = 'anonymous-user';

        const data = await getSkillTree(userId);

        res.json(data);
    } catch (error) {
        console.error('Failed to fetch skill tree:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export const skillTreeRouter = router;
