import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Sun, Moon, Pill, TrendingUp, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { useHabitStore } from '../../store/HabitContext';
import { getWellbeingDayStatus } from './wellbeingStatus';

interface WellbeingCardProps {
  onOpenMorning: () => void;
  onOpenEvening: () => void;
  onOpenHealth: () => void;
  onOpenInsights: () => void;
  onOpenOverview: () => void;
}

const StatusPill: React.FC<{ done: boolean; label: string }> = ({ done, label }) => (
  <span className="flex items-center gap-1 text-[11px]">
    {done ? (
      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
    ) : (
      <Circle size={12} className="text-neutral-600 shrink-0" />
    )}
    <span className={done ? 'text-neutral-300' : 'text-neutral-500'}>{label}</span>
  </span>
);

export const WellbeingCard: React.FC<WellbeingCardProps> = ({
  onOpenMorning,
  onOpenEvening,
  onOpenHealth,
  onOpenInsights,
  onOpenOverview,
}) => {
  const { wellbeingLogs } = useHabitStore();
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const status = useMemo(() => getWellbeingDayStatus(wellbeingLogs[today]), [wellbeingLogs, today]);

  const actions = [
    { icon: Sun, label: 'Morning', color: 'text-amber-400', onClick: onOpenMorning },
    { icon: Moon, label: 'Evening', color: 'text-indigo-400', onClick: onOpenEvening },
    { icon: Pill, label: 'Health', color: 'text-rose-400', onClick: onOpenHealth },
    { icon: TrendingUp, label: 'Insights', color: 'text-purple-400', onClick: onOpenInsights },
  ];

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm flex flex-col">
      <button
        onClick={onOpenOverview}
        className="flex items-center justify-between w-full mb-2 group"
      >
        <span className="text-xs font-medium text-neutral-400">Wellbeing</span>
        <ChevronRight size={16} className="text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0" />
      </button>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
        <StatusPill done={status.morningDone} label={status.morningDone ? 'Morning Complete' : 'Morning Pending'} />
        <StatusPill done={status.eveningDone} label={status.eveningDone ? 'Evening Complete' : 'Evening Pending'} />
        <StatusPill done={status.sleepLogged} label={status.sleepLogged ? 'Sleep Logged' : 'Sleep Pending'} />
      </div>

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
