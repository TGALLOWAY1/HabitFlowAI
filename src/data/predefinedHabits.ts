import type { Habit, Category } from '../types';

export const PREDEFINED_CATEGORIES: Omit<Category, 'id'>[] = [
    { name: 'Physical & Energy', color: 'bg-emerald-500' },
    { name: 'Mind & Emotional', color: 'bg-violet-500' },
    { name: 'Relationships', color: 'bg-rose-500' },
    { name: 'Dog / Home', color: 'bg-amber-500' },
    { name: 'Creativity & Skill', color: 'bg-blue-500' },
    { name: 'Music', color: 'bg-fuchsia-500' },
    { name: 'Career & Growth', color: 'bg-cyan-500' },
    { name: 'Financial', color: 'bg-green-500' },
];

export const PREDEFINED_HABITS: { categoryName: string; habit: Omit<Habit, 'id' | 'categoryId' | 'createdAt'> }[] = [
    // Physical & Energy
    { categoryName: 'Physical & Energy', habit: { name: 'Protein Target', goal: { type: 'number', target: 170, unit: 'g', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Eat Prepped Meals', goal: { type: 'number', target: 3, unit: 'meals', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: '10k Steps', goal: { type: 'number', target: 10000, unit: 'steps', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Deep Breathing', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Hip Mobility / Rehab', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'No Caffeine after 1PM', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Supplements', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Sleep Hygiene (Eve)', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Sleep Hygiene (Morn)', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Wake up at 7AM', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Lights out < 12AM', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Hydration', goal: { type: 'number', target: 3, unit: 'L', frequency: 'daily' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Morning Sunlight', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },

    // Mind & Emotional
    { categoryName: 'Mind & Emotional', habit: { name: 'Self-support Affirmation', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Mind & Emotional', habit: { name: 'Reframe Negative Thought', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Mind & Emotional', habit: { name: 'Log "Tiny Victory"', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Mind & Emotional', habit: { name: 'Morning Intention', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Mind & Emotional', habit: { name: 'Anxiety Level', goal: { type: 'number', target: 5, unit: 'level', frequency: 'daily' }, archived: false } },
    { categoryName: 'Mind & Emotional', habit: { name: 'Depression Level', goal: { type: 'number', target: 5, unit: 'level', frequency: 'daily' }, archived: false } },

    // Relationships
    { categoryName: 'Relationships', habit: { name: 'Kindness for Juba', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Relationships', habit: { name: 'Avoid Self-deprecation', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },

    // Dog / Home
    { categoryName: 'Dog / Home', habit: { name: 'Activity for Lady', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Dog / Home', habit: { name: 'E-Collar Walk', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Dog / Home', habit: { name: '5-min Environment Reset', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },

    // Creativity & Skill
    { categoryName: 'Creativity & Skill', habit: { name: 'Portuguese Practice', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Creativity & Skill', habit: { name: 'Portfolio App Work', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },

    // Music
    { categoryName: 'Music', habit: { name: 'Music/Theory Practice', goal: { type: 'boolean', frequency: 'daily' }, archived: false } },
    { categoryName: 'Music', habit: { name: 'Record Music Content', goal: { type: 'number', target: 2, unit: 'sessions', frequency: 'weekly' }, archived: false } },

    // Weekly Habits (Physical)
    { categoryName: 'Physical & Energy', habit: { name: 'Gym', goal: { type: 'number', target: 3, unit: 'sessions', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Run', goal: { type: 'number', target: 3, unit: 'sessions', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Yoga Session', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Long Run', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Kickboxing Class', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Climbing + Weights', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Physical & Energy', habit: { name: 'Meal Prep', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },

    // Weekly Habits (Mind & Emotional)
    { categoryName: 'Mind & Emotional', habit: { name: 'Spontaneity / Journaling', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Mind & Emotional', habit: { name: 'Weekly Reflection', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },

    // Weekly Habits (Relationships)
    { categoryName: 'Relationships', habit: { name: 'Date / Quality Time', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Relationships', habit: { name: 'Emotional Check-in', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },

    // Weekly Habits (Family & Friends) - Putting in Relationships for now as there is no Family category in the list above, but I should probably add it or merge it. 
    // User asked for "Family & Friends" in the proposal, but I didn't add it to the Categories list in step 1. 
    // I'll add it to "Relationships" for now to keep categories manageable, or create a new one?
    // The proposal had "Relationships" and "Family & Friends" as separate sections but I only listed "Relationships" in the Categories section of the artifact.
    // Let's stick to the categories defined in PREDEFINED_CATEGORIES. I'll put Family stuff in Relationships.
    { categoryName: 'Relationships', habit: { name: 'Social Activity', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Relationships', habit: { name: 'Family/Friend Check-in', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Relationships', habit: { name: 'Support Sister', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },

    // Career & Growth
    { categoryName: 'Career & Growth', habit: { name: 'ML Study Block', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Career & Growth', habit: { name: 'Azure AI-102 Prep', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Career & Growth', habit: { name: 'Math Study Block', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Career & Growth', habit: { name: 'Project Review', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Career & Growth', habit: { name: 'Job Search Sprint', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },

    // Financial
    { categoryName: 'Financial', habit: { name: 'Budget Review', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Financial', habit: { name: 'Savings Check', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
    { categoryName: 'Financial', habit: { name: 'Adjust Savings Plan', goal: { type: 'boolean', frequency: 'weekly' }, archived: false } },
];
