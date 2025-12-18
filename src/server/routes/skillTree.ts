
import express from 'express';
import { getSkillTree } from '../services/skillTreeService';

const router = express.Router();

/**
 * GET /api/skill-tree
 * Returns the full skill tree with aggregated progress metrics.
 */
router.get('/', async (req, res) => {
    try {
        const userId = (req as any).userId;
        console.log(`[SkillTree API] Request from userId: ${userId}`);
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const data = await getSkillTree(userId);

        res.json(data);
    } catch (error) {
        console.error('Failed to fetch skill tree:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export const skillTreeRouter = router;
