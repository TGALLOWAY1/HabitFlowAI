/**
 * Task Repository
 * 
 * MongoDB data access layer for Task entities.
 * Provides CRUD operations for tasks with user-scoped queries.
 */

import { getDb } from '../lib/mongoClient';
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '../../types/task';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';

const COLLECTION_NAME = MONGO_COLLECTIONS.TASKS;

/**
 * Create a new task.
 */
export async function createTask(
    data: CreateTaskRequest,
    userId: string
): Promise<Task> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const document: any = {
        id,
        userId,
        title: data.title,
        status: 'active',
        listPlacement: data.listPlacement || 'inbox',
        linkedGoalId: data.linkedGoalId,
        createdAt: now,
        completedAt: undefined,
        movedToTodayAt: undefined,
    };

    // If created directly in 'today', set the movedToTodayAt timestamp
    if (document.listPlacement === 'today') {
        document.movedToTodayAt = now;
    }

    await collection.insertOne(document);

    const { _id, userId: _, ...task } = document;
    return task as Task;
}

/**
 * Get all tasks for a user (status != 'deleted').
 */
export async function getTasks(userId: string): Promise<Task[]> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find({
            userId,
            status: { $ne: 'deleted' }
        })
        .sort({ createdAt: -1 }) // Newest first by default
        .toArray();

    return documents.map(({ _id, userId: _, ...task }) => task as Task);
}

/**
 * Update a task.
 */
export async function updateTask(
    id: string,
    userId: string,
    patch: UpdateTaskRequest
): Promise<Task | null> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // If moving to 'today' and it wasn't there before, set movedToTodayAt
    // We need to check current state if we want to be precise, or just always update it if provided.
    // For simplicity and to support re-promoting, we can update it if listPlacement is 'today'.
    const updateData: any = { ...patch };

    if (patch.listPlacement === 'today') {
        updateData.movedToTodayAt = new Date().toISOString();
    }

    if (patch.status === 'completed' && !updateData.completedAt) {
        updateData.completedAt = new Date().toISOString();
    } else if (patch.status === 'active') {
        updateData.completedAt = null; // Reset if un-completing
    }

    const result = await collection.findOneAndUpdate(
        { id, userId },
        { $set: updateData },
        { returnDocument: 'after' }
    );

    if (!result) {
        return null;
    }

    const { _id, userId: _, ...task } = result;
    return task as Task;
}

/**
 * Delete a task (soft delete).
 */
export async function deleteTask(
    id: string,
    userId: string
): Promise<boolean> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.findOneAndUpdate(
        { id, userId },
        { $set: { status: 'deleted' } }
    );

    return !!result;
}
