import React from 'react';
import type { Habit } from '../../types';
import { cn } from '../../utils/cn';
import { HabitGridCell } from './HabitGridCell';
import { Flame } from 'lucide-react';

interface PinnedHabitsStripProps {
    habits: Habit[];
    onUnpin: (id: string) => void;
    onToggle: (id: string) => void;
    checkStatus: (id: string) => boolean;
}

export const PinnedHabitsStrip = ({ habits, onUnpin, onToggle, checkStatus }: PinnedHabitsStripProps) => {
    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    if (!habits || habits.length === 0) return null;

    return (
        <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                <Flame size={12} className="text-orange-500" />
                Today's Focus
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                {habits.map(habit => (
                    <HabitGridCell
                        key={habit.id}
                        habit={habit}
                        isCompleted={checkStatus(habit.id)}
                        isExpanded={expandedId === habit.id}
                        onToggle={() => onToggle(habit.id)}
                        onExpand={() => setExpandedId(prev => prev === habit.id ? null : habit.id)}
                        onPin={onUnpin}
                        onUpdateEstimate={() => { }} // TODO: Pass this prop from parent if needed
                        subHabits={[]} // Bundles in pinned view - simplified for now
                    />
                ))}
            </div>
        </div>
    );
};
