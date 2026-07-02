import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Sun, Moon, Pill, ChevronRight } from 'lucide-react';
import { useHabitStore } from '../../store/HabitContext';
import { getWellbeingDayStatus } from './wellbeingStatus';

interface WellbeingCardProps {
  onOpenMorning: () => void;
  onOpenEvening: () => void;
  onOpenHealth: () => void;
  onOpenOverview: () => void;
}

export const WellbeingCard: React.FC<WellbeingCardProps> = ({
  onOpenMorning,
  onOpenEvening,
  onOpenHealth,
  onOpenOverview,
}) => {
  const { wellbeingLogs } = useHabitStore();
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const status = useMemo(() => getWellbeingDayStatus(wellbeingLogs[today]), [wellbeingLogs, today]);

  const actions = [
    { icon: Sun, label: 'Morning', color: 'text-amber-400', onClick: onOpenMorning, done: status.morningDone },
    { icon: Moon, label: 'Evening', color: 'text-indigo-400', onClick: onOpenEvening, done: status.eveningDone },
    { icon: Pill, label: 'Health', color: 'text-rose-400', onClick: onOpenHealth, done: false },
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

      <div className="flex items-center justify-between flex-1">
        {actions.map(({ icon: Icon, label, color, onClick, done }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-neutral-800/50 transition-colors flex-1"
          >
            <Icon size={18} className={color} />
            <span className={`text-[10px] ${done ? 'text-emerald-400 font-medium' : 'text-neutral-500'}`}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
