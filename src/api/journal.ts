/**
 * Journal API Client
 * 
 * Frontend client for communicating with the Journal API endpoints.
 */

import { API_BASE_URL } from '../lib/persistenceConfig';
import type { JournalEntry } from '../models/persistenceTypes';
import { getActiveUserId } from '../lib/persistenceClient';

/**
 * Make an API request with error handling.
 */
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const userId = getActiveUserId();

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId,
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.error?.message ||
                `API request failed: ${response.status} ${response.statusText}`
            );
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Unknown error occurred during API request');
    }
}

/**
 * Fetch all journal entries.
 */
export async function fetchEntries(): Promise<JournalEntry[]> {
    const response = await apiRequest<{ entries: JournalEntry[] }>('/journal');
    return response.entries;
}

/**
 * Create a new journal entry.
 */
export async function createEntry(
    data: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
): Promise<JournalEntry> {
    const response = await apiRequest<{ entry: JournalEntry }>('/journal', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    return response.entry;
}

/**
 * Upsert a journal entry by (templateId, date) key.
 * Used for stable per-day reflective truth like "current_vibe".
 */
export async function upsertEntryByKey(
    data: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
): Promise<JournalEntry> {
    const response = await apiRequest<{ entry: JournalEntry }>('/journal/byKey', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return response.entry;
}

/**
 * Get a single journal entry by ID.
 */
export async function fetchEntry(id: string): Promise<JournalEntry> {
    const response = await apiRequest<{ entry: JournalEntry }>(`/journal/${id}`);
    return response.entry;
}

/**
 * Update a journal entry.
 */
export async function updateEntry(
    id: string,
    patch: Partial<Omit<JournalEntry, 'id' | 'createdAt' | 'userId'>>
): Promise<JournalEntry> {
    const response = await apiRequest<{ entry: JournalEntry }>(`/journal/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
    });
    return response.entry;
}

/**
 * Delete a journal entry.
 */
export async function deleteEntry(id: string): Promise<void> {
    await apiRequest<{ message: string }>(`/journal/${id}`, {
        method: 'DELETE'
    });
}
