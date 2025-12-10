import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Activity } from '../types';
import type { ActivityLog } from '../models/persistenceTypes';
import {
    fetchActivities,
    fetchActivityLogs, // Import new fetch function
    createActivity as createActivityApi,
    updateActivity as updateActivityApi,
    deleteActivity as deleteActivityApi,
} from '../lib/persistenceClient';

interface ActivityContextType {
    activities: Activity[];
    activityLogs: Record<string, ActivityLog>; // Add to context interface
    loading: boolean;
    error?: string;
    refreshActivities: () => Promise<void>;
    addActivity: (data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<Activity>;
    updateActivity: (id: string, patch: Partial<Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>) => Promise<Activity>;
    deleteActivity: (id: string) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const useActivityStore = () => {
    const context = useContext(ActivityContext);
    if (!context) {
        throw new Error('useActivityStore must be used within an ActivityProvider');
    }
    return context;
};

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // All persistent data is stored in MongoDB via the backend API.
    // localStorage-based persistence is no longer supported.

    // All state starts empty and is loaded from MongoDB via API on mount
    const [activities, setActivities] = useState<Activity[]>([]);
    const [activityLogs, setActivityLogs] = useState<Record<string, ActivityLog>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | undefined>(undefined);

    // Load activities from MongoDB on mount
    useEffect(() => {
        let cancelled = false;

        const loadActivitiesFromApi = async () => {
            setLoading(true);
            setError(undefined);
            try {
                const [apiActivities, apiLogs] = await Promise.all([
                    fetchActivities(),
                    fetchActivityLogs(),
                ]);
                if (cancelled) return;
                setActivities(apiActivities);
                setActivityLogs(apiLogs);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                console.error('Failed to fetch activities from API:', errorMessage);
                setError(errorMessage);
                setLoading(false);
            }
        };

        loadActivitiesFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshActivities = async () => {
        setLoading(true);
        setError(undefined);
        try {
            const [apiActivities, apiLogs] = await Promise.all([
                fetchActivities(),
                fetchActivityLogs(),
            ]);
            setActivities(apiActivities);
            setActivityLogs(apiLogs);
            setLoading(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to refresh activities from API:', errorMessage);
            setError(errorMessage);
            setLoading(false);
            throw err;
        }
    };

    const addActivity = async (data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<Activity> => {
        try {
            const newActivity = await createActivityApi(data);
            // Optimistic update: add to state immediately
            setActivities([...activities, newActivity]);
            return newActivity;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to save activity to API:', errorMessage);
            throw err;
        }
    };

    const updateActivity = async (
        id: string,
        patch: Partial<Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
    ): Promise<Activity> => {
        try {
            const updatedActivity = await updateActivityApi(id, patch);
            // Update state: replace the activity with the updated one
            setActivities(activities.map(a => (a.id === id ? updatedActivity : a)));
            return updatedActivity;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to update activity in API:', errorMessage);
            throw err;
        }
    };

    const deleteActivity = async (id: string): Promise<void> => {
        try {
            await deleteActivityApi(id);
            // Update state: remove the deleted activity
            setActivities(activities.filter(a => a.id !== id));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to delete activity from API:', errorMessage);
            throw err;
        }
    };

    return (
        <ActivityContext.Provider
            value={{
                activities,
                activityLogs,
                loading,
                error,
                refreshActivities,
                addActivity,
                updateActivity,
                deleteActivity,
            }}
        >
            {children}
        </ActivityContext.Provider>
    );
};
