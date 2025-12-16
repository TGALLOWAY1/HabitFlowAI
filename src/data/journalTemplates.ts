export interface JournalPrompt {
    id: string;
    text: string;
}

export interface JournalCategory {
    id: string;
    title: string;
    description: string;
    icon?: string; // We'll map string to Lucide icon in the component
}

export interface JournalTemplate {
    id: string;
    categoryId: string;
    title: string;
    description: string;
    persona: string;
    tone: string;
    prompts: {
        standard: JournalPrompt[];
        deep?: JournalPrompt[];
    };
}

export const JOURNAL_CATEGORIES: JournalCategory[] = [
    {
        id: 'daily-structure',
        title: 'Daily Structure',
        description: 'Planning, review, and intention setting',
        icon: 'Sunrise'
    },
    {
        id: 'mental-health',
        title: 'Mental & Emotional Health',
        description: 'Processing emotions and reducing stress',
        icon: 'Brain'
    },
    {
        id: 'physical-health',
        title: 'Physical Health',
        description: 'Tracking body, movement, and fuel',
        icon: 'Dumbbell'
    },
    {
        id: 'habits',
        title: 'Habits & Behavior',
        description: 'Analyzing triggers and patterns',
        icon: 'Microscope'
    },
    {
        id: 'personal-growth',
        title: 'Personal Growth',
        description: 'Learning, challenges, and flow',
        icon: 'Sprout'
    },
    {
        id: 'relationships',
        title: 'Relationships',
        description: 'Connection, empathy, and gratitude',
        icon: 'Users'
    }
];

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
    // --- Daily Structure & Reflection ---
    {
        id: 'morning-primer',
        categoryId: 'daily-structure',
        title: 'Morning Primer',
        description: 'Intention Setting',
        persona: 'The Strategic Coach',
        tone: 'Clear, focused, grounding',
        prompts: {
            standard: [
                { id: 'priority', text: 'What is the one absolute priority for today?' },
                { id: 'logistics', text: 'When and where will I accomplish this?' },
                { id: 'contingency', text: 'If I feel resistance, what is my If/Then plan?' }
            ]
        }
    },
    {
        id: 'daily-retrospective',
        categoryId: 'daily-structure',
        title: 'Daily Retrospective',
        description: 'Evening Review',
        persona: 'The Reflective Mentor',
        tone: 'Calm, learning-oriented',
        prompts: {
            standard: [
                { id: 'win', text: 'What went well today?' },
                { id: 'challenge', text: 'What was one challenge I faced, and how did I respond?' },
                { id: 'pivot', text: 'What would I do differently next time?' }
            ],
            deep: [
                { id: 'pattern', text: 'What pattern did I notice about myself today?' },
                { id: 'values', text: 'Did I act in alignment with my values?' }
            ]
        }
    },

    // --- Mental & Emotional Health ---
    {
        id: 'thought-detox',
        categoryId: 'mental-health',
        title: 'Thought Detox',
        description: 'CBT & Emotional Regulation',
        persona: 'The Cognitive Reframer',
        tone: 'Rational, stabilizing',
        prompts: {
            standard: [
                { id: 'stressor', text: 'What situation is stressing me right now?' },
                { id: 'thought', text: 'What thought am I having about it?' },
                { id: 'balance', text: 'What is a more balanced way to see this?' }
            ]
        }
    },
    {
        id: 'emotion-check-in',
        categoryId: 'mental-health',
        title: 'Emotion Check-In',
        description: 'Variant of Thought Detox',
        persona: 'The Compassionate Therapist',
        tone: 'Gentle, non-judgmental, grounding',
        prompts: {
            standard: [
                { id: 'weather', text: 'If your internal state were weather, what would it be?' },
                { id: 'somatic', text: 'Where in your body do you feel the strongest sensation?' },
                { id: 'labeling', text: 'Name three emotions present right now.' },
                { id: 'compassion', text: 'What would you say to a dear friend feeling this way?' },
                { id: 'unburden', text: 'What is one thought you can safely leave here for tonight?' }
            ]
        }
    },
    {
        id: 'deep-gratitude',
        categoryId: 'mental-health',
        title: 'Deep Gratitude',
        description: 'Positive Psychology',
        persona: 'The Grounded Optimist',
        tone: 'Warm, embodied',
        prompts: {
            standard: [
                { id: 'three-things', text: 'Three specific things that went well today.' },
                { id: 'cause', text: 'Why did they happen?' },
                { id: 'sensation', text: 'How did they feel in my body?' }
            ]
        }
    },

    // --- Physical Health ---
    {
        id: 'workout-log',
        categoryId: 'physical-health',
        title: 'Workout Log',
        description: 'Performance Tracking',
        persona: 'Performance-Focused Personal Trainer',
        tone: 'Analytical, motivating',
        prompts: {
            standard: [
                { id: 'pre-scan', text: 'Energy & mobility (1–10). Fueled properly?' },
                { id: 'highlight', text: 'Biggest win today?' },
                { id: 'mechanics', text: 'Any discomfort or joint friction?' },
                { id: 'rpe', text: 'How close to failure on key lifts?' },
                { id: 'recovery', text: 'Sleep + nutrition tonight?' }
            ]
        }
    },
    {
        id: 'diet-journal',
        categoryId: 'physical-health',
        title: 'Diet Journal',
        description: 'Mindful Eating',
        persona: 'Life Coach & Dietitian',
        tone: 'Compassionate, reframing',
        prompts: {
            standard: [
                { id: 'win', text: 'Nourishment win today?' },
                { id: 'mindful', text: 'Mindful eating moment?' },
                { id: 'trigger', text: 'Trigger behind any challenges?' },
                { id: 'hydration', text: 'Hydration & its effect?' },
                { id: 'intention', text: 'One nourishing intention for tomorrow?' }
            ]
        }
    },

    // --- Habits & Behavior Change ---
    {
        id: 'habit-scientist',
        categoryId: 'habits',
        title: 'Habit Scientist',
        description: 'Behavioral Analysis',
        persona: 'The Curious Scientist',
        tone: 'Neutral, analytical',
        prompts: {
            standard: [
                { id: 'observation', text: 'What habit did I succeed or struggle with today?' },
                { id: 'trigger', text: 'What happened right before?' },
                { id: 'adjustment', text: 'How can I adjust the cue tomorrow?' }
            ]
        }
    },
    {
        id: 'woop-session',
        categoryId: 'habits',
        title: 'WOOP Session',
        description: 'Goal Overcoming',
        persona: 'The Strategic Realist',
        tone: 'Focused, honest',
        prompts: {
            standard: [
                { id: 'wish', text: 'Wish: What is an important wish you want to fulfill?' },
                { id: 'outcome', text: 'Outcome: What will be the best result of fulfilling your wish?' },
                { id: 'obstacle', text: 'Obstacle: What is the main inner obstacle holding you back?' },
                { id: 'plan', text: 'Plan: If (obstacle) occurs, then I will (action).' }
            ]
        }
    },

    // --- Personal Growth ---
    {
        id: 'personal-growth',
        categoryId: 'personal-growth',
        title: 'Personal Growth',
        description: 'Learning & Flow',
        persona: 'Growth Mindset Coach',
        tone: 'Energetic, challenging',
        prompts: {
            standard: [
                { id: 'surprise', text: 'What surprised me today?' },
                { id: 'setback', text: 'What did a setback teach me?' },
                { id: 'resistance', text: 'Where did I feel resistance?' },
                { id: 'flow', text: 'When did I enter flow?' },
                { id: 'next-step', text: 'What’s my 1% move tomorrow?' }
            ]
        }
    },

    // --- Relationships ---
    {
        id: 'relationship-journal',
        categoryId: 'relationships',
        title: 'Relationship Journal',
        description: 'Connection',
        persona: 'The Empathetic Listener',
        tone: 'Quiet, spacious',
        prompts: {
            standard: [
                { id: 'people', text: 'Who has been on my mind today?' },
                { id: 'replay', text: 'What interaction am I replaying?' },
                { id: 'listening', text: 'Did I feel heard? Did I listen well?' },
                { id: 'appreciation', text: 'One thing I appreciated about someone today.' },
                { id: 'unasked', text: 'A question I didn’t ask — and why.' }
            ]
        }
    }
];

export const FREE_WRITE_TEMPLATE: JournalTemplate = {
    id: 'free-write',
    categoryId: 'daily-structure', // Assign default category even if treated specially
    title: 'Free Write',
    description: 'Universal Option',
    persona: 'None',
    tone: 'Unstructured',
    prompts: {
        standard: [
            { id: 'free-write', text: '' }
        ]
    }
};
