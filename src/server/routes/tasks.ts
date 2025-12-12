/**
 * Task Routes
 * 
 * REST API endpoints for Task entities.
 */

import type { Request, Response } from 'express';
import {
    createTask,
    getTasks,
    updateTask,
    deleteTask,
} from '../repositories/taskRepository';

/**
 * Get all tasks for the current user.
 * 
 * GET /api/tasks
 */
export async function getTasksRoute(req: Request, res: Response): Promise<void> {
    try {
        // TODO: Extract userId from authentication token/session
        const userId = (req as any).userId || 'anonymous-user';

        const tasks = await getTasks(userId);

        res.status(200).json({
            tasks,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching tasks:', errorMessage);
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch tasks',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            },
        });
    }
}

/**
 * Create a new task.
 * 
 * POST /api/tasks
 */
export async function createTaskRoute(req: Request, res: Response): Promise<void> {
    try {
        const { title, listPlacement, linkedGoalId } = req.body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Task title is required and must be a non-empty string',
                },
            });
            return;
        }

        // TODO: Extract userId from authentication token/session
        const userId = (req as any).userId || 'anonymous-user';

        const task = await createTask(
            {
                title: title.trim(),
                listPlacement,
                linkedGoalId,
            },
            userId
        );

        res.status(201).json({
            task,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error creating task:', errorMessage);
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to create task',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            },
        });
    }
}

/**
 * Update a task.
 * 
 * PATCH /api/tasks/:id
 */
export async function updateTaskRoute(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { title, status, listPlacement, linkedGoalId } = req.body;

        if (!id) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Task ID is required',
                },
            });
            return;
        }

        // Validate update data
        // We construct a strictly typed patch object
        const patch: any = {};

        if (title !== undefined) {
            if (typeof title !== 'string' || title.trim().length === 0) {
                res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Task title must be a non-empty string',
                    },
                });
                return;
            }
            patch.title = title.trim();
        }

        if (status !== undefined) {
            if (!['active', 'completed', 'deleted'].includes(status)) {
                res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid status',
                    },
                });
                return;
            }
            patch.status = status;
        }

        if (listPlacement !== undefined) {
            if (!['inbox', 'today'].includes(listPlacement)) {
                res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid list placement',
                    },
                });
                return;
            }
            patch.listPlacement = listPlacement;
        }

        if (linkedGoalId !== undefined) {
            patch.linkedGoalId = linkedGoalId;
        }

        if (Object.keys(patch).length === 0) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'At least one field must be provided for update',
                },
            });
            return;
        }

        // TODO: Extract userId from authentication token/session
        const userId = (req as any).userId || 'anonymous-user';

        const task = await updateTask(id, userId, patch);

        if (!task) {
            res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Task not found',
                },
            });
            return;
        }

        res.status(200).json({
            task,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error updating task:', errorMessage);
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to update task',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            },
        });
    }
}

/**
 * Delete a task.
 * 
 * DELETE /api/tasks/:id
 */
export async function deleteTaskRoute(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Task ID is required',
                },
            });
            return;
        }

        // TODO: Extract userId from authentication token/session
        const userId = (req as any).userId || 'anonymous-user';

        const deleted = await deleteTask(id, userId);

        if (!deleted) {
            res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Task not found',
                },
            });
            return;
        }

        res.status(200).json({
            message: 'Task deleted successfully',
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error deleting task:', errorMessage);
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete task',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
            },
        });
    }
}
