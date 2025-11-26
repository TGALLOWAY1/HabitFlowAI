import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Category, Habit, DayLog } from '../types';

interface HabitContextType {
    categories: Category[];
    habits: Habit[];
    logs: Record<string, DayLog>; // Key: `${habitId}-${date}`
    addCategory: (category: Omit<Category, 'id'>) => void;
    addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => void;
    toggleHabit: (habitId: string, date: string) => void;
    updateLog: (habitId: string, date: string, value: number) => void;
    deleteHabit: (id: string) => void;
    deleteCategory: (id: string) => void;
    importHabits: (
        categories: Omit<Category, 'id'>[],
        habitsData: { categoryName: string; habit: Omit<Habit, 'id' | 'categoryId' | 'createdAt' | 'archived'> }[]
    ) => void;
    reorderCategories: (newOrder: Category[]) => void;
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
    { id: '1', name: 'Health', color: 'bg-emerald-500' },
    { id: '2', name: 'Productivity', color: 'bg-blue-500' },
    { id: '3', name: 'Mindfulness', color: 'bg-purple-500' },
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
    const [categories, setCategories] = useState<Category[]>(() => {
        const saved = localStorage.getItem('categories');
        return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    });

    const [habits, setHabits] = useState<Habit[]>(() => {
        const saved = localStorage.getItem('habits');
        return saved ? JSON.parse(saved) : INITIAL_HABITS;
    });

    const [logs, setLogs] = useState<Record<string, DayLog>>(() => {
        const saved = localStorage.getItem('logs');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('categories', JSON.stringify(categories));
    }, [categories]);

    useEffect(() => {
        localStorage.setItem('habits', JSON.stringify(habits));
    }, [habits]);

    useEffect(() => {
        localStorage.setItem('logs', JSON.stringify(logs));
    }, [logs]);

    const addCategory = (category: Omit<Category, 'id'>) => {
        const newCategory = { ...category, id: crypto.randomUUID() };
        setCategories([...categories, newCategory]);
    };

    const addHabit = (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => {
        const newHabit = {
            ...habit,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            archived: false,
        };
        setHabits([...habits, newHabit]);
    };

    const toggleHabit = (habitId: string, date: string) => {
        const key = `${habitId}-${date}`;
        const currentLog = logs[key];

        if (currentLog) {
            // Toggle off
            const { [key]: _, ...rest } = logs;
            setLogs(rest);
        } else {
            // Toggle on
            setLogs({
                ...logs,
                [key]: { habitId, date, value: 1, completed: true },
            });
        }
    };

    const updateLog = (habitId: string, date: string, value: number) => {
        const key = `${habitId}-${date}`;
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        const completed = habit.goal.target ? value >= habit.goal.target : value > 0;

        setLogs({
            ...logs,
            [key]: { habitId, date, value, completed },
        });
    };

    const deleteHabit = (id: string) => {
        setHabits(prev => prev.filter(h => h.id !== id));
    };

    const deleteCategory = (id: string) => {
        setCategories(prev => prev.filter(c => c.id !== id));
    };

    const importHabits = (
        categoriesToImport: Omit<Category, 'id'>[],
        habitsData: { categoryName: string; habit: Omit<Habit, 'id' | 'categoryId' | 'createdAt' | 'archived'> }[]
    ) => {
        // 1. Create Categories if they don't exist
        let updatedCategories = [...categories];
        const categoryMap = new Map<string, string>(); // Name -> ID

        // Map existing categories
        updatedCategories.forEach(c => categoryMap.set(c.name, c.id));

        // Add new categories from import
        categoriesToImport.forEach(c => {
            if (!categoryMap.has(c.name)) {
                const id = crypto.randomUUID();
                const newCat = { ...c, id };
                updatedCategories.push(newCat);
                categoryMap.set(c.name, id);
            }
        });

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

    const reorderCategories = (newOrder: Category[]) => {
        setCategories(newOrder);
    };

    return (
        <HabitContext.Provider value={{
            categories,
            habits,
            logs,
            addCategory,
            addHabit,
            toggleHabit,
            updateLog,
            deleteHabit,
            deleteCategory,
            importHabits,
            reorderCategories,
        }}>
            {children}
        </HabitContext.Provider>
    );
};
