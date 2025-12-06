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
    MONGO_ENABLED,
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


export const HabitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // All persistent data is stored in MongoDB via the backend API.
    // localStorage-based persistence is no longer supported.
    const mongoEnabled = MONGO_ENABLED;

    // All state starts empty and is loaded from MongoDB via API on mount
    const [categories, setCategories] = useState<Category[]>([]);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [logs, setLogs] = useState<Record<string, DayLog>>({});
    const [wellbeingLogs, setWellbeingLogs] = useState<Record<string, DailyWellbeing>>({});

    // Load categories from MongoDB on mount
    useEffect(() => {
        if (!mongoEnabled) return;

        let cancelled = false;

        const loadCategoriesFromApi = async () => {
            try {
                const apiCategories = await fetchCategories();
                if (cancelled) return;
                setCategories(apiCategories);
            } catch (error) {
                if (cancelled) return;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Failed to fetch categories from API:', errorMessage);
            }
        };

        loadCategoriesFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load habits from MongoDB on mount
    useEffect(() => {
        if (!mongoEnabled) return;

        let cancelled = false;

        const loadHabitsFromApi = async () => {
            try {
                const apiHabits = await fetchHabits();
                if (cancelled) return;
                setHabits(apiHabits);
            } catch (error) {
                if (cancelled) return;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Failed to fetch habits from API:', errorMessage);
            }
        };

        loadHabitsFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load day logs from MongoDB on mount
    useEffect(() => {
        if (!mongoEnabled) return;

        let cancelled = false;

        const loadLogsFromApi = async () => {
            try {
                const apiLogs = await fetchDayLogs();
                if (cancelled) return;
                setLogs(apiLogs);
            } catch (error) {
                if (cancelled) return;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Failed to fetch logs from API:', errorMessage);
            }
        };

        loadLogsFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load wellbeing logs from MongoDB on mount
    useEffect(() => {
        if (!mongoEnabled) return;

        let cancelled = false;

        const loadWellbeingLogsFromApi = async () => {
            try {
                const apiWellbeingLogs = await fetchWellbeingLogs();
                if (cancelled) return;
                setWellbeingLogs(apiWellbeingLogs);
            } catch (error) {
                if (cancelled) return;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Failed to fetch wellbeing logs from API:', errorMessage);
            }
        };

        loadWellbeingLogsFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


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
        // Optimistic update: update state immediately
        setWellbeingLogs(updatedWellbeingLogs);

        // Save to MongoDB if enabled
        if (mongoEnabled) {
            try {
                await saveWellbeingLog(mergedData);
            } catch (error) {
                console.error('Failed to save wellbeing log to API:', error instanceof Error ? error.message : 'Unknown error');
                // State already updated optimistically, just log error
            }
        }
    };

    const addCategory = async (category: Omit<Category, 'id'>) => {
        if (!mongoEnabled) {
            console.warn('MongoDB persistence is disabled. Cannot save category.');
            return;
        }

        try {
            const newCategory = await saveCategory(category);
            setCategories([...categories, newCategory]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to save category to API:', errorMessage);
            throw error;
        }
    };

    const addHabit = async (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => {
        if (!mongoEnabled) {
            console.warn('MongoDB persistence is disabled. Cannot save habit.');
            return;
        }

        try {
            const newHabit = await saveHabit(habit);
            setHabits([...habits, newHabit]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to save habit to API:', errorMessage);
            throw error;
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
        
        // Optimistic update: update state immediately
        setLogs(updatedLogs);

        // Save to MongoDB if enabled
        if (mongoEnabled && logToSave) {
            try {
                await saveDayLog(logToSave);
            } catch (error) {
                console.error('Failed to save day log to API:', error instanceof Error ? error.message : 'Unknown error');
                // State already updated optimistically, just log error
            }
        } else if (mongoEnabled && currentLog) {
            // Delete from MongoDB
            try {
                await deleteDayLogApi(habitId, date);
            } catch (error) {
                console.error('Failed to delete day log from API:', error instanceof Error ? error.message : 'Unknown error');
                // State already updated optimistically, just log error
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
        // Optimistic update: update state immediately
        setLogs(updatedLogs);

        // Save to MongoDB if enabled
        if (mongoEnabled) {
            try {
                await saveDayLog(logToSave);
            } catch (error) {
                console.error('Failed to save day log to API:', error instanceof Error ? error.message : 'Unknown error');
                // State already updated optimistically, just log error
            }
        }
    };

    const deleteHabit = async (id: string) => {
        if (!mongoEnabled) {
            console.warn('MongoDB persistence is disabled. Cannot delete habit.');
            return;
        }

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
        if (!mongoEnabled) {
            console.warn('MongoDB persistence is disabled. Cannot delete category.');
            return;
        }

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
        if (!mongoEnabled) {
            console.warn('MongoDB persistence is disabled. Cannot import habits.');
            return;
        }

        // 1. Create Categories if they don't exist
        let updatedCategories = [...categories];
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

        // 2. Create Habits
        let updatedHabits = [...habits];
        let addedCount = 0;
        
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

        console.log(`Imported ${categoriesToImport.length} categories and ${addedCount} habits.`);

        // Update state
        setCategories(updatedCategories);
        setHabits(updatedHabits);
    };

    const reorderCategories = async (newOrder: Category[]) => {
        if (!mongoEnabled) {
            console.warn('MongoDB persistence is disabled. Cannot reorder categories.');
            return;
        }

        try {
            const updatedCategories = await reorderCategoriesApi(newOrder);
            setCategories(updatedCategories);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to reorder categories in API:', errorMessage);
            throw error;
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
