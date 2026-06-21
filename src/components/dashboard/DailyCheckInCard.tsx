import { useMemo } from 'react';
import { format } from 'date-fns';
import { Sun, Moon, CheckCircle2, ChevronRight, PenLine, FileText, Clock, Sparkles } from 'lucide-react';
import { useHabitStore } from '../../store/HabitContext';

interface DailyCheckInCardProps {
    onOpenCheckIn: () => void;
    onNavigateHistory?: () => void;
}

export const DailyCheckInCard: React.FC<DailyCheckInCardProps> = ({ onOpenCheckIn, onNavigateHistory }) => {
    const { wellbeingLogs } = useHabitStore();
    const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    const todayLog = wellbeingLogs[today];
    const isEvening = new Date().getHours() >= 17;
    const sessionDone = isEvening ? !!todayLog?.evening : !!todayLog?.morning;

    const HeaderIcon = isEvening ? Moon : Sun;
    const headerIconColor = isEvening ? 'text-indigo-400' : 'text-amber-400';
    const title = isEvening ? 'Evening Check-in' : 'Morning Check-in';

    const actions = [
        { icon: PenLine, label: 'Entry', color: 'text-emerald-400', onClick: onOpenCheckIn },
        { icon: FileText, label: 'Details', color: 'text-emerald-400', onClick: onOpenCheckIn },
        { icon: Clock, label: 'History', color: 'text-emerald-400', onClick: () => onNavigateHistory?.() },
        { icon: Sparkles, label: 'AI', color: 'text-purple-400', onClick: () => onNavigateHistory?.() },
    ];

    return (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm flex flex-col">
            <button
                onClick={onOpenCheckIn}
                className="flex items-center justify-between w-full mb-3 group"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <HeaderIcon size={16} className={headerIconColor} />
                    <span className="text-xs font-medium text-neutral-400 truncate">{title}</span>
                    {sessionDone && <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />}
                </div>
                <ChevronRight size={16} className="text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0" />
            </button>
            <div className="flex items-center justify-between flex-1">
                {actions.map(({ icon: Icon, label, color, onClick }) => (
                    <button
                        key={label}
                        onClick={onClick}
                        className="flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-neutral-800/50 transition-colors flex-1"
                    >
                        <Icon size={18} className={color} />
                        <span className="text-[10px] text-neutral-500">{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
