export interface Category {
    id: string;
    name: string;
    color: string; // Hex code or Tailwind color class
}

export interface Goal {
    type: 'boolean' | 'number';
    target?: number; // e.g., 8 (hours), 2000 (calories)
    unit?: string; // e.g., 'hrs', 'kcal'
    frequency: 'daily' | 'weekly' | 'total'; // 'total' for cumulative goals
}

export interface Habit {
    id: string;
    categoryId: string;
    name: string;
    description?: string;
    goal: Goal;
    archived: boolean;
    createdAt: string;
    pace?: string | null; // Estimated completion date
}

export interface DayLog {
    habitId: string;
    date: string; // YYYY-MM-DD
    value: number; // 0 or 1 for boolean, actual value for number
    completed: boolean;
}

export type Theme = 'dark' | 'light';
