import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import type { ScheduleEvent } from '../../utils/goalScheduleUtils';
import { getEventTypeColor } from '../../utils/goalScheduleUtils';

interface ScheduleCalendarProps {
  events: Map<string, ScheduleEvent[]>;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDateClick: (date: string) => void;
  selectedDate: string | null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_DOTS = 4;

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  events,
  currentMonth,
  onMonthChange,
  onDateClick,
  selectedDate,
}) => {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  return (
    <div className="w-full">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-surface-1 text-content-secondary hover:text-content-primary transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-semibold text-content-primary">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-surface-1 text-content-secondary hover:text-content-primary transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_NAMES.map(name => (
          <div key={name} className="text-center text-xs font-medium text-content-muted py-1.5">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-surface-1/30 rounded-lg overflow-hidden">
        {calendarDays.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = events.get(dateKey) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const isSelected = selectedDate === dateKey;

          // Deduplicate event types for dots
          const uniqueTypes = [...new Set(dayEvents.map(e => e.eventType))];
          const showOverflow = dayEvents.length > MAX_DOTS;

          return (
            <button
              key={dateKey}
              onClick={() => onDateClick(dateKey)}
              className={`
                relative min-h-[3.25rem] sm:min-h-[3.75rem] p-1 sm:p-1.5 flex flex-col items-center
                transition-colors
                ${inMonth ? 'bg-surface-0/60' : 'bg-surface-0/20'}
                ${isSelected ? 'ring-2 ring-emerald-500/60 ring-inset' : ''}
                ${dayEvents.length > 0 && inMonth ? 'hover:bg-surface-1/80 cursor-pointer' : 'hover:bg-surface-1/40'}
              `}
            >
              {/* Day Number */}
              <span className={`
                text-xs sm:text-sm font-medium leading-none
                ${!inMonth ? 'text-neutral-700' : today ? 'text-accent-contrast font-bold' : 'text-content-secondary'}
              `}>
                {format(day, 'd')}
              </span>

              {/* Event Dots */}
              {dayEvents.length > 0 && inMonth && (
                <div className="flex items-center gap-0.5 mt-1 flex-wrap justify-center">
                  {showOverflow ? (
                    <span className="text-[10px] font-semibold text-content-secondary bg-surface-2 rounded-full px-1.5 py-0.5 leading-none">
                      {dayEvents.length}
                    </span>
                  ) : (
                    uniqueTypes.slice(0, MAX_DOTS).map(type => (
                      <span
                        key={type}
                        className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${getEventTypeColor(type)}`}
                      />
                    ))
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
