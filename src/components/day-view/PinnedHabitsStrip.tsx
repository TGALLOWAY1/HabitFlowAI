import type { Habit } from '../../types';

import { DayHabitGrid } from './DayHabitGrid';
import type { DayViewHabitStatus } from './habitStatusResolution';
import { Flame } from 'lucide-react';

interface PinnedHabitsStripProps {
    habits: Habit[];
    habitStatusMap: Map<string, DayViewHabitStatus>;
    dateStr: string;
    allHabitsLookup: Map<string, Habit>;
    onUnpin: (id: string) => void;
    onToggle: (habitId: string) => Promise<void>;
    onUpdateHabitEntry: (habitId: string, dateKey: string, data: unknown) => Promise<void>;
    deleteHabitEntryByKey: (habitId: string, dateKey: string) => Promise<void>;
}

export const PinnedHabitsStrip = ({
    habits,
    habitStatusMap,
    dateStr,
    allHabitsLookup,
    onUnpin,
    onToggle,
    onUpdateHabitEntry,
    deleteHabitEntryByKey,
}: PinnedHabitsStripProps) => {
    if (!habits || habits.length === 0) return null;

    return (
        <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                <Flame size={12} className="text-orange-500" />
                Today's Focus
            </h2>

            <DayHabitGrid
                habits={habits}
                habitStatusMap={habitStatusMap}
                dateStr={dateStr}
                allHabitsLookup={allHabitsLookup}
                onToggle={onToggle}
                onPin={onUnpin}
                onUpdateHabitEntry={onUpdateHabitEntry}
                deleteHabitEntryByKey={deleteHabitEntryByKey}
            />
        </div>
    );
};
