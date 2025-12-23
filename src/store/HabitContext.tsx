import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { Category, Habit, DayLog, DailyWellbeing, HabitPotentialEvidence } from '../types';
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

    fetchWellbeingLogs,
    saveWellbeingLog,
    reorderHabits as reorderHabitsApi,
    updateCategory as updateCategoryApi,
    createHabitEntry,
    clearHabitEntriesForDay,
    updateHabitEntry,
    deleteHabitEntry,
    fetchPotentialEvidence,
    upsertHabitEntry,
    deleteHabitEntryByKey,
} from '../lib/persistenceClient';

interface HabitContextType {
    categories: Category[];
    habits: Habit[];
    logs: Record<string, DayLog>; // Key: `${habitId}-${date}`
    addCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
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
    updateHabitEntry: (id: string, patch: any) => Promise<void>; // eslint-disable-line @typescript-eslint/no-explicit-any
    deleteHabitEntry: (id: string) => Promise<void>;
    upsertHabitEntry: (habitId: string, dateKey: string, data?: any) => Promise<void>;
    deleteHabitEntryByKey: (habitId: string, dateKey: string) => Promise<void>;
    potentialEvidence: HabitPotentialEvidence[];
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
    const [potentialEvidence, setPotentialEvidence] = useState<HabitPotentialEvidence[]>([]);
    const [lastPersistenceError, setLastPersistenceError] = useState<string | null>(null);

    // Use refs to prevent double execution in React StrictMode
    const initializedRef = useRef(false);
    const hasLoadedWellbeingRef = useRef(false);

    // Helper function to load day logs (LEGACY - for write compatibility only)
    // NOTE: Reads should use /api/dayView endpoint instead
    const loadLogsFromApi = useCallback(async () => {
        if (process.env.NODE_ENV === 'development') {
            console.warn('[LEGACY READ WARNING] HabitContext.loadLogsFromApi is loading DayLogs. Day View should use /api/dayView endpoint instead.');
        }
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

    const fetchEvidenceForToday = useCallback(async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const evidence = await fetchPotentialEvidence(today);
            setPotentialEvidence(evidence);
        } catch (error) {
            console.error('Failed to fetch potential evidence:', error);
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
                    loadWellbeingLogsFromApi().then(() => {
                        console.log('[HabitContext] Wellbeing logs loaded');
                        hasLoadedWellbeingRef.current = true;
                    }),
                    fetchEvidenceForToday().then(() => console.log('[HabitContext] Evidence loaded'))
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

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps - only run once on mount, callbacks are stable

    // Demo seed/reset refresh: re-fetch wellbeing logs (and habits/categories already refreshed in Layout).
    // Only refresh if we've already done the initial load (to avoid double-fetching on mount)
    // Only reload for explicit seed/reset operations, not for individual entry updates
    useEffect(() => {
        type DemoDataChangedDetail = { reason?: 'seed' | 'reset' | 'other' };
        const handler = async (evt: Event) => {
            const custom = evt as CustomEvent<DemoDataChangedDetail>;
            // Only reload for seed/reset operations
            if (custom.detail?.reason !== 'seed' && custom.detail?.reason !== 'reset') {
                return; // Ignore other demo-data-changed events
            }
            // Only refresh if initial load has completed
            if (!hasLoadedWellbeingRef.current) {
                return; // Skip if initial load hasn't happened yet
            }
            try {
                await loadWellbeingLogsFromApi();
            } catch {
                // ignore (best-effort)
            }
        };
        window.addEventListener('habitflow:demo-data-changed', handler as any);
        return () => window.removeEventListener('habitflow:demo-data-changed', handler as any);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps - handler uses stable loadWellbeingLogsFromApi from closure


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
            return newCategory;
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
            // Updating state with functional update to ensure latest state
            setHabits(prev => [...prev, newHabit]);
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
            setHabits(prev => prev.map(h => h.id === id ? updatedHabit : h));
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

        // Optimistic Update
        if (currentLog) {
            // Toggle off - delete log
            const { [key]: _unused, ...rest } = logs; // eslint-disable-line @typescript-eslint/no-unused-vars
            updatedLogs = rest;
        } else {
            // Toggle on - create log
            // Temporary shape, will be overwritten by server response
            const logToSave: DayLog = { habitId, date, value: 1, completed: true };
            updatedLogs = {
                ...logs,
                [key]: logToSave,
            };
        }

        // Apply Optimistic update
        setLogs(updatedLogs);

        try {
            if (currentLog) {
                // Delete all entries for this day (Clear Day)
                const { dayLog } = await clearHabitEntriesForDay(habitId, date);

                // If server returns a dayLog (e.g., partial delete?), update state
                // If null, it confirms deletion
                if (dayLog) {
                    setLogs(prev => ({ ...prev, [key]: dayLog }));
                } else {
                    // Confirmed deletion, ensure it's gone
                    setLogs(prev => {
                        const { [key]: _unused, ...rest } = prev; // eslint-disable-line @typescript-eslint/no-unused-vars
                        return rest;
                    });
                }
            } else {
                // Create Entry (Toggle On)
                const { dayLog } = await createHabitEntry({
                    habitId,
                    date,
                    value: 1,
                    source: 'manual'
                });

                // Update state with server truth
                if (dayLog) {
                    setLogs(prev => ({ ...prev, [key]: dayLog }));
                }
            }
        } catch (error) {
            console.error('Failed to toggle habit:', error instanceof Error ? error.message : 'Unknown error');
            // Rollback to previous state
            setLogs(previousLogs);
            setLastPersistenceError("Failed to update habit status. Please try again.");
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

        try {
            // 1. Clear existing entries to enforce "Set Value" semantics
            await clearHabitEntriesForDay(habitId, date);

            // 2. Create new entry with total value
            const { dayLog } = await createHabitEntry({
                habitId,
                date,
                value,
                source: 'manual'
            });

            if (dayLog) {
                setLogs(prev => ({ ...prev, [key]: dayLog }));
            }
        } catch (error) {
            console.error('Failed to update log:', error instanceof Error ? error.message : 'Unknown error');
            // Rollback to previous state
            setLogs(previousLogs);
            setLastPersistenceError("Failed to update log value. Please try again.");
        }
    };

    const updateHabitEntryContext = async (id: string, patch: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        try {
            await updateHabitEntry(id, patch);
            await refreshDayLogs();
        } catch (error) {
            console.error('Failed to update habit entry:', error);
            throw error;
        }
    };

    const deleteHabitEntryContext = async (id: string) => {
        try {
            await deleteHabitEntry(id);
            await refreshDayLogs();
        } catch (error) {
            console.error('Failed to delete habit entry:', error);
            throw error;
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
        const updatedCategories = [...latestCategories];
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
        const updatedHabits = [...latestHabits];
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


    const upsertHabitEntryContext = async (habitId: string, dateKey: string, data: any = {}) => {
        try {
            // Optimistic update logic could go here, but for now we rely on the server response
            const { dayLog } = await upsertHabitEntry(habitId, dateKey, data);

            // Update local state with the recomputed DayLog (legacy cache)
            if (dayLog) {
                setLogs(prev => ({
                    ...prev,
                    [`${habitId}-${dateKey}`]: dayLog
                }));
            }

            // Re-fetch evidence or habits if needed?
        } catch (error) {
            console.error('Failed to upsert habit entry:', error);
            setLastPersistenceError("Failed to save habit entry.");
        }
    };

    const deleteHabitEntryByKeyContext = async (habitId: string, dateKey: string) => {
        // [DEBUG_ENTRY_DELETE] Log deletion request
        const DEBUG_ENTRY_DELETE = false; // Set to true for debugging
        if (DEBUG_ENTRY_DELETE) {
            console.log('[DEBUG_ENTRY_DELETE] deleteHabitEntryByKeyContext called:', {
                habitId,
                dateKey,
                requestPayload: { habitId, dateKey }
            });
        }
        try {
            const { dayLog } = await deleteHabitEntryByKey(habitId, dateKey);

            if (DEBUG_ENTRY_DELETE) {
                console.log('[DEBUG_ENTRY_DELETE] deleteHabitEntryByKey API response:', {
                    success: true,
                    dayLog: dayLog ? 'exists' : 'null (entry deleted)',
                    dayLogDetails: dayLog
                });
            }

            // Update local state
            setLogs(prev => {
                const newLogs = { ...prev };
                if (dayLog) {
                    newLogs[`${habitId}-${dateKey}`] = dayLog;
                    if (DEBUG_ENTRY_DELETE) {
                        console.log('[DEBUG_ENTRY_DELETE] Local state updated: log exists (entry partially deleted or other entries remain)');
                    }
                } else {
                    // Log deleted (unchecked) -> Remove from state
                    delete newLogs[`${habitId}-${dateKey}`];
                    if (DEBUG_ENTRY_DELETE) {
                        console.log('[DEBUG_ENTRY_DELETE] Local state updated: log removed (all entries deleted)');
                    }
                }
                return newLogs;
            });
        } catch (error) {
            if (DEBUG_ENTRY_DELETE) {
                console.error('[DEBUG_ENTRY_DELETE] deleteHabitEntryByKeyContext failed:', error);
            }
            console.error('Failed to delete habit entry:', error);
            setLastPersistenceError("Failed to remove habit entry.");
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
            updateHabitEntry: updateHabitEntryContext,
            deleteHabitEntry: deleteHabitEntryContext,
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
            potentialEvidence,
            upsertHabitEntry: upsertHabitEntryContext,
            deleteHabitEntryByKey: deleteHabitEntryByKeyContext,
        }}>
            {children}
        </HabitContext.Provider>
    );
};
