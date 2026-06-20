import React from 'react';
import { format, parseISO } from 'date-fns';
import { Moon, Pencil } from 'lucide-react';
import type { SleepNight } from '../../../lib/analyticsClient';
import { minutesAfterNoonToClock, formatDurationMinutes, quality4to10 } from './sleepFormat';

interface Props {
  nights: SleepNight[];
  onEditNight: (dayKey: string) => void;
}

/**
 * Browse-and-edit list of recent nights. Each row opens the SleepEntryForm
 * pre-set to that night so previous days can be corrected. Nights without any
 * logged data are still shown so a missed night can be filled in.
 */
export const SleepNightsEditor: React.FC<Props> = ({ nights, onEditNight }) => {
  // Most recent night first.
  const sorted = [...nights].sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1));

  return (
    <section className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
        <Moon size={16} className="text-indigo-400" /> Edit a night
      </h3>
      <p className="text-xs text-neutral-400 mb-3">Tap any night to log or correct its sleep data.</p>

      {sorted.length === 0 ? (
        <p className="text-xs text-neutral-500 py-2">No nights in this range yet.</p>
      ) : (
        <ul className="divide-y divide-white/5 max-h-80 overflow-y-auto modal-scroll -mx-1">
          {sorted.map((n) => {
            const q = quality4to10(n.sleepQuality0to4);
            return (
              <li key={n.dayKey}>
                <button
                  type="button"
                  onClick={() => onEditNight(n.dayKey)}
                  className="w-full flex items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-white/5 rounded-lg transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium">
                      {format(parseISO(n.dayKey), 'EEE, MMM d')}
                    </div>
                    <div className="text-xs text-neutral-400 truncate">
                      {n.hasData ? (
                        <>
                          {formatDurationMinutes(n.durationMinutes)}
                          {(n.bedtimeMinutes != null || n.wakeMinutes != null) && (
                            <> · {minutesAfterNoonToClock(n.bedtimeMinutes)} → {minutesAfterNoonToClock(n.wakeMinutes)}</>
                          )}
                          {n.appleSleepScore != null && <> · score {n.appleSleepScore}</>}
                          {q != null && <> · quality {q}/10</>}
                        </>
                      ) : (
                        <span className="text-neutral-500">No data — tap to add</span>
                      )}
                    </div>
                  </div>
                  <Pencil size={15} className="shrink-0 text-neutral-500 group-hover:text-indigo-300" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
