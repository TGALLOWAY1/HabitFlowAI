/**
 * Journal Routes
 * 
 * REST API endpoints for JournalEntry entities.
 */

import type { Request, Response } from 'express';
import {
    createEntry,
    getEntriesByUser,
    getEntryById,
    updateEntry,
    deleteEntry,
} from '../repositories/journal';
import type { JournalEntry } from '../../models/persistenceTypes';

/**
 * Get all journal entries for the current user.
 * 
 * GET /api/journal
 */
export async function getEntriesRoute(req: Request, res: Response): Promise<void> {
    try {
        // TODO: Extract userId from authentication token/session
        const userId = (req as any).userId || 'anonymous-user';

        const entries = await getEntriesByUser(userId);

        res.status(200).json({
            entries,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching journal entries:', errorMessage);
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch journal entries',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            },
        });
    }
}

/**
 * Create a new journal entry.
 * 
 * POST /api/journal
 */
export async function createEntryRoute(req: Request, res: Response): Promise<void> {
    try {
        const { templateId, mode, persona, content, date } = req.body;

        if (!templateId || typeof templateId !== 'string') {
            res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'Template ID is required' },
            });
            return;
        }

        if (!mode || typeof mode !== 'string') {
            res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'Mode is required' },
            });
            return;
        }

        if (!content || typeof content !== 'object') {
            res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'Content is required' },
            });
            return;
        }

        if (!date || typeof date !== 'string') {
            res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'Date is required (YYYY-MM-DD)' },
            });
            return;
        }

        // TODO: Extract userId from authentication token/session
        const userId = (req as any).userId || 'anonymous-user';

        const entry = await createEntry(
            {
                templateId,
                mode: mode as JournalEntry['mode'],
                persona: persona || undefined,
                content,
                date,
            },
            userId
        );

        res.status(201).json({
            entry,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error creating journal entry:', errorMessage);
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to create journal entry',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            },
        });
    }
}

/**
 * Get a single journal entry by ID.
 * 
 * GET /api/journal/:id
 */
export async function getEntryRoute(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'Entry ID is required' },
            });
            return;
        }

        // TODO: Extract userId from authentication token/session
        const userId = (req as any).userId || 'anonymous-user';

        const entry = await getEntryById(id, userId);

        if (!entry) {
            res.status(404).json({
                error: { code: 'NOT_FOUND', message: 'Entry not found' },
            });
            return;
        }

        res.status(200).json({
            entry,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching journal entry:', errorMessage);
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch journal entry',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            },
        });
    }
}

/**
 * Update a journal entry.
 * 
 * PATCH /api/journal/:id
 */
export async function updateEntryRoute(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { templateId, mode, persona, content, date } = req.body;

        if (!id) {
            res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'Entry ID is required' },
            });
            return;
        }

        const patch: Partial<Omit<JournalEntry, 'id' | 'createdAt' | 'userId'>> = {};

        if (templateId !== undefined) patch.templateId = templateId;
        if (mode !== undefined) patch.mode = mode;
        if (persona !== undefined) patch.persona = persona;
        if (content !== undefined) patch.content = content;
        if (date !== undefined) patch.date = date;

        if (Object.keys(patch).length === 0) {
            res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'No update fields provided' },
            });
            return;
        }

        // TODO: Extract userId from authentication token/session
        const userId = (req as any).userId || 'anonymous-user';

        const entry = await updateEntry(id, userId, patch);

        if (!entry) {
            res.status(404).json({
                error: { code: 'NOT_FOUND', message: 'Entry not found' },
            });
            return;
        }

        res.status(200).json({
            entry,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error updating journal entry:', errorMessage);
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to update journal entry',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            },
        });
    }
}

/**
 * Delete a journal entry.
 * 
 * DELETE /api/journal/:id
 */
export async function deleteEntryRoute(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: 'Entry ID is required' },
            });
            return;
        }

        // TODO: Extract userId from authentication token/session
        const userId = (req as any).userId || 'anonymous-user';

        const deleted = await deleteEntry(id, userId);

        if (!deleted) {
            res.status(404).json({
                error: { code: 'NOT_FOUND', message: 'Entry not found' },
            });
            return;
        }

        res.status(200).json({
            message: 'Entry deleted successfully',
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error deleting journal entry:', errorMessage);
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete journal entry',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            },
        });
    }
}
