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

const router = Router();

// Placeholder for user ID until auth is implemented
const USER_ID = 'anonymous-user';

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
        const { routineId, stepId, date } = req.body;

        if (!routineId || !stepId || !date) {
            return res.status(400).json({ error: 'Missing required fields: routineId, stepId, date' });
        }

        // 1. Check if evidence already exists for this step instantiation (de-dupe)
        const exists = await evidenceExistsForStep(routineId, stepId, date, USER_ID);
        if (exists) {
            // Idempotent success - we already have it
            return res.status(200).json({ status: 'exists', message: 'Evidence already recorded' });
        }

        // 2. Load the routine to check for habit linkage
        const routine = await getRoutine(USER_ID, routineId);
        if (!routine) {
            return res.status(404).json({ error: 'Routine not found' });
        }

        // 3. Find the step
        const step = routine.steps.find((s) => s.id === stepId);
        if (!step) {
            return res.status(404).json({ error: 'Step not found in routine' });
        }

        // 4. Check if linked to a habit
        // Note: 'linkedHabitId' is the field in RoutineStep (see persistenceTypes.ts)
        if (!step.linkedHabitId) {
            // Not linked, so no evidence to generate. This is normal.
            return res.status(200).json({ status: 'ignored', message: 'Step not linked to habit' });
        }

        // 5. Create potential evidence
        const evidence = await createPotentialEvidence({
            habitId: step.linkedHabitId,
            routineId,
            stepId,
            date,
            timestamp: new Date().toISOString(),
            source: 'routine-step'
        }, USER_ID);

        res.status(201).json(evidence);

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
 */
router.get('/', async (req, res) => {
    try {
        const { date } = req.query;

        if (!date || typeof date !== 'string') {
            return res.status(400).json({ error: 'Missing required query param: date' });
        }

        const evidence = await getPotentialEvidence(date, USER_ID);
        res.json(evidence);

    } catch (error) {
        console.error('Error fetching evidence:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
