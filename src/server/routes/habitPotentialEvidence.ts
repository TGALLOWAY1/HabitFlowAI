/**
 * Habit Potential Evidence Routes
 * 
 * Handles endpoints for recording and retrieving potential habit evidence.
 * These endpoints are used by the Routine Executor to signal "potential" habit completion.
 */

import { Router } from 'express';
import {
    createPotentialEvidence,
    getPotentialEvidence,
    evidenceExistsForStep
} from '../repositories/habitPotentialEvidenceRepository';
import { getRoutine } from '../repositories/routineRepository';
import { getRequestIdentity } from '../middleware/identity';

const router = Router();

/**
 * POST /api/evidence/step-reached
 * 
 * Records that a specific step in a routine was reached.
 * If the step is linked to a habit, creates a HabitPotentialEvidence record.
 * 
 * Body: { routineId, stepId, date }
 */
router.post('/step-reached', async (req, res) => {
    try {
        const { householdId, userId } = getRequestIdentity(req);
        const { routineId, stepId, date, variantId } = req.body;

        if (!routineId || !stepId || !date) {
            return res.status(400).json({ error: 'Missing required fields: routineId, stepId, date' });
        }

        const exists = await evidenceExistsForStep(routineId, stepId, date, householdId, userId);
        if (exists) {
            return res.status(200).json({ data: { status: 'exists', message: 'Evidence already recorded' } });
        }

        const routine = await getRoutine(householdId, userId, routineId);
        if (!routine) {
            return res.status(404).json({ error: 'Routine not found' });
        }

        // Find step: check variant steps first, then fall back to root steps
        let step = null;
        if (variantId && routine.variants) {
            const variant = routine.variants.find(v => v.id === variantId);
            if (variant) {
                step = variant.steps.find((s) => s.id === stepId);
            }
        }
        if (!step) {
            // Fallback: search all variants then root steps
            if (routine.variants) {
                for (const v of routine.variants) {
                    step = v.steps.find((s) => s.id === stepId);
                    if (step) break;
                }
            }
            if (!step) {
                step = routine.steps.find((s) => s.id === stepId);
            }
        }

        if (!step) {
            return res.status(404).json({ error: 'Step not found in routine' });
        }

        if (!step.linkedHabitId) {
            return res.status(200).json({ data: { status: 'ignored', message: 'Step not linked to habit' } });
        }

        const evidence = await createPotentialEvidence({
            habitId: step.linkedHabitId,
            routineId,
            stepId,
            date,
            timestamp: new Date().toISOString(),
            source: 'routine-step',
            ...(variantId ? { variantId } : {}),
        }, householdId, userId);

        res.status(201).json({ data: evidence });

    } catch (error) {
        console.error('Error recording step reached:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/evidence
 * 
 * Get potential evidence for a specific day.
 * Query: ?date=YYYY-MM-DD
 * 
 * Returns: { data: { evidence: HabitPotentialEvidence[] } }
 */
router.get('/', async (req, res) => {
    try {
        const { householdId, userId } = getRequestIdentity(req);
        const { date } = req.query;

        if (!date || typeof date !== 'string') {
            return res.status(400).json({ error: 'Missing required query param: date' });
        }

        const evidence = await getPotentialEvidence(date, householdId, userId);
        res.json({ evidence });

    } catch (error) {
        console.error('Error fetching evidence:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
