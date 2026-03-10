import { useMemo } from 'react';
import { format } from 'date-fns';
import { ArrowRight, Moon, Battery, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useHabitStore } from '../../store/HabitContext';
import { useProgressOverview } from '../../lib/useProgressOverview';

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

const trendIcon = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return <TrendingUp size={12} />;
    if (trend === 'down') return <TrendingDown size={12} />;
    return <Minus size={12} />;
};

export const DailyOverviewCard: React.FC = () => {
    const { habits, logs, wellbeingLogs } = useHabitStore();
    const { data: progressData } = useProgressOverview();

    const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    const activeHabits = useMemo(() => habits.filter(h => !h.archived), [habits]);
    const completedCount = useMemo(() =>
        activeHabits.filter(h => logs[`${h.id}-${today}`]?.completed).length,
        [activeHabits, logs, today]
    );
    const totalCount = activeHabits.length;

    const nextHabit = useMemo(() => {
        if (!progressData?.habitsToday) return null;
        return progressData.habitsToday.find(h => !h.completed)?.habit;
    }, [progressData]);

    const momentum = progressData?.momentum?.global;

    const todayWellbeing = wellbeingLogs[today];
    const sleepScore = todayWellbeing?.morning?.sleepScore ?? todayWellbeing?.sleepScore ?? null;
    const energy = todayWellbeing?.morning?.energy ?? todayWellbeing?.evening?.energy ?? todayWellbeing?.energy ?? null;

    const allDone = totalCount > 0 && completedCount === totalCount;

    return (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-4">
                <CompletionRing completed={completedCount} total={totalCount} />
                <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white">Today</h3>
                        {momentum && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                momentum.state === 'Strong' ? 'bg-emerald-500/20 text-emerald-300' :
                                momentum.state === 'Steady' ? 'bg-blue-500/20 text-blue-300' :
                                momentum.state === 'Building' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-neutral-700 text-neutral-400'
                            }`}>
                                {trendIcon(momentum.trend)}
                                {momentum.state}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-neutral-400 mb-2">
                        {allDone ? (
                            <span className="text-emerald-400 font-medium">All habits complete!</span>
                        ) : (
                            `${completedCount} of ${totalCount} habits done`
                        )}
                    </p>
                    {nextHabit && !allDone && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                            <ArrowRight size={12} className="text-emerald-500 flex-shrink-0" />
                            <span className="truncate">Next: {nextHabit.name}</span>
                        </div>
                    )}
                </div>
            </div>

            {(sleepScore !== null || energy !== null) && (
                <div className="flex gap-3 mt-3 pt-3 border-t border-white/5">
                    {sleepScore !== null && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                            <Moon size={12} className="text-indigo-400" />
                            <span>Sleep <span className="text-white font-medium">{sleepScore}</span></span>
                        </div>
                    )}
                    {energy !== null && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                            <Battery size={12} className="text-emerald-400" />
                            <span>Energy <span className="text-white font-medium">{energy}</span></span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
