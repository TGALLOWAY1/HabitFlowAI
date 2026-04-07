import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
    fetchDaySummary,

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
    moveHabitToCategory: (habitId: string, targetCategoryId: string) => Promise<void>;
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
    loading: boolean;
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
    const [loading, setLoading] = useState(true);

    // Use refs to prevent double execution in React StrictMode
    const initializedRef = useRef(false);
    const hasLoadedWellbeingRef = useRef(false);

    const toLocalDayKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getCanonicalSummaryWindow = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 400);
        return {
            startDayKey: toLocalDayKey(start),
            endDayKey: toLocalDayKey(end),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        };
    };

    // Helper function to load canonical day summary derived from HabitEntries.
    const loadLogsFromApi = useCallback(async () => {
        try {
            const { startDayKey, endDayKey, timeZone } = getCanonicalSummaryWindow();
            const apiLogs = await fetchDaySummary(startDayKey, endDayKey, timeZone);
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
    // Habits are fetched first because the backend may auto-create a "No Category"
    // for orphaned habits during GET /api/habits. Fetching categories afterward
    // ensures the new category is included.
    const refreshHabitsAndCategories = useCallback(async () => {
        try {
            const apiHabits = await fetchHabits();
            const apiCategories = await fetchCategories();
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
        // Prevent double execution in React StrictMode
        if (initializedRef.current) {
            return;
        }
        initializedRef.current = true;

        const initialize = async () => {
            try {
                // Fire all data fetches in parallel — one failure doesn't block others
                const results = await Promise.allSettled([
                    refreshHabitsAndCategories(),
                    loadLogsFromApi(),
                    loadWellbeingLogsFromApi().then(() => {
                        hasLoadedWellbeingRef.current = true;
                    }),
                    fetchEvidenceForToday()
                ]);

                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(`[HabitContext] Fetch ${index} failed:`, result.reason);
                    }
                });

                setLoading(false);
            } catch (error) {
                console.error('[HabitContext] Error in initialize():', error);
                setLoading(false);
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
            await saveWellbeingLog(mergedData);
        } catch (error) {
            console.error('Failed to save wellbeing log to API:', error instanceof Error ? error.message : 'Unknown error');
            // Rollback to previous state
            setWellbeingLogs(previousWellbeingLogs);
            setLastPersistenceError("Some changes couldn't be saved. Please try again.");
        }
    };

    const addCategory = async (category: Omit<Category, 'id'>) => {
        // Optimistic update: show the category immediately with a temp ID
        const tempId = `temp-${Date.now()}`;
        const optimisticCategory: Category = { ...category, id: tempId } as Category;
        setCategories(prev => [...prev, optimisticCategory]);
        try {
            const newCategory = await saveCategory(category);
            // Replace temp category with server-confirmed one
            setCategories(prev => prev.map(c => c.id === tempId ? newCategory : c));
            return newCategory;
        } catch (error) {
            // Rollback optimistic update
            setCategories(prev => prev.filter(c => c.id !== tempId));
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
            // Server uses atomic upsert — may return an existing habit instead of creating a new one.
            // Only append if not already in state to prevent duplicate entries.
            setHabits(prev =>
                prev.some(h => h.id === newHabit.id) ? prev : [...prev, newHabit]
            );
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

    // Moves only the selected habit. For bundle parents, sub-habits keep their own categoryId.
    const moveHabitToCategory = async (habitId: string, targetCategoryId: string): Promise<void> => {
        const previousHabits = habits;
        const habit = habits.find(h => h.id === habitId);
        if (!habit) throw new Error('Habit not found');
        if (habit.categoryId === targetCategoryId) return;

        // Compute order: place at bottom of target category
        const habitsInTarget = habits.filter(h => h.categoryId === targetCategoryId);
        const maxOrder = habitsInTarget.reduce((max, h) => Math.max(max, h.order ?? 0), -1);
        const newOrder = maxOrder + 1;

        // Optimistic update
        setHabits(prev => prev.map(h =>
            h.id === habitId ? { ...h, categoryId: targetCategoryId, order: newOrder } : h
        ));

        try {
            await updateHabitApi(habitId, { categoryId: targetCategoryId, order: newOrder });
        } catch (error) {
            setHabits(previousHabits);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to move habit:', errorMessage);
            throw error;
        }
    };

    const toggleHabit = async (habitId: string, date: string) => {
        const habit = habits.find(h => h.id === habitId);

        // Checklist bundle parent: toggle all children instead of the parent itself
        if (habit?.type === 'bundle' && habit.bundleType === 'checklist' && habit.subHabitIds?.length) {
            const childIds = habit.subHabitIds;
            // Determine direction: if all children are complete, toggle off; otherwise toggle on
            const allComplete = childIds.every(id => logs[`${id}-${date}`]);
            const previousLogs = logs;

            // Optimistic update for all children
            let updatedLogs = { ...logs };
            for (const childId of childIds) {
                const childKey = `${childId}-${date}`;
                if (allComplete) {
                    delete updatedLogs[childKey];
                } else if (!updatedLogs[childKey]) {
                    updatedLogs[childKey] = { habitId: childId, date, value: 1, completed: true };
                }
            }
            setLogs(updatedLogs);

            try {
                const results = await Promise.all(
                    childIds.map(childId => {
                        const childKey = `${childId}-${date}`;
                        const childLog = previousLogs[childKey];
                        if (allComplete) {
                            return clearHabitEntriesForDay(childId, date);
                        } else if (!childLog) {
                            return createHabitEntry({ habitId: childId, date, value: 1, source: 'manual' });
                        }
                        return Promise.resolve(null);
                    })
                );

                // Apply server truth
                setLogs(prev => {
                    const next = { ...prev };
                    childIds.forEach((childId, i) => {
                        const childKey = `${childId}-${date}`;
                        const result = results[i];
                        if (!result) return;
                        if (allComplete) {
                            if (!result.dayLog) {
                                delete next[childKey];
                            } else {
                                next[childKey] = result.dayLog;
                            }
                        } else {
                            if (result.dayLog) {
                                next[childKey] = result.dayLog;
                            }
                        }
                    });
                    return next;
                });
                scheduleBackgroundSync();
            } catch (error) {
                console.error('Failed to toggle checklist bundle:', error instanceof Error ? error.message : 'Unknown error');
                setLogs(previousLogs);
                setLastPersistenceError("Failed to update habit status. Please try again.");
            }
            return;
        }

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
            scheduleBackgroundSync();
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
            scheduleBackgroundSync();
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
            // Find habit before deletion to check if it's a bundle child
            const habitToDelete = habits.find(h => h.id === id);
            const parentId = habitToDelete?.bundleParentId;

            await deleteHabitApi(id);

            // If this habit was a bundle child, remove it from the parent's subHabitIds
            if (parentId) {
                const parent = habits.find(h => h.id === parentId);
                if (parent?.subHabitIds?.includes(id)) {
                    const updatedSubHabitIds = parent.subHabitIds.filter(sid => sid !== id);
                    try {
                        await updateHabitApi(parentId, { subHabitIds: updatedSubHabitIds });
                    } catch (err) {
                        console.error('Failed to update parent bundle after child deletion:', err);
                    }
                }
            }

            // Update state
            const updatedHabits = habits.filter(h => h.id !== id);
            // Also update parent's subHabitIds in local state
            if (parentId) {
                const parentIdx = updatedHabits.findIndex(h => h.id === parentId);
                if (parentIdx !== -1 && updatedHabits[parentIdx].subHabitIds) {
                    updatedHabits[parentIdx] = {
                        ...updatedHabits[parentIdx],
                        subHabitIds: updatedHabits[parentIdx].subHabitIds!.filter(sid => sid !== id)
                    };
                }
            }
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
            // Keep local state aligned with backend behavior:
            // deleted-category habits are moved to "no category" (empty categoryId),
            // or to an existing persisted "No Category" bucket when present.
            const nextCategories = categories.filter(c => c.id !== id);
            const noCategory = nextCategories.find(c => c.name.trim().toLowerCase() === 'no category');
            setCategories(nextCategories);
            setHabits(prev => prev.map(h =>
                h.categoryId === id ? { ...h, categoryId: noCategory?.id ?? '' } : h
            ));
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

        // Import complete: addedCount new, (habitsData.length - addedCount) duplicates skipped

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
            const { startDayKey, endDayKey, timeZone } = getCanonicalSummaryWindow();
            const apiLogs = await fetchDaySummary(startDayKey, endDayKey, timeZone);
            setLogs(apiLogs);
        } catch (error) {
            console.error('Failed to refresh day logs', error);
        }
    };

    // Debounced background sync — ensures eventual consistency without
    // blocking every mutation with a full 400-day refetch.
    const bgSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleBackgroundSync = () => {
        if (bgSyncTimerRef.current) clearTimeout(bgSyncTimerRef.current);
        bgSyncTimerRef.current = setTimeout(() => {
            bgSyncTimerRef.current = null;
            refreshDayLogs();
        }, 30_000);
    };

    // Also sync when the app regains visibility (e.g. switching back from another tab/app)
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                refreshDayLogs();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const upsertHabitEntryContext = async (habitId: string, dateKey: string, data: any = {}) => {
        // Snapshot previous state for rollback
        const previousLogs = logs;

        // Optimistic update: apply value immediately so UI doesn't lag
        if (data.value !== undefined) {
            const habit = habits.find(h => h.id === habitId);
            const value = data.value;
            const completed = habit?.goal?.target ? value >= habit.goal.target : value > 0;
            setLogs(prev => ({
                ...prev,
                [`${habitId}-${dateKey}`]: {
                    habitId,
                    date: dateKey,
                    value,
                    completed,
                },
            }));
        }

        try {
            const { dayLog } = await upsertHabitEntry(habitId, dateKey, data);

            // Update local state with the recomputed DayLog (legacy cache)
            if (dayLog) {
                setLogs(prev => ({
                    ...prev,
                    [`${habitId}-${dateKey}`]: dayLog
                }));
            }

            scheduleBackgroundSync();
        } catch (error) {
            console.error('Failed to upsert habit entry:', error);
            // Rollback to previous state
            setLogs(previousLogs);
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
            scheduleBackgroundSync();
        } catch (error) {
            if (DEBUG_ENTRY_DELETE) {
                console.error('[DEBUG_ENTRY_DELETE] deleteHabitEntryByKeyContext failed:', error);
            }
            console.error('Failed to delete habit entry:', error);
            setLastPersistenceError("Failed to remove habit entry.");
        }
    };


    // Memoize provider value to prevent unnecessary re-renders of consumers.
    // When state hasn't changed (e.g., parent re-renders), consumers keep the
    // cached value and skip re-rendering. When state changes, useMemo re-runs
    // and creates fresh callbacks with correct closures.
    const contextValue = useMemo(() => ({
        categories,
        habits,
        logs,
        wellbeingLogs,
        addCategory,
        updateCategory,
        addHabit,
        updateHabit,
        moveHabitToCategory,
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
        loading,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [categories, habits, logs, wellbeingLogs, potentialEvidence, lastPersistenceError, loading]);

    return (
        <HabitContext.Provider value={contextValue}>
            {children}
        </HabitContext.Provider>
    );
};
