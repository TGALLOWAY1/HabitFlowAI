import { useMemo } from 'react';
import { format } from 'date-fns';
import { useHabitStore } from '../../store/HabitContext';

const CompletionRing: React.FC<{ completed: number; total: number; size?: number }> = ({ completed, total, size = 80 }) => {
    const percent = total > 0 ? (completed / total) * 100 : 0;
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - percent / 100);

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="#262626" strokeWidth={6}
                />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="#10b981" strokeWidth={6}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-white leading-none">{completed}/{total}</span>
            </div>
        </div>
    );
};

export const DailyOverviewCard: React.FC = () => {
    const { habits, logs } = useHabitStore();

    const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    const rootHabits = useMemo(() => {
        const childIds = new Set<string>();
        habits.forEach(h => {
            if (h.type === 'bundle' && h.subHabitIds) {
                h.subHabitIds.forEach(id => childIds.add(id));
            }
        });
        return habits.filter(h => !h.archived && !childIds.has(h.id));
    }, [habits]);

    const completedCount = useMemo(() =>
        rootHabits.filter(h => logs[`${h.id}-${today}`]?.completed).length,
        [rootHabits, logs, today]
    );
    const totalCount = rootHabits.length;

    return (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm flex flex-col items-center justify-center">
            <CompletionRing completed={completedCount} total={totalCount} />
            <span className="text-[11px] text-neutral-400 font-medium mt-1.5">Daily Habits</span>
        </div>
    );
};
