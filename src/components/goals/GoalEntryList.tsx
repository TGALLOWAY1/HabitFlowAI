import React from 'react';
import { format, parseISO } from 'date-fns';
import { Activity, Database } from 'lucide-react';

interface GoalEntry {
    id: string;
    date: string;
    value: number;
    source: 'habit' | 'manual';
    habitName?: string;
    unit?: string;
}

interface GoalEntryListProps {
    entries: GoalEntry[];
}

export const GoalEntryList: React.FC<GoalEntryListProps> = ({ entries }) => {
    // Sort by date descending
    const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                    <Activity className="text-neutral-500" size={24} />
                </div>
                <p className="text-neutral-400 font-medium">No activity yet</p>
                <p className="text-neutral-500 text-sm mt-1">
                    Progress will appear here as you complete linked habits.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2 mt-4">
            {sortedEntries.map((entry) => (
                <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 bg-neutral-900/30 border border-white/5 rounded-lg hover:bg-neutral-900/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${entry.source === 'habit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {entry.source === 'habit' ? <Activity size={14} /> : <Database size={14} />}
                        </div>
                        <div>
                            <div className="text-white text-sm font-medium">
                                {format(parseISO(entry.date), 'MMM d, yyyy')}
                            </div>
                            <div className="text-neutral-400 text-xs flex items-center gap-1.5">
                                {entry.source === 'habit' ? (
                                    <>
                                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded">Linked Habit</span>
                                        <span>{entry.habitName}</span>
                                    </>
                                ) : (
                                    <span className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0.5 rounded">Manual Log</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-white font-medium">
                            +{Number.isInteger(entry.value) ? entry.value : entry.value.toFixed(1)} <span className="text-neutral-500 text-xs font-normal">{entry.unit}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
