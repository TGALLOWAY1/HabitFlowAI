import React, { useMemo } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { calculateHabitStats } from '../utils/analytics';
import { format, parseISO } from 'date-fns';
import { Medal, Calendar } from 'lucide-react';

export const AccomplishmentsLog: React.FC = () => {
    const { habits, logs } = useHabitStore();

    const accomplishments = useMemo(() => {
        const list: { date: string; title: string; type: 'streak' | 'milestone' }[] = [];

        habits.forEach(habit => {
            const stats = calculateHabitStats(habit, logs);

            // Streak Milestones (7, 30, 100 days)
            if (stats.currentStreak >= 7) {
                // In a real app, we'd store the date this was achieved. 
                // For now, we'll just show it as "Current" if active.
                list.push({
                    date: new Date().toISOString(),
                    title: `${habit.name}: ${stats.currentStreak} Day Streak!`,
                    type: 'streak'
                });
            }

            // Cumulative Milestones
            if (habit.goal.frequency === 'total' && habit.goal.target) {
                if (stats.cumulativeValue >= habit.goal.target) {
                    list.push({
                        date: new Date().toISOString(), // Again, approximation
                        title: `${habit.name}: Goal Reached (${stats.cumulativeValue} ${habit.goal.unit})`,
                        type: 'milestone'
                    });
                } else if (stats.cumulativeValue >= habit.goal.target * 0.5) {
                    list.push({
                        date: new Date().toISOString(),
                        title: `${habit.name}: Halfway There! (${stats.cumulativeValue} ${habit.goal.unit})`,
                        type: 'milestone'
                    });
                }
            }
        });

        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [habits, logs]);

    if (accomplishments.length === 0) {
        return (
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm text-center">
                <h3 className="text-xl font-bold text-white mb-2">Accomplishments</h3>
                <p className="text-neutral-500">Keep tracking to unlock milestones!</p>
            </div>
        );
    }

    return (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-white mb-6">Recent Accomplishments</h3>
            <div className="space-y-4">
                {accomplishments.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-neutral-800/30 rounded-lg border border-white/5">
                        <div className={`p-2 rounded-full ${item.type === 'streak' ? 'bg-orange-500/20 text-orange-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                            {item.type === 'streak' ? <FlameIcon /> : <Medal size={20} />}
                        </div>
                        <div>
                            <p className="font-medium text-white">{item.title}</p>
                            <p className="text-xs text-neutral-500 flex items-center gap-1">
                                <Calendar size={10} />
                                {format(parseISO(item.date), 'MMM d, yyyy')}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const FlameIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.243-2.143.7-3.1 1.1 1.1 1.8 2.1 1.8 3.6z" />
    </svg>
);
