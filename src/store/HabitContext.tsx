import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { Category, Habit, DayLog, DailyWellbeing } from '../types';
import {
    fetchCategories,
    saveCategory,
    deleteCategory as deleteCategoryApi,
    reorderCategories as reorderCategoriesApi,
    fetchHabits,
    saveHabit,
    updateHabit as updateHabitApi, // Reserved for future use
    deleteHabit as deleteHabitApi,
    fetchDayLogs,
    saveDayLog,
    deleteDayLog as deleteDayLogApi,
    fetchWellbeingLogs,
    saveWellbeingLog,
    reorderHabits as reorderHabitsApi,
    updateCategory as updateCategoryApi,
} from '../lib/persistenceClient';

interface HabitContextType {
    categories: Category[];
    habits: Habit[];
    logs: Record<string, DayLog>; // Key: `${habitId}-${date}`
    addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
    addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Promise<Habit>;
    updateHabit: (id: string, patch: Partial<Omit<Habit, 'id' | 'createdAt'>>) => Promise<Habit>;
    toggleHabit: (habitId: string, date: string) => Promise<void>;
    updateLog: (habitId: string, date: string, value: number) => Promise<void>;
    deleteHabit: (id: string) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    importHabits: (
        categories: Omit<Category, 'id'>[],
        habitsData: { categoryName: string; habit: Omit<Habit, 'id' | 'categoryId' | 'createdAt' | 'archived'> }[]
    ) => Promise<void>;
    reorderCategories: (newOrder: Category[]) => Promise<void>;
    reorderHabits: (newOrderIds: string[]) => Promise<void>;
    wellbeingLogs: Record<string, DailyWellbeing>;
    logWellbeing: (date: string, data: DailyWellbeing) => Promise<void>;
    lastPersistenceError: string | null;
    clearPersistenceError: () => void;
    refreshDayLogs: () => Promise<void>;
    refreshHabitsAndCategories: () => Promise<void>;
    updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => Promise<void>;
}

const HabitContext = createContext<HabitContextType | undefined>(undefined);

export const useHabitStore = () => {
    const context = useContext(HabitContext);
    if (!context) {
        throw new Error('useHabitStore must be used within a HabitProvider');
    }
    return context;
};


export const HabitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // All persistent data is stored in MongoDB via the backend API.
    // localStorage-based persistence is no longer supported.

    // All state starts empty and is loaded from MongoDB via API on mount
    const [categories, setCategories] = useState<Category[]>([]);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [logs, setLogs] = useState<Record<string, DayLog>>({});
    const [wellbeingLogs, setWellbeingLogs] = useState<Record<string, DailyWellbeing>>({});
    const [lastPersistenceError, setLastPersistenceError] = useState<string | null>(null);

    // Use refs to prevent double execution in React StrictMode
    const initializedRef = useRef(false);

    // Helper function to load day logs
    const loadLogsFromApi = useCallback(async () => {
        try {
            const apiLogs = await fetchDayLogs();
            setLogs(apiLogs);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to fetch logs from API:', errorMessage);
            setLastPersistenceError("Couldn't load habit logs. Some data may be missing.");
        }
    }, []);

    // Helper function to load wellbeing logs
    const loadWellbeingLogsFromApi = useCallback(async () => {
        try {
            console.log('[loadWellbeingLogsFromApi] Fetching wellbeing logs from API...');
            const apiWellbeingLogs = await fetchWellbeingLogs();
            console.log('[loadWellbeingLogsFromApi] Received wellbeing logs from API:', {
                count: Object.keys(apiWellbeingLogs).length,
                keys: Object.keys(apiWellbeingLogs),
                logs: apiWellbeingLogs
            });

            // Defensive: Ensure all logs have a valid date field and filter out any that don't
            // Also ensure the Record keys match the date field in each log
            const validatedLogs: Record<string, DailyWellbeing> = {};
            for (const [key, log] of Object.entries(apiWellbeingLogs)) {
                if (log && typeof log === 'object' && log.date && typeof log.date === 'string') {
                    // Use log.date as the canonical key (not the Record key, in case they differ)
                    validatedLogs[log.date] = log;
                    console.log(`[loadWellbeingLogsFromApi] Validated log for date: ${log.date}`);
                } else {
                    console.warn(`[loadWellbeingLogsFromApi] Skipping wellbeing log with invalid or missing date field. Key: ${key}`, log);
                }
            }

            console.log('[loadWellbeingLogsFromApi] Setting validated logs:', {
                count: Object.keys(validatedLogs).length,
                dates: Object.keys(validatedLogs)
            });
            setWellbeingLogs(validatedLogs);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[loadWellbeingLogsFromApi] Failed to fetch wellbeing logs from API:', errorMessage, error);
            setLastPersistenceError("Couldn't load wellbeing logs. Some data may be missing.");
        }
    }, []);

    // Refresh habits and categories helper (used by initial load and manual refresh)
    const refreshHabitsAndCategories = useCallback(async () => {
        try {
            const [apiCategories, apiHabits] = await Promise.all([
                fetchCategories(),
                fetchHabits(),
            ]);
            setCategories(apiCategories);
            setHabits(apiHabits);
        } catch (error) {
            console.error('Failed to refresh habits and categories', error);
            setLastPersistenceError("Couldn't refresh habits and categories. Please try again.");
        }
    }, []);

    // Initial load: categories, habits, logs, and wellbeing logs
    // Each subsystem loads independently so one failure doesn't block others
    useEffect(() => {
        console.log('[HabitContext] Initial load useEffect triggered. initializedRef.current:', initializedRef.current);
        // Prevent double execution in React StrictMode
        if (initializedRef.current) {
            console.log('[HabitContext] Already initialized, skipping');
            return;
        }
        initializedRef.current = true;
        console.log('[HabitContext] Starting initialization...');

        const initialize = async () => {
            console.log('[HabitContext] initialize() called');
            try {
                // Fire all data fetches in parallel to ensure one slow/failed request doesn't block others
                console.log('[HabitContext] Starting parallel data fetch...');

                // We use Promise.allSettled so that if one fails, the others still succeed
                const results = await Promise.allSettled([
                    refreshHabitsAndCategories().then(() => console.log('[HabitContext] Habits/Categories loaded')),
                    loadLogsFromApi().then(() => console.log('[HabitContext] Day logs loaded')),
                    loadWellbeingLogsFromApi().then(() => console.log('[HabitContext] Wellbeing logs loaded'))
                ]);

                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(`[HabitContext] Fetch ${index} failed:`, result.reason);
                    }
                });

                console.log('[HabitContext] Initialization complete');
            } catch (error) {
                console.error('[HabitContext] Error in initialize():', error);
                throw error;
            }
        };

        initialize().catch(error => {
            console.error('[HabitContext] Error during initialization:', error);
        });

    }, [refreshHabitsAndCategories, loadLogsFromApi, loadWellbeingLogsFromApi]);


    const logWellbeing = async (date: string, data: DailyWellbeing) => {
        console.log('[logWellbeing] FUNCTION CALLED with:', { date, data });
        // Snapshot previous state for rollback
        const previousWellbeingLogs = wellbeingLogs;

        // Merge with existing data for the date
        // Ensure date is always set to the parameter value (not from data.date which might differ)
        const existing = wellbeingLogs[date] || { date };
        const mergedData: DailyWellbeing = {
            ...existing,
            ...data,
            // Always use the date parameter as the canonical date key
            date: date,
            // Deep merge morning/evening if provided, preserving the other if not
            morning: data.morning ? { ...existing.morning, ...data.morning } : existing.morning,
            evening: data.evening ? { ...existing.evening, ...data.evening } : existing.evening,
        };

        const updatedWellbeingLogs = {
            ...wellbeingLogs,
            [date]: mergedData,
        };
        // Optimistic update: update state immediately
        setWellbeingLogs(updatedWellbeingLogs);

        // Save to MongoDB
        try {
            console.log('[logWellbeing] Saving wellbeing log:', { date, mergedData });
            const savedLog = await saveWellbeingLog(mergedData);
            console.log('[logWellbeing] Successfully saved wellbeing log:', savedLog);

            // Verify the saved log has a date field
            if (!savedLog.date) {
                console.error('[logWellbeing] WARNING: Saved log missing date field:', savedLog);
            }
        } catch (error) {
            console.error('[logWellbeing] Failed to save wellbeing log to API:', error instanceof Error ? error.message : 'Unknown error', error);
            // Rollback to previous state
            setWellbeingLogs(previousWellbeingLogs);
            setLastPersistenceError("Some changes couldn't be saved. Please try again.");
        }
    };

    const addCategory = async (category: Omit<Category, 'id'>) => {
        try {
            const newCategory = await saveCategory(category);
            setCategories([...categories, newCategory]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to save category to API:', errorMessage);
            throw error;
        }
    };

    const updateCategory = async (id: string, patch: Partial<Omit<Category, 'id'>>) => {
        try {
            const updatedCategory = await updateCategoryApi(id, patch);
            setCategories(categories.map(c => c.id === id ? updatedCategory : c));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to update category in API:', errorMessage);
            throw error;
        }
    };

    const addHabit = async (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>): Promise<Habit> => {
        try {
            const newHabit = await saveHabit(habit);
            setHabits([...habits, newHabit]);
            return newHabit;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to save habit to API:', errorMessage);
            throw error;
        }
    };

    const updateHabit = async (id: string, patch: Partial<Omit<Habit, 'id' | 'createdAt'>>): Promise<Habit> => {
        try {
            const updatedHabit = await updateHabitApi(id, patch);
            setHabits(habits.map(h => h.id === id ? updatedHabit : h));
            return updatedHabit;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to update habit in API:', errorMessage);
            throw error;
        }
    };

    const toggleHabit = async (habitId: string, date: string) => {
        // Snapshot previous state for rollback
        const previousLogs = logs;

        const key = `${habitId}-${date}`;
        const currentLog = logs[key];

        let updatedLogs: Record<string, DayLog>;
        let logToSave: DayLog | null = null;

        if (currentLog) {
            // Toggle off - delete log
            const { [key]: _, ...rest } = logs;
            updatedLogs = rest;
        } else {
            // Toggle on - create log
            logToSave = { habitId, date, value: 1, completed: true };
            updatedLogs = {
                ...logs,
                [key]: logToSave,
            };
        }

        // Optimistic update: update state immediately
        setLogs(updatedLogs);

        // Save to MongoDB
        if (logToSave) {
            try {
                await saveDayLog(logToSave);
            } catch (error) {
                console.error('Failed to save day log to API:', error instanceof Error ? error.message : 'Unknown error');
                // Rollback to previous state
                setLogs(previousLogs);
                setLastPersistenceError("Some changes couldn't be saved. Please try again.");
            }
        } else if (currentLog) {
            // Delete from MongoDB
            try {
                await deleteDayLogApi(habitId, date);
            } catch (error) {
                console.error('Failed to delete day log from API:', error instanceof Error ? error.message : 'Unknown error');
                // Rollback to previous state
                setLogs(previousLogs);
                setLastPersistenceError("Some changes couldn't be saved. Please try again.");
            }
        }
    };

    const updateLog = async (habitId: string, date: string, value: number) => {
        // Snapshot previous state for rollback
        const previousLogs = logs;

        const key = `${habitId}-${date}`;
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        const completed = habit.goal.target ? value >= habit.goal.target : value > 0;

        const logToSave: DayLog = { habitId, date, value, completed };
        const updatedLogs = {
            ...logs,
            [key]: logToSave,
        };
        // Optimistic update: update state immediately
        setLogs(updatedLogs);

        // Save to MongoDB
        try {
            await saveDayLog(logToSave);
        } catch (error) {
            console.error('Failed to save day log to API:', error instanceof Error ? error.message : 'Unknown error');
            // Rollback to previous state
            setLogs(previousLogs);
            setLastPersistenceError("Some changes couldn't be saved. Please try again.");
        }
    };

    const deleteHabit = async (id: string) => {
        try {
            await deleteHabitApi(id);
            // Update state
            const updatedHabits = habits.filter(h => h.id !== id);
            setHabits(updatedHabits);
            // Also remove related logs from state
            const updatedLogs = Object.fromEntries(
                Object.entries(logs).filter(([key]) => !key.startsWith(`${id}-`))
            );
            setLogs(updatedLogs);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to delete habit from API:', errorMessage);
            throw error;
        }
    };

    const deleteCategory = async (id: string) => {
        try {
            await deleteCategoryApi(id);
            setCategories(categories.filter(c => c.id !== id));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to delete category from API:', errorMessage);
            throw error;
        }
    };

    const importHabits = async (
        categoriesToImport: Omit<Category, 'id'>[],
        habitsData: { categoryName: string; habit: Omit<Habit, 'id' | 'categoryId' | 'createdAt' | 'archived'> }[]
    ) => {
        // Refresh data from API to ensure we have the latest state (prevents duplicates from stale local state)
        const [latestCategories, latestHabits] = await Promise.all([
            fetchCategories().catch(() => categories), // Fallback to local state if fetch fails
            fetchHabits().catch(() => habits), // Fallback to local state if fetch fails
        ]);

        // 1. Create Categories if they don't exist
        let updatedCategories = [...latestCategories];
        const categoryMap = new Map<string, string>(); // Name -> ID

        // Map existing categories
        updatedCategories.forEach(c => categoryMap.set(c.name, c.id));

        // Add new categories from import
        for (const c of categoriesToImport) {
            if (!categoryMap.has(c.name)) {
                try {
                    const newCat = await saveCategory(c);
                    updatedCategories.push(newCat);
                    categoryMap.set(c.name, newCat.id);
                } catch (error) {
                    console.error(
                        `Failed to create category "${c.name}" via API:`,
                        error instanceof Error ? error.message : 'Unknown error'
                    );
                    // Continue with other categories even if one fails
                }
            }
        }

        // 2. Create Habits - use latest data from API to check for duplicates
        let updatedHabits = [...latestHabits];
        let addedCount = 0;

        for (const { categoryName, habit } of habitsData) {
            const categoryId = categoryMap.get(categoryName);
            if (categoryId) {
                // Check if habit already exists in the latest data to avoid duplicates
                const exists = updatedHabits.some(h => h.name === habit.name && h.categoryId === categoryId);
                if (!exists) {
                    try {
                        const newHabit = await saveHabit({
                            ...habit,
                            categoryId,
                        });
                        updatedHabits.push(newHabit);
                        addedCount++;
                    } catch (error) {
                        console.error(
                            `Failed to create habit "${habit.name}" via API:`,
                            error instanceof Error ? error.message : 'Unknown error'
                        );
                        // Continue with other habits even if one fails
                    }
                }
            } else {
                console.warn(`Category not found for habit: ${habit.name} (Category: ${categoryName})`);
            }
        }

        console.log(`Imported ${addedCount} new habits (${habitsData.length - addedCount} were duplicates).`);

        // Update state with fresh data
        setCategories(updatedCategories);
        setHabits(updatedHabits);
    };

    const reorderCategories = async (newOrder: Category[]) => {
        try {
            const updatedCategories = await reorderCategoriesApi(newOrder);
            setCategories(updatedCategories);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to reorder categories in API:', errorMessage);
            throw error;
        }
    };

    const reorderHabits = async (newOrderIds: string[]) => {
        // Snapshot previous state for rollback
        const previousHabits = habits;

        // Optimistic update
        // We need to reorder the existing habit objects based on the new ID order
        const habitMap = new Map(habits.map(h => [h.id, h]));
        const reorderedHabits = newOrderIds
            .map(id => habitMap.get(id))
            .filter((h): h is Habit => h !== undefined);

        // If there are any habits missing from the new order (shouldn't happen), append them
        const processedIds = new Set(newOrderIds);
        const remainingHabits = habits.filter(h => !processedIds.has(h.id));

        setHabits([...reorderedHabits, ...remainingHabits]);

        try {
            await reorderHabitsApi(newOrderIds);
        } catch (error) {
            console.error('Failed to reorder habits in API:', error);
            // Rollback
            setHabits(previousHabits);
            setLastPersistenceError("Failed to save new habit order.");
        }
    };

    const clearPersistenceError = () => {
        setLastPersistenceError(null);
    };

    const refreshDayLogs = async () => {
        try {
            const apiLogs = await fetchDayLogs();
            setLogs(apiLogs);
        } catch (error) {
            console.error('Failed to refresh day logs', error);
            // Optional: you may set lastPersistenceError here, but it's OK to just log for now.
        }
    };


    return (
        <HabitContext.Provider value={{
            categories,
            habits,
            logs,
            wellbeingLogs,
            addCategory,
            updateCategory,
            addHabit,
            updateHabit,
            toggleHabit,
            updateLog,
            deleteHabit,
            deleteCategory,
            importHabits,
            reorderCategories,
            reorderHabits,
            logWellbeing,
            lastPersistenceError,
            clearPersistenceError,
            refreshDayLogs,
            refreshHabitsAndCategories,
        }}>
            {children}
        </HabitContext.Provider>
    );
};
