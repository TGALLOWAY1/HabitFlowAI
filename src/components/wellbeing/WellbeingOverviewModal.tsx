import React, { useMemo } from 'react';
import { X, Sun, Moon, Pill, TrendingUp, CheckCircle2, Circle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useHabitStore } from '../../store/HabitContext';
import { getWellbeingDayStatus } from './wellbeingStatus';

interface WellbeingOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMorning: () => void;
  onOpenEvening: () => void;
  onOpenHealth: () => void;
  onOpenInsights: () => void;
}

/** Average a morning-session metric across the last `days` days. */
function recentAverage(
  logs: ReturnType<typeof useHabitStore>['wellbeingLogs'],
  metricKey: string,
  session: 'morning' | 'evening',
  days: number
): number | null {
  const today = new Date();
  let sum = 0;
  let count = 0;
  for (let i = 0; i < days; i++) {
    const dayKey = format(subDays(today, i), 'yyyy-MM-dd');
    const value = (logs[dayKey]?.[session] as Record<string, unknown> | undefined)?.[metricKey];
    if (typeof value === 'number') {
      sum += value;
      count += 1;
    }
  }
  return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
}

const TrendCard: React.FC<{ label: string; value: number | null }> = ({ label, value }) => (
  <div className="bg-neutral-800/40 border border-white/5 rounded-xl px-3 py-2.5">
    <div className="text-[11px] text-neutral-500">{label}</div>
    <div className="text-lg font-bold text-white tabular-nums">{value ?? '—'}</div>
  </div>
);

export const WellbeingOverviewModal: React.FC<WellbeingOverviewModalProps> = ({
  isOpen,
  onClose,
  onOpenMorning,
  onOpenEvening,
  onOpenHealth,
  onOpenInsights,
}) => {
  const { wellbeingLogs } = useHabitStore();
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const status = useMemo(() => getWellbeingDayStatus(wellbeingLogs[today]), [wellbeingLogs, today]);

  const trends = useMemo(
    () => ({
      mood: recentAverage(wellbeingLogs, 'mood', 'morning', 7),
      energy: recentAverage(wellbeingLogs, 'energy', 'morning', 7),
      anxiety: recentAverage(wellbeingLogs, 'anxiety', 'morning', 7),
      satisfaction: recentAverage(wellbeingLogs, 'satisfaction', 'evening', 7),
    }),
    [wellbeingLogs]
  );

  if (!isOpen) return null;

  const statusRows = [
    { label: 'Morning check-in', done: status.morningDone },
    { label: 'Evening check-in', done: status.eveningDone },
    { label: 'Sleep logged', done: status.sleepLogged },
  ];

  const quickActions = [
    { icon: Sun, label: 'Morning', color: 'text-amber-400', onClick: onOpenMorning },
    { icon: Moon, label: 'Evening', color: 'text-indigo-400', onClick: onOpenEvening },
    { icon: Pill, label: 'Health', color: 'text-rose-400', onClick: onOpenHealth },
    { icon: TrendingUp, label: 'Insights', color: 'text-purple-400', onClick: onOpenInsights },
  ];

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-white/5 bg-neutral-800/50 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Wellbeing</h2>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors -mr-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto modal-scroll p-5 space-y-6">
          {/* Today's status */}
          <div>
            <div className="text-xs font-semibold text-neutral-400 mb-2">Today</div>
            <div className="space-y-2">
              {statusRows.map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-sm">
                  {row.done ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : (
                    <Circle size={16} className="text-neutral-600" />
                  )}
                  <span className={row.done ? 'text-neutral-200' : 'text-neutral-500'}>
                    {row.label} — {row.done ? 'complete' : 'pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent trends (7-day) */}
          <div>
            <div className="text-xs font-semibold text-neutral-400 mb-2">Recent trends (7-day avg)</div>
            <div className="grid grid-cols-2 gap-2">
              <TrendCard label="Mood" value={trends.mood} />
              <TrendCard label="Energy" value={trends.energy} />
              <TrendCard label="Anxiety" value={trends.anxiety} />
              <TrendCard label="Satisfaction" value={trends.satisfaction} />
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <div className="text-xs font-semibold text-neutral-400 mb-2">Quick actions</div>
            <div className="grid grid-cols-4 gap-2">
              {quickActions.map(({ icon: Icon, label, color, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-neutral-800/40 border border-white/5 hover:border-white/15 transition-colors"
                >
                  <Icon size={20} className={color} />
                  <span className="text-[11px] text-neutral-400">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
