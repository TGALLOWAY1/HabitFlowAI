import React from 'react';
import { X } from 'lucide-react';
import type { Goal } from '../../models/persistenceTypes';
import type { Habit } from '../../types';

interface InactivityCoachingPopupProps {
    isOpen: boolean;
    onClose: () => void;
    goal: Goal;
    linkedHabits: Habit[];
    position: { top: number; left: number };
}

/**
 * Generates a coaching suggestion based on goal unit and linked habits.
 */
function generateActionSuggestion(goal: Goal, linkedHabits: Habit[]): string {
    const unit = goal.unit?.toLowerCase() || '';
    const habitNames = linkedHabits.map(h => h.name.toLowerCase()).join(' ');

    // Check for distance/time units
    if (unit.includes('mile') || unit.includes('km') || unit.includes('kilometer')) {
        return 'Try a 5-minute walk.';
    }
    if (unit.includes('minute') || unit.includes('hour')) {
        return 'Try a 5-minute session.';
    }

    // Check for reading-related habits
    if (habitNames.includes('read') || habitNames.includes('book') || habitNames.includes('page')) {
        return 'Read 1 page.';
    }

    // Check for cold plunge habits
    if (habitNames.includes('plunge') || habitNames.includes('cold') || habitNames.includes('ice')) {
        return 'Set up your tub tonight.';
    }

    // Fallback: smallest version of one linked habit
    if (linkedHabits.length > 0) {
        return 'Do the smallest version of one linked habit.';
    }

    return 'Take a small step forward today.';
}

export const InactivityCoachingPopup: React.FC<InactivityCoachingPopupProps> = ({
    isOpen,
    onClose,
    goal,
    linkedHabits,
    position,
}) => {
    if (!isOpen) return null;

    const suggestion = generateActionSuggestion(goal, linkedHabits);

    return (
        <div
            className="fixed z-50"
            style={{ top: position.top, left: position.left }}
        >
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative bg-neutral-800 border border-amber-500/30 rounded-xl p-4 shadow-xl w-80 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-neutral-400 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>

                <div className="space-y-3">
                    <div>
                        <h3 className="text-white font-semibold text-sm mb-1">
                            Progress compounds — even a small action today moves you forward.
                        </h3>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                        <div className="text-amber-400 text-sm font-medium mb-1">
                            Try this:
                        </div>
                        <div className="text-white text-sm">
                            {suggestion}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
