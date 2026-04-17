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
                <div className="w-12 h-12 bg-surface-1 rounded-full flex items-center justify-center mb-4">
                    <Activity className="text-content-muted" size={24} />
                </div>
                <p className="text-content-secondary font-medium">No activity yet</p>
                <p className="text-content-muted text-sm mt-1">
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
                    className="flex items-center justify-between p-3 bg-surface-0/30 border border-line-subtle rounded-lg hover:bg-surface-0/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${entry.source === 'habit' ? 'bg-accent-soft text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {entry.source === 'habit' ? <Activity size={14} /> : <Database size={14} />}
                        </div>
                        <div>
                            <div className="text-content-primary text-sm font-medium">
                                {format(parseISO(entry.date), 'MMM d, yyyy')}
                            </div>
                            <div className="text-content-secondary text-xs flex items-center gap-1.5">
                                {entry.source === 'habit' ? (
                                    <>
                                        <span className="bg-accent-soft text-accent-contrast text-[10px] px-1.5 py-0.5 rounded">Linked Habit</span>
                                        <span>{entry.habitName}</span>
                                    </>
                                ) : (
                                    <span className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0.5 rounded">Manual Log</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-content-primary font-medium">
                            +{Number.isInteger(entry.value) ? entry.value : entry.value.toFixed(1)} <span className="text-content-muted text-xs font-normal">{entry.unit}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
