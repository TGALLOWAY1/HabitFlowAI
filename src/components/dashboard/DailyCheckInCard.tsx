import { useMemo } from 'react';
import { format } from 'date-fns';
import { Sun, Moon, CheckCircle2, ChevronRight, Battery, Droplets, Brain, Frown } from 'lucide-react';
import { useHabitStore } from '../../store/HabitContext';
import type { WellbeingSession } from '../../models/persistenceTypes';

interface DailyCheckInCardProps {
    onOpenCheckIn: () => void;
}

const METRIC_ICONS: Record<string, { icon: React.FC<{ size?: number; className?: string }>; color: string }> = {
    energy: { icon: Battery, color: 'text-emerald-400' },
    calm: { icon: Droplets, color: 'text-sky-400' },
    stress: { icon: Droplets, color: 'text-rose-400' },
    focus: { icon: Brain, color: 'text-violet-400' },
    lowMood: { icon: Frown, color: 'text-amber-400' },
    sleepScore: { icon: Moon, color: 'text-indigo-400' },
};

const SUMMARY_KEYS: Array<{ key: keyof WellbeingSession; label: string; max: number }> = [
    { key: 'energy', label: 'Energy', max: 5 },
    { key: 'calm', label: 'Calm', max: 4 },
    { key: 'stress', label: 'Stress', max: 4 },
    { key: 'focus', label: 'Focus', max: 4 },
    { key: 'lowMood', label: 'Mood', max: 4 },
    { key: 'sleepScore', label: 'Sleep', max: 100 },
];

export const DailyCheckInCard: React.FC<DailyCheckInCardProps> = ({ onOpenCheckIn }) => {
    const { wellbeingLogs } = useHabitStore();
    const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    const todayLog = wellbeingLogs[today];
    const hasMorning = !!todayLog?.morning;
    const hasEvening = !!todayLog?.evening;
    const isEvening = new Date().getHours() >= 17;

    // Determine which session to show summary for
    const activeSession: WellbeingSession | undefined = isEvening
        ? (todayLog?.evening || todayLog?.morning)
        : todayLog?.morning;

    const sessionDone = isEvening ? hasEvening : hasMorning;
    const nextSessionAvailable = hasMorning && !hasEvening && isEvening;

    // Collect non-null metric values for summary
    const summaryMetrics = useMemo(() => {
        if (!activeSession) return [];
        return SUMMARY_KEYS
            .filter(({ key }) => {
                const val = activeSession[key];
                return val !== undefined && val !== null && val !== '';
            })
            .slice(0, 4)
            .map(({ key, label, max }) => ({
                label,
                value: activeSession[key] as number,
                max,
            }));
    }, [activeSession]);

    const Icon = isEvening ? Moon : Sun;
    const iconColor = isEvening ? 'text-indigo-400' : 'text-amber-400';
    const sessionLabel = isEvening ? 'Evening' : 'Morning';

    if (sessionDone && !nextSessionAvailable) {
        // Completed state — show summary
        return (
            <button
                onClick={onOpenCheckIn}
                className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-left w-full hover:bg-neutral-800/50 transition-colors"
            >
                <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">{sessionLabel} check-in</span>
                </div>
                {summaryMetrics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {summaryMetrics.map(({ label, value, max }) => {
                            const meta = METRIC_ICONS[SUMMARY_KEYS.find(k => k.label === label)?.key ?? ''];
                            const IconComp = meta?.icon;
                            return (
                                <span
                                    key={label}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 rounded-md text-[11px] text-neutral-300"
                                >
                                    {IconComp && <IconComp size={11} className={meta.color} />}
                                    <span className="text-white font-medium">{value}</span>
                                    <span className="text-neutral-600">/{max}</span>
                                </span>
                            );
                        })}
                    </div>
                )}
            </button>
        );
    }

    // CTA state
    const ctaLabel = nextSessionAvailable
        ? 'Evening Check-in'
        : `${sessionLabel} Check-in`;

    return (
        <button
            onClick={onOpenCheckIn}
            className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-left w-full hover:bg-neutral-800/50 transition-colors group"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-neutral-800 ${iconColor}`}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">{ctaLabel}</p>
                    </div>
                </div>
                <ChevronRight size={16} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
            </div>
        </button>
    );
};
