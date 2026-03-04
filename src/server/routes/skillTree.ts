import express from 'express';
import { getSkillTree } from '../services/skillTreeService';
import { getRequestIdentity } from '../middleware/identity';

const router = express.Router();

/**
 * GET /api/skill-tree
 * Returns the full skill tree with aggregated progress metrics.
 */
router.get('/', async (req, res) => {
    try {
        const { householdId, userId } = getRequestIdentity(req);
        const data = await getSkillTree(householdId, userId);

        res.json(data);
    } catch (error) {
        console.error('Failed to fetch skill tree:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export const skillTreeRouter = router;
