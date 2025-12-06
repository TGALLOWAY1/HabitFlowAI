import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Category, Habit, DayLog, DailyWellbeing } from '../types';
import {
    fetchCategories,
    saveCategory,
    deleteCategory as deleteCategoryApi,
    reorderCategories as reorderCategoriesApi,
    isMongoPersistenceEnabled,
} from '../lib/persistenceClient';

interface HabitContextType {
    categories: Category[];
    habits: Habit[];
    logs: Record<string, DayLog>; // Key: `${habitId}-${date}`
    addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
    addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => void;
    toggleHabit: (habitId: string, date: string) => void;
    updateLog: (habitId: string, date: string, value: number) => void;
    deleteHabit: (id: string) => void;
    deleteCategory: (id: string) => Promise<void>;
    importHabits: (
        categories: Omit<Category, 'id'>[],
        habitsData: { categoryName: string; habit: Omit<Habit, 'id' | 'categoryId' | 'createdAt' | 'archived'> }[]
    ) => Promise<void>;
    reorderCategories: (newOrder: Category[]) => Promise<void>;
    wellbeingLogs: Record<string, DailyWellbeing>;
    logWellbeing: (date: string, data: DailyWellbeing) => void;
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

    const [categories, setCategories] = useState<Category[]>(() => {
        // Initial load: Try API if enabled, otherwise use localStorage
        if (isMongoPersistenceEnabled()) {
            // Attempt to fetch from API, but don't block initialization
            // We'll load from localStorage first, then sync from API in useEffect
            const saved = localStorage.getItem('categories');
            return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
        } else {
            // Use localStorage (existing behavior)
            const saved = localStorage.getItem('categories');
            return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
        }
    });

    const [habits, setHabits] = useState<Habit[]>(() => {
        const saved = localStorage.getItem('habits');
        return saved ? JSON.parse(saved) : INITIAL_HABITS;
    });

    const [logs, setLogs] = useState<Record<string, DayLog>>(() => {
        const saved = localStorage.getItem('logs');
        return saved ? JSON.parse(saved) : {};
    });

    // Load categories from API on mount if MongoDB persistence is enabled
    useEffect(() => {
        if (isMongoPersistenceEnabled()) {
            fetchCategories()
                .then((apiCategories) => {
                    if (apiCategories.length > 0) {
                        // API has data, use it
                        setCategories(apiCategories);
                        // Dual-write: Also save to localStorage for safety during transition
                        localStorage.setItem('categories', JSON.stringify(apiCategories));
                    } else {
                        // API returned empty, check localStorage for existing data
                        const saved = localStorage.getItem('categories');
                        if (saved) {
                            const localCategories = JSON.parse(saved);
                            if (localCategories.length > 0) {
                                console.warn(
                                    'MongoDB persistence enabled but API returned no categories. ' +
                                    'Using localStorage data. This may indicate a sync issue.'
                                );
                                // Use localStorage data if API is empty
                                setCategories(localCategories);
                            }
                        }
                    }
                })
                .catch((error) => {
                    // API failed, fall back to localStorage
                    console.warn(
                        'Failed to fetch categories from API, using localStorage fallback:',
                        error.message
                    );
                    const saved = localStorage.getItem('categories');
                    if (saved) {
                        const localCategories = JSON.parse(saved);
                        if (localCategories.length > 0) {
                            setCategories(localCategories);
                        }
                    }
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount

    // Sync categories to localStorage (dual-write for safety during transition)
    useEffect(() => {
        localStorage.setItem('categories', JSON.stringify(categories));
    }, [categories]);

    useEffect(() => {
        localStorage.setItem('habits', JSON.stringify(habits));
    }, [habits]);

    useEffect(() => {
        localStorage.setItem('logs', JSON.stringify(logs));
    }, [logs]);

    const addCategory = async (category: Omit<Category, 'id'>) => {
        if (isMongoPersistenceEnabled()) {
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

    const addHabit = (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => {
        const newHabit = {
            ...habit,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            archived: false,
        };
        const updatedHabits = [...habits, newHabit];
        setHabits(updatedHabits);
        // Immediately save to localStorage to prevent data loss on refresh/close
        localStorage.setItem('habits', JSON.stringify(updatedHabits));
    };

    const toggleHabit = (habitId: string, date: string) => {
        const key = `${habitId}-${date}`;
        const currentLog = logs[key];

        let updatedLogs: Record<string, DayLog>;
        if (currentLog) {
            // Toggle off
            const { [key]: _, ...rest } = logs;
            updatedLogs = rest;
        } else {
            // Toggle on
            updatedLogs = {
                ...logs,
                [key]: { habitId, date, value: 1, completed: true },
            };
        }
        setLogs(updatedLogs);
        // Immediately save to localStorage to prevent data loss on refresh/close
        localStorage.setItem('logs', JSON.stringify(updatedLogs));
    };

    const updateLog = (habitId: string, date: string, value: number) => {
        const key = `${habitId}-${date}`;
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        const completed = habit.goal.target ? value >= habit.goal.target : value > 0;

        const updatedLogs = {
            ...logs,
            [key]: { habitId, date, value, completed },
        };
        setLogs(updatedLogs);
        // Immediately save to localStorage to prevent data loss on refresh/close
        localStorage.setItem('logs', JSON.stringify(updatedLogs));
    };

    const deleteHabit = (id: string) => {
        const updatedHabits = habits.filter(h => h.id !== id);
        setHabits(updatedHabits);
        // Immediately save to localStorage to prevent data loss on refresh/close
        localStorage.setItem('habits', JSON.stringify(updatedHabits));
    };

    const deleteCategory = async (id: string) => {
        if (isMongoPersistenceEnabled()) {
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
        if (isMongoPersistenceEnabled()) {
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
                        archived: false, // Ensure archived is set
                    });
                    addedCount++;
                }
            } else {
                console.warn(`Category not found for habit: ${habit.name} (Category: ${categoryName})`);
            }
        });

        console.log(`Imported ${categoriesToImport.length} categories and ${addedCount} habits.`);

        // Update state
        setCategories(updatedCategories);
        setHabits(updatedHabits);
    };

    const reorderCategories = async (newOrder: Category[]) => {
        if (isMongoPersistenceEnabled()) {
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

    const [wellbeingLogs, setWellbeingLogs] = useState<Record<string, DailyWellbeing>>(() => {
        const saved = localStorage.getItem('wellbeingLogs');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('wellbeingLogs', JSON.stringify(wellbeingLogs));
    }, [wellbeingLogs]);

    const logWellbeing = (date: string, data: DailyWellbeing) => {
        setWellbeingLogs(prev => {
            const existing = prev[date] || { date };
            return {
                ...prev,
                [date]: {
                    ...existing,
                    ...data,
                    // Deep merge morning/evening if provided, preserving the other if not
                    morning: data.morning ? { ...existing.morning, ...data.morning } : existing.morning,
                    evening: data.evening ? { ...existing.evening, ...data.evening } : existing.evening,
                }
            };
        });
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
