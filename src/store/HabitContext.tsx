import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../lib/persistenceClient';
import {
    getPersistenceMode,
    isLocalOnly,
    isMongoMigration,
    isMongoPrimary,
    allowLocalStorageFallback,
} from '../lib/persistenceConfig';

interface HabitContextType {
    categories: Category[];
    habits: Habit[];
    logs: Record<string, DayLog>; // Key: `${habitId}-${date}`
    addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
    addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Promise<void>;
    toggleHabit: (habitId: string, date: string) => Promise<void>;
    updateLog: (habitId: string, date: string, value: number) => Promise<void>;
    deleteHabit: (id: string) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    importHabits: (
        categories: Omit<Category, 'id'>[],
        habitsData: { categoryName: string; habit: Omit<Habit, 'id' | 'categoryId' | 'createdAt' | 'archived'> }[]
    ) => Promise<void>;
    reorderCategories: (newOrder: Category[]) => Promise<void>;
    wellbeingLogs: Record<string, DailyWellbeing>;
    logWellbeing: (date: string, data: DailyWellbeing) => Promise<void>;
}

const HabitContext = createContext<HabitContextType | undefined>(undefined);

export const useHabitStore = () => {
    const context = useContext(HabitContext);
    if (!context) {
        throw new Error('useHabitStore must be used within a HabitProvider');
    }
    return context;
};

// Initial Data for Demo
const INITIAL_CATEGORIES: Category[] = [
    { id: '1', name: 'Physical Health', color: 'bg-emerald-500' },
    { id: '2', name: 'Mental Health', color: 'bg-violet-500' },
    { id: '3', name: 'Relationships', color: 'bg-rose-500' },
    { id: '4', name: 'Dog / Home', color: 'bg-amber-500' },
    { id: '5', name: 'Creativity & Skill', color: 'bg-blue-500' },
    { id: '6', name: 'Music', color: 'bg-fuchsia-500' },
    { id: '7', name: 'Career & Growth', color: 'bg-cyan-500' },
    { id: '8', name: 'Financial', color: 'bg-green-500' },
];

const INITIAL_HABITS: Habit[] = [
    {
        id: '1',
        categoryId: '1',
        name: 'Morning Jog',
        goal: { type: 'boolean', frequency: 'daily' },
        archived: false,
        createdAt: new Date().toISOString(),
    },
    {
        id: '2',
        categoryId: '1',
        name: 'Drink Water',
        goal: { type: 'number', target: 8, unit: 'glasses', frequency: 'daily' },
        archived: false,
        createdAt: new Date().toISOString(),
    },
    {
        id: '3',
        categoryId: '2',
        name: 'Deep Work',
        goal: { type: 'number', target: 4, unit: 'hours', frequency: 'daily' },
        archived: false,
        createdAt: new Date().toISOString(),
    },
];

export const HabitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // TRANSITIONAL DUAL-PATH SYSTEM:
    // This store now supports both MongoDB (via API) and localStorage.
    // - If VITE_USE_MONGO_PERSISTENCE=true: Attempts to use API, falls back to localStorage on failure
    // - If false: Uses localStorage only (existing behavior)
    // Future cleanup: Once MongoDB is stable, remove localStorage fallback and dual-write logic.
    //
    // NOTE: Phase 1B - Behavior is unchanged. We only route through PersistenceMode/helpers.
    // Future phases will branch on 'mongo-migration' vs 'mongo-primary' here,
    // following docs/mongo-migration-plan.md.
    const persistenceMode = getPersistenceMode(); // Will be used in future phases
    const mongoEnabled = !isLocalOnly(); // true for both 'mongo-migration' and 'mongo-primary'
    const isMigrationMode = isMongoMigration(); // Will be used in future phases
    const isPrimaryMode = isMongoPrimary(); // Will be used in future phases
    // mongoEnabled is the legacy "Mongo is on" boolean
    // isMigrationMode / isPrimaryMode will be used in future phases to differentiate behavior
    
    // Suppress unused variable warning - will be used in future phases
    void persistenceMode;

    // Phase 2A:
    // - In 'mongo-primary' mode, categories/habits start empty and are loaded from Mongo via API.
    // - In 'local-only' and 'mongo-migration' modes, we keep the existing localStorage initialization.
    // See docs/mongo-migration-plan.md for details.
    const [categories, setCategories] = useState<Category[]>(() => {
        if (isPrimaryMode) {
            // Mongo-primary: start empty; data will be loaded from API in useEffect.
            return [];
        }
        // local-only or mongo-migration: preserve current localStorage initialization.
        const saved = localStorage.getItem('categories');
        return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    });

    const [habits, setHabits] = useState<Habit[]>(() => {
        if (isPrimaryMode) {
            // Mongo-primary: start empty; data will be loaded from API in useEffect.
            return [];
        }
        // local-only or mongo-migration: preserve current localStorage initialization.
        const saved = localStorage.getItem('habits');
        return saved ? JSON.parse(saved) : INITIAL_HABITS;
    });

    // Phase 2B:
    // - In 'mongo-primary' mode, logs start empty and are loaded from Mongo via API.
    // - In 'local-only' and 'mongo-migration' modes, we keep the existing localStorage initialization.
    // See docs/mongo-migration-plan.md for details.
    const [logs, setLogs] = useState<Record<string, DayLog>>(() => {
        if (isPrimaryMode) {
            // Mongo-primary: start empty; logs will be loaded from Mongo via API.
            return {};
        }
        // local-only or mongo-migration: preserve current localStorage initialization.
        const saved = localStorage.getItem('logs');
        return saved ? JSON.parse(saved) : {};
    });

    // Phase 2B:
    // - In 'mongo-primary' mode, wellbeingLogs start empty and are loaded from Mongo via API.
    // - In 'local-only' and 'mongo-migration' modes, we keep the existing localStorage initialization.
    // See docs/mongo-migration-plan.md for details.
    const [wellbeingLogs, setWellbeingLogs] = useState<Record<string, DailyWellbeing>>(() => {
        if (isPrimaryMode) {
            // Mongo-primary: start empty; wellbeingLogs will be loaded from Mongo via API.
            return {};
        }
        // local-only or mongo-migration: preserve current localStorage initialization.
        const saved = localStorage.getItem('wellbeingLogs');
        return saved ? JSON.parse(saved) : {};
    });

    // Phase 2A: Load categories from API on mount
    // - In 'mongo-primary' mode: fetch from MongoDB, optional localStorage fallback if API fails and fallback enabled
    // - In 'mongo-migration' mode: keep current behavior (localStorage init + fetch + replace)
    // - In 'local-only' mode: do nothing, localStorage already loaded
    // See docs/mongo-migration-plan.md for details.
    useEffect(() => {
        if (isLocalOnly()) {
            // local-only: do nothing, localStorage already loaded in initializer
            return;
        }

        // Mongo is enabled: both migration and primary modes
        let cancelled = false;

        const loadCategoriesFromApi = async () => {
            try {
                const apiCategories = await fetchCategories();
                if (cancelled) return;

                if (apiCategories.length > 0) {
                    // API has data, use it
                    setCategories(apiCategories);
                    // In 'mongo-migration' we still sync to localStorage (keep existing behavior)
                    // In 'mongo-primary' we will later disable localStorage syncing in Phase 3
                    if (isMigrationMode) {
                        localStorage.setItem('categories', JSON.stringify(apiCategories));
                    }
                } else {
                    // API returned empty
                    if (isMigrationMode) {
                        // mongo-migration: check localStorage for existing data (keep current behavior)
                        const saved = localStorage.getItem('categories');
                        if (saved) {
                            const localCategories = JSON.parse(saved);
                            if (localCategories.length > 0) {
                                console.warn(
                                    'MongoDB persistence enabled but API returned no categories. ' +
                                    'Using localStorage data. This may indicate a sync issue.'
                                );
                                if (!cancelled) setCategories(localCategories);
                            }
                        }
                    }
                    // mongo-primary: if API returns empty, leave categories empty (no localStorage fallback unless explicitly allowed)
                }
            } catch (error) {
                if (cancelled) return;

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.warn('Failed to fetch categories from API:', errorMessage);

                // Fallback behavior:
                if (isMigrationMode) {
                    // mongo-migration: keep current fallback (localStorage)
                    const saved = localStorage.getItem('categories');
                    if (saved) {
                        const localCategories = JSON.parse(saved);
                        if (localCategories.length > 0 && !cancelled) {
                            setCategories(localCategories);
                        }
                    }
                } else if (isPrimaryMode && allowLocalStorageFallback()) {
                    // mongo-primary: only fallback to localStorage if explicitly allowed
                    const saved = localStorage.getItem('categories');
                    if (saved) {
                        const localCategories = JSON.parse(saved);
                        if (localCategories.length > 0 && !cancelled) {
                            console.warn('Using localStorage fallback for categories (fallback enabled)');
                            setCategories(localCategories);
                        }
                    }
                }
                // mongo-primary without fallback: leave categories empty, error already logged
            }
        };

        loadCategoriesFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount

    // Phase 2A: Load habits from API on mount
    // - In 'mongo-primary' mode: fetch from MongoDB, optional localStorage fallback if API fails and fallback enabled
    // - In 'mongo-migration' mode: keep current behavior (localStorage init + fetch + replace)
    // - In 'local-only' mode: do nothing, localStorage already loaded
    // See docs/mongo-migration-plan.md for details.
    useEffect(() => {
        if (isLocalOnly()) {
            // local-only: do nothing, localStorage already loaded in initializer
            return;
        }

        // Mongo is enabled: both migration and primary modes
        let cancelled = false;

        const loadHabitsFromApi = async () => {
            try {
                const apiHabits = await fetchHabits();
                if (cancelled) return;

                if (apiHabits.length > 0) {
                    // API has data, use it
                    setHabits(apiHabits);
                    // In 'mongo-migration' we still sync to localStorage (keep existing behavior)
                    // In 'mongo-primary' we will later disable localStorage syncing in Phase 3
                    if (isMigrationMode) {
                        localStorage.setItem('habits', JSON.stringify(apiHabits));
                    }
                } else {
                    // API returned empty
                    if (isMigrationMode) {
                        // mongo-migration: check localStorage for existing data (keep current behavior)
                        const saved = localStorage.getItem('habits');
                        if (saved) {
                            const localHabits = JSON.parse(saved);
                            if (localHabits.length > 0) {
                                console.warn(
                                    'MongoDB persistence enabled but API returned no habits. Using localStorage data.'
                                );
                                if (!cancelled) setHabits(localHabits);
                            }
                        }
                    }
                    // mongo-primary: if API returns empty, leave habits empty (no localStorage fallback unless explicitly allowed)
                }
            } catch (error) {
                if (cancelled) return;

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.warn('Failed to fetch habits from API:', errorMessage);

                // Fallback behavior:
                if (isMigrationMode) {
                    // mongo-migration: keep current fallback (localStorage)
                    const saved = localStorage.getItem('habits');
                    if (saved) {
                        const localHabits = JSON.parse(saved);
                        if (localHabits.length > 0 && !cancelled) {
                            setHabits(localHabits);
                        }
                    }
                } else if (isPrimaryMode && allowLocalStorageFallback()) {
                    // mongo-primary: only fallback to localStorage if explicitly allowed
                    const saved = localStorage.getItem('habits');
                    if (saved) {
                        const localHabits = JSON.parse(saved);
                        if (localHabits.length > 0 && !cancelled) {
                            console.warn('Using localStorage fallback for habits (fallback enabled)');
                            setHabits(localHabits);
                        }
                    }
                }
                // mongo-primary without fallback: leave habits empty, error already logged
            }
        };

        loadHabitsFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Phase 2B: Load day logs from API on mount
    // - In 'mongo-primary' mode: fetch from MongoDB, optional localStorage fallback if API fails and fallback enabled
    // - In 'mongo-migration' mode: keep current behavior (localStorage init + fetch + replace)
    // - In 'local-only' mode: do nothing, localStorage already loaded
    // See docs/mongo-migration-plan.md for details.
    useEffect(() => {
        if (isLocalOnly()) {
            // local-only: do nothing, localStorage already loaded in initializer
            return;
        }

        // Mongo is enabled: both migration and primary modes
        let cancelled = false;

        const loadLogsFromApi = async () => {
            try {
                const apiLogs = await fetchDayLogs();
                if (cancelled) return;

                if (Object.keys(apiLogs).length > 0) {
                    // API has data, use it
                    setLogs(apiLogs);
                    // In 'mongo-migration' we still sync to localStorage (keep existing behavior)
                    // In 'mongo-primary' we will later disable localStorage syncing in Phase 3
                    if (isMigrationMode) {
                        localStorage.setItem('logs', JSON.stringify(apiLogs));
                    }
                } else {
                    // API returned empty
                    if (isMigrationMode) {
                        // mongo-migration: check localStorage for existing data (keep current behavior)
                        const saved = localStorage.getItem('logs');
                        if (saved) {
                            const localLogs = JSON.parse(saved);
                            if (Object.keys(localLogs).length > 0) {
                                console.warn(
                                    'MongoDB persistence enabled but API returned no logs. Using localStorage data.'
                                );
                                if (!cancelled) setLogs(localLogs);
                            }
                        }
                    }
                    // mongo-primary: if API returns empty, leave logs empty (no localStorage fallback unless explicitly allowed)
                }
            } catch (error) {
                if (cancelled) return;

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.warn('Failed to fetch logs from API:', errorMessage);

                // Fallback behavior:
                if (isMigrationMode) {
                    // mongo-migration: keep current fallback (localStorage)
                    const saved = localStorage.getItem('logs');
                    if (saved) {
                        const localLogs = JSON.parse(saved);
                        if (!cancelled) setLogs(localLogs);
                    }
                } else if (isPrimaryMode && allowLocalStorageFallback()) {
                    // mongo-primary: only fallback to localStorage if explicitly allowed
                    const saved = localStorage.getItem('logs');
                    if (saved) {
                        const localLogs = JSON.parse(saved);
                        if (!cancelled) {
                            console.warn('Using localStorage fallback for logs (fallback enabled)');
                            setLogs(localLogs);
                        }
                    }
                }
                // mongo-primary without fallback: leave logs empty, error already logged
            }
        };

        loadLogsFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Phase 2B: Load wellbeing logs from API on mount
    // - In 'mongo-primary' mode: fetch from MongoDB, optional localStorage fallback if API fails and fallback enabled
    // - In 'mongo-migration' mode: keep current behavior (localStorage init + fetch + replace)
    // - In 'local-only' mode: do nothing, localStorage already loaded
    // See docs/mongo-migration-plan.md for details.
    useEffect(() => {
        if (isLocalOnly()) {
            // local-only: do nothing, localStorage already loaded in initializer
            return;
        }

        // Mongo is enabled: both migration and primary modes
        let cancelled = false;

        const loadWellbeingLogsFromApi = async () => {
            try {
                const apiWellbeingLogs = await fetchWellbeingLogs();
                if (cancelled) return;

                if (Object.keys(apiWellbeingLogs).length > 0) {
                    // API has data, use it
                    setWellbeingLogs(apiWellbeingLogs);
                    // In 'mongo-migration' we still sync to localStorage (keep existing behavior)
                    // In 'mongo-primary' we will later disable localStorage syncing in Phase 3
                    if (isMigrationMode) {
                        localStorage.setItem('wellbeingLogs', JSON.stringify(apiWellbeingLogs));
                    }
                } else {
                    // API returned empty
                    if (isMigrationMode) {
                        // mongo-migration: check localStorage for existing data (keep current behavior)
                        const saved = localStorage.getItem('wellbeingLogs');
                        if (saved) {
                            const localWellbeingLogs = JSON.parse(saved);
                            if (Object.keys(localWellbeingLogs).length > 0) {
                                console.warn(
                                    'MongoDB persistence enabled but API returned no wellbeing logs. Using localStorage data.'
                                );
                                if (!cancelled) setWellbeingLogs(localWellbeingLogs);
                            }
                        }
                    }
                    // mongo-primary: if API returns empty, leave wellbeingLogs empty (no localStorage fallback unless explicitly allowed)
                }
            } catch (error) {
                if (cancelled) return;

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.warn('Failed to fetch wellbeing logs from API:', errorMessage);

                // Fallback behavior:
                if (isMigrationMode) {
                    // mongo-migration: keep current fallback (localStorage)
                    const saved = localStorage.getItem('wellbeingLogs');
                    if (saved) {
                        const localWellbeingLogs = JSON.parse(saved);
                        if (!cancelled) setWellbeingLogs(localWellbeingLogs);
                    }
                } else if (isPrimaryMode && allowLocalStorageFallback()) {
                    // mongo-primary: only fallback to localStorage if explicitly allowed
                    const saved = localStorage.getItem('wellbeingLogs');
                    if (saved) {
                        const localWellbeingLogs = JSON.parse(saved);
                        if (!cancelled) {
                            console.warn('Using localStorage fallback for wellbeing logs (fallback enabled)');
                            setWellbeingLogs(localWellbeingLogs);
                        }
                    }
                }
                // mongo-primary without fallback: leave wellbeingLogs empty, error already logged
            }
        };

        loadWellbeingLogsFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync to localStorage (dual-write for safety during transition)
    useEffect(() => {
        localStorage.setItem('categories', JSON.stringify(categories));
    }, [categories]);

    useEffect(() => {
        localStorage.setItem('habits', JSON.stringify(habits));
    }, [habits]);

    useEffect(() => {
        localStorage.setItem('logs', JSON.stringify(logs));
    }, [logs]);

    useEffect(() => {
        localStorage.setItem('wellbeingLogs', JSON.stringify(wellbeingLogs));
    }, [wellbeingLogs]);

    const logWellbeing = async (date: string, data: DailyWellbeing) => {
        // Merge with existing data for the date
        const existing = wellbeingLogs[date] || { date };
        const mergedData: DailyWellbeing = {
            ...existing,
            ...data,
            // Deep merge morning/evening if provided, preserving the other if not
            morning: data.morning ? { ...existing.morning, ...data.morning } : existing.morning,
            evening: data.evening ? { ...existing.evening, ...data.evening } : existing.evening,
        };

        const updatedWellbeingLogs = {
            ...wellbeingLogs,
            [date]: mergedData,
        };
        setWellbeingLogs(updatedWellbeingLogs);
        localStorage.setItem('wellbeingLogs', JSON.stringify(updatedWellbeingLogs));

        // Save to MongoDB if enabled
        if (mongoEnabled) {
            try {
                await saveWellbeingLog(mergedData);
            } catch (error) {
                console.warn('Failed to save wellbeing log to API:', error instanceof Error ? error.message : 'Unknown error');
                // State already updated, just log warning
            }
        }
    };

    const addCategory = async (category: Omit<Category, 'id'>) => {
        if (mongoEnabled) {
            try {
                // Save to API
                const newCategory = await saveCategory(category);
                // Update state with API response
                setCategories([...categories, newCategory]);
                // Dual-write: Also save to localStorage for safety during transition
                // (This happens automatically via the useEffect above, but we do it here too for immediate consistency)
                localStorage.setItem('categories', JSON.stringify([...categories, newCategory]));
            } catch (error) {
                // API failed, fall back to localStorage
                console.warn(
                    'Failed to save category to API, using localStorage fallback:',
                    error instanceof Error ? error.message : 'Unknown error'
                );
                const newCategory = { ...category, id: crypto.randomUUID() };
                setCategories([...categories, newCategory]);
            }
        } else {
            // Use localStorage (existing behavior)
            const newCategory = { ...category, id: crypto.randomUUID() };
            setCategories([...categories, newCategory]);
        }
    };

    const addHabit = async (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => {
        if (mongoEnabled) {
            try {
                // Save to API
                const newHabit = await saveHabit(habit);
                // Update state with API response
                const updatedHabits = [...habits, newHabit];
                setHabits(updatedHabits);
                // Dual-write: Also save to localStorage for safety during transition
                localStorage.setItem('habits', JSON.stringify(updatedHabits));
            } catch (error) {
                // API failed, fall back to localStorage
                console.warn(
                    'Failed to save habit to API, using localStorage fallback:',
                    error instanceof Error ? error.message : 'Unknown error'
                );
                const newHabit = {
                    ...habit,
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString(),
                    archived: false,
                };
                const updatedHabits = [...habits, newHabit];
                setHabits(updatedHabits);
                localStorage.setItem('habits', JSON.stringify(updatedHabits));
            }
        } else {
            // Use localStorage (existing behavior)
            const newHabit = {
                ...habit,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                archived: false,
            };
            const updatedHabits = [...habits, newHabit];
            setHabits(updatedHabits);
            localStorage.setItem('habits', JSON.stringify(updatedHabits));
        }
    };

    const toggleHabit = async (habitId: string, date: string) => {
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
        
        setLogs(updatedLogs);
        localStorage.setItem('logs', JSON.stringify(updatedLogs));

        // Save to MongoDB if enabled
        if (mongoEnabled && logToSave) {
            try {
                await saveDayLog(logToSave);
            } catch (error) {
                console.warn('Failed to save day log to API:', error instanceof Error ? error.message : 'Unknown error');
                // State already updated, just log warning
            }
        } else if (mongoEnabled && currentLog) {
            // Delete from MongoDB
            try {
                await deleteDayLogApi(habitId, date);
            } catch (error) {
                console.warn('Failed to delete day log from API:', error instanceof Error ? error.message : 'Unknown error');
                // State already updated, just log warning
            }
        }
    };

    const updateLog = async (habitId: string, date: string, value: number) => {
        const key = `${habitId}-${date}`;
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        const completed = habit.goal.target ? value >= habit.goal.target : value > 0;

        const logToSave: DayLog = { habitId, date, value, completed };
        const updatedLogs = {
            ...logs,
            [key]: logToSave,
        };
        setLogs(updatedLogs);
        localStorage.setItem('logs', JSON.stringify(updatedLogs));

        // Save to MongoDB if enabled
        if (mongoEnabled) {
            try {
                await saveDayLog(logToSave);
            } catch (error) {
                console.warn('Failed to save day log to API:', error instanceof Error ? error.message : 'Unknown error');
                // State already updated, just log warning
            }
        }
    };

    const deleteHabit = async (id: string) => {
        if (mongoEnabled) {
            try {
                // Delete from API (this should cascade delete day logs)
                await deleteHabitApi(id);
                // Update state
                const updatedHabits = habits.filter(h => h.id !== id);
                setHabits(updatedHabits);
                // Also remove related logs from state
                const updatedLogs = Object.fromEntries(
                    Object.entries(logs).filter(([key]) => !key.startsWith(`${id}-`))
                );
                setLogs(updatedLogs);
                // Dual-write: Also update localStorage
                localStorage.setItem('habits', JSON.stringify(updatedHabits));
                localStorage.setItem('logs', JSON.stringify(updatedLogs));
            } catch (error) {
                // API failed, fall back to localStorage
                console.warn(
                    'Failed to delete habit from API, using localStorage fallback:',
                    error instanceof Error ? error.message : 'Unknown error'
                );
                const updatedHabits = habits.filter(h => h.id !== id);
                setHabits(updatedHabits);
                const updatedLogs = Object.fromEntries(
                    Object.entries(logs).filter(([key]) => !key.startsWith(`${id}-`))
                );
                setLogs(updatedLogs);
                localStorage.setItem('habits', JSON.stringify(updatedHabits));
                localStorage.setItem('logs', JSON.stringify(updatedLogs));
            }
        } else {
            // Use localStorage (existing behavior)
            const updatedHabits = habits.filter(h => h.id !== id);
            setHabits(updatedHabits);
            const updatedLogs = Object.fromEntries(
                Object.entries(logs).filter(([key]) => !key.startsWith(`${id}-`))
            );
            setLogs(updatedLogs);
            localStorage.setItem('habits', JSON.stringify(updatedHabits));
            localStorage.setItem('logs', JSON.stringify(updatedLogs));
        }
    };

    const deleteCategory = async (id: string) => {
        if (mongoEnabled) {
            try {
                // Delete from API
                await deleteCategoryApi(id);
                // Update state
                setCategories(prev => prev.filter(c => c.id !== id));
                // Dual-write: Also update localStorage
                const updated = categories.filter(c => c.id !== id);
                localStorage.setItem('categories', JSON.stringify(updated));
            } catch (error) {
                // API failed, fall back to localStorage
                console.warn(
                    'Failed to delete category from API, using localStorage fallback:',
                    error instanceof Error ? error.message : 'Unknown error'
                );
                setCategories(prev => prev.filter(c => c.id !== id));
            }
        } else {
            // Use localStorage (existing behavior)
            setCategories(prev => prev.filter(c => c.id !== id));
        }
    };

    const importHabits = async (
        categoriesToImport: Omit<Category, 'id'>[],
        habitsData: { categoryName: string; habit: Omit<Habit, 'id' | 'categoryId' | 'createdAt' | 'archived'> }[]
    ) => {
        // 1. Create Categories if they don't exist
        let updatedCategories = [...categories];
        const categoryMap = new Map<string, string>(); // Name -> ID

        // Map existing categories
        updatedCategories.forEach(c => categoryMap.set(c.name, c.id));

        // Add new categories from import
        if (mongoEnabled) {
            // Use API to create categories
            for (const c of categoriesToImport) {
                if (!categoryMap.has(c.name)) {
                    try {
                        const newCat = await saveCategory(c);
                        updatedCategories.push(newCat);
                        categoryMap.set(c.name, newCat.id);
                    } catch (error) {
                        // API failed, fall back to localStorage
                        console.warn(
                            `Failed to create category "${c.name}" via API, using localStorage fallback:`,
                            error instanceof Error ? error.message : 'Unknown error'
                        );
                        const id = crypto.randomUUID();
                        const newCat = { ...c, id };
                        updatedCategories.push(newCat);
                        categoryMap.set(c.name, id);
                    }
                }
            }
        } else {
            // Use localStorage (existing behavior)
            categoriesToImport.forEach(c => {
                if (!categoryMap.has(c.name)) {
                    const id = crypto.randomUUID();
                    const newCat = { ...c, id };
                    updatedCategories.push(newCat);
                    categoryMap.set(c.name, id);
                }
            });
        }

        // 2. Create Habits
        let updatedHabits = [...habits];
        let addedCount = 0;
        
        if (mongoEnabled) {
            // Use API to create habits
            for (const { categoryName, habit } of habitsData) {
                const categoryId = categoryMap.get(categoryName);
                if (categoryId) {
                    // Check if habit already exists to avoid duplicates
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
                            // API failed, fall back to localStorage
                            console.warn(
                                `Failed to create habit "${habit.name}" via API, using localStorage fallback:`,
                                error instanceof Error ? error.message : 'Unknown error'
                            );
                            updatedHabits.push({
                                ...habit,
                                id: crypto.randomUUID(),
                                categoryId,
                                createdAt: new Date().toISOString(),
                                archived: false,
                            });
                            addedCount++;
                        }
                    }
                } else {
                    console.warn(`Category not found for habit: ${habit.name} (Category: ${categoryName})`);
                }
            }
        } else {
            // Use localStorage (existing behavior)
            habitsData.forEach(({ categoryName, habit }) => {
                const categoryId = categoryMap.get(categoryName);
                if (categoryId) {
                    // Check if habit already exists to avoid duplicates
                    const exists = updatedHabits.some(h => h.name === habit.name && h.categoryId === categoryId);
                    if (!exists) {
                        updatedHabits.push({
                            ...habit,
                            id: crypto.randomUUID(),
                            categoryId,
                            createdAt: new Date().toISOString(),
                            archived: false,
                        });
                        addedCount++;
                    }
                } else {
                    console.warn(`Category not found for habit: ${habit.name} (Category: ${categoryName})`);
                }
            });
        }

        console.log(`Imported ${categoriesToImport.length} categories and ${addedCount} habits.`);

        // Update state
        setCategories(updatedCategories);
        setHabits(updatedHabits);
    };

    const reorderCategories = async (newOrder: Category[]) => {
        if (mongoEnabled) {
            try {
                // Save new order to API
                const updatedCategories = await reorderCategoriesApi(newOrder);
                // Update state with API response
                setCategories(updatedCategories);
                // Dual-write: Also save to localStorage
                localStorage.setItem('categories', JSON.stringify(updatedCategories));
            } catch (error) {
                // API failed, fall back to localStorage
                console.warn(
                    'Failed to reorder categories in API, using localStorage fallback:',
                    error instanceof Error ? error.message : 'Unknown error'
                );
                setCategories(newOrder);
            }
        } else {
            // Use localStorage (existing behavior)
            setCategories(newOrder);
        }
    };


    return (
        <HabitContext.Provider value={{
            categories,
            habits,
            logs,
            wellbeingLogs,
            addCategory,
            addHabit,
            toggleHabit,
            updateLog,
            deleteHabit,
            deleteCategory,
            importHabits,
            reorderCategories,
            logWellbeing,
        }}>
            {children}
        </HabitContext.Provider>
    );
};
