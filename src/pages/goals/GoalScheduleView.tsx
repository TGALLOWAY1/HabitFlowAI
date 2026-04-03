import React, { useState, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle, X, Calendar, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useGoalsWithProgress } from '../../lib/useGoalsWithProgress';
import { useGoalAnalytics } from '../../lib/useGoalAnalytics';
import { useHabitStore } from '../../store/HabitContext';
import { ScheduleCalendar } from '../../components/goals/ScheduleCalendar';
import {
  deriveScheduleEvents,
  groupEventsByDate,
  filterEventsByCategory,
  filterEventsByGoal,
  sortEvents,
  getEventTypeColor,
  getEventTypeLabel,
  getStatusColor,
  getStatusLabel,
  type ScheduleEvent,
  type ScheduleEventType,
} from '../../utils/goalScheduleUtils';

interface GoalScheduleViewProps {
  onViewGoal?: (goalId: string) => void;
}

const EVENT_TYPE_ORDER: ScheduleEventType[] = ['completed', 'target', 'forecast', 'milestone'];

export const GoalScheduleView: React.FC<GoalScheduleViewProps> = ({ onViewGoal }) => {
  const { data: goals, loading: goalsLoading, error: goalsError } = useGoalsWithProgress();
  const { data: analytics, loading: analyticsLoading, error: analyticsError } = useGoalAnalytics();
  const { categories } = useHabitStore();

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [focusedGoalId, setFocusedGoalId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const loading = goalsLoading || analyticsLoading;
  const error = goalsError || analyticsError;

  // Derive all events
  const allEvents = useMemo(() => {
    if (!goals || goals.length === 0) return [];
    const breakdown = analytics?.goalBreakdown ?? [];
    return deriveScheduleEvents(goals, breakdown);
  }, [goals, analytics]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let events = allEvents;
    if (focusedGoalId) {
      events = filterEventsByGoal(events, focusedGoalId);
    } else if (selectedCategoryIds.length > 0) {
      events = filterEventsByCategory(events, selectedCategoryIds);
    }
    return events;
  }, [allEvents, focusedGoalId, selectedCategoryIds]);

  const eventsByDate = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);

  // Events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return sortEvents(eventsByDate.get(selectedDate) || []);
  }, [selectedDate, eventsByDate]);

  // Group selected date events by type
  const eventsByType = useMemo(() => {
    const grouped = new Map<ScheduleEventType, ScheduleEvent[]>();
    for (const event of selectedDateEvents) {
      const existing = grouped.get(event.eventType);
      if (existing) {
        existing.push(event);
      } else {
        grouped.set(event.eventType, [event]);
      }
    }
    return grouped;
  }, [selectedDateEvents]);

  const focusedGoalTitle = useMemo(() => {
    if (!focusedGoalId || !goals) return null;
    return goals.find(g => g.goal.id === focusedGoalId)?.goal.title ?? null;
  }, [focusedGoalId, goals]);

  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(prev => prev === date ? null : date);
  }, []);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedCategoryIds([]);
    setFocusedGoalId(null);
  }, []);

  // Loading state
  if (loading && allEvents.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-emerald-500 animate-spin" size={32} />
          <div className="text-neutral-400 text-sm">Loading schedule insights...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <div className="text-red-400 font-medium mb-1">Error</div>
            <div className="text-red-300 text-sm">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state — no goals
  if (!goals || goals.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-neutral-800 rounded-full flex items-center justify-center mb-4">
            <Calendar className="text-neutral-500" size={32} />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Goals Yet</h2>
          <p className="text-neutral-400 text-sm">
            Create your first goal to see scheduling insights, forecasts, and milestones.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-4">
      {/* Focus Mode Banner */}
      {focusedGoalId && focusedGoalTitle && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <span className="text-sm text-emerald-400 font-medium flex-1 truncate">
            Focused: {focusedGoalTitle}
          </span>
          <button
            onClick={() => setFocusedGoalId(null)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            aria-label="Exit focus mode"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Category Filters */}
      {!focusedGoalId && categories.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors mb-2"
          >
            <Filter size={14} />
            <span>Filter by category</span>
            {selectedCategoryIds.length > 0 && (
              <span className="ml-1 text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                {selectedCategoryIds.length}
              </span>
            )}
          </button>
          {showFilters && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedCategoryIds.length > 0 && (
                <button
                  onClick={clearFilters}
                  className="px-2.5 py-1 text-xs font-medium rounded-full bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                >
                  Clear all
                </button>
              )}
              {categories.map(cat => {
                const isActive = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryToggle(cat.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-neutral-800 text-neutral-400 border border-transparent hover:text-white'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Calendar */}
      <ScheduleCalendar
        events={eventsByDate}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        onDateClick={handleDateClick}
        selectedDate={selectedDate}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 px-1">
        {(['target', 'forecast', 'milestone', 'completed'] as ScheduleEventType[]).map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${getEventTypeColor(type)}`} />
            <span className="text-xs text-neutral-500">{getEventTypeLabel(type)}</span>
          </div>
        ))}
      </div>

      {/* No Events in View */}
      {filteredEvents.length === 0 && (
        <div className="mt-6 text-center text-neutral-500 text-sm py-8">
          {selectedCategoryIds.length > 0
            ? 'No goal events for the selected categories. Try clearing the filter.'
            : 'No goal events to display. Add deadlines or track more progress to see forecasts.'}
        </div>
      )}

      {/* Selected Date Detail Panel */}
      {selectedDate && (
        <div className="mt-4 bg-neutral-800/40 border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Date Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <h4 className="text-sm font-semibold text-white">
              {format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
            </h4>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
              aria-label="Close date details"
            >
              <X size={14} />
            </button>
          </div>

          {/* Events */}
          {selectedDateEvents.length === 0 ? (
            <div className="px-4 py-6 text-center text-neutral-500 text-sm">
              No goal events on this date.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {EVENT_TYPE_ORDER.map(type => {
                const typeEvents = eventsByType.get(type);
                if (!typeEvents || typeEvents.length === 0) return null;
                return (
                  <div key={type} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${getEventTypeColor(type)}`} />
                      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                        {getEventTypeLabel(type)}s
                      </span>
                      <span className="text-xs text-neutral-600">{typeEvents.length}</span>
                    </div>
                    <div className="space-y-2">
                      {typeEvents.map((event, idx) => (
                        <div
                          key={`${event.goalId}-${event.eventType}-${idx}`}
                          className="flex items-start gap-3 group"
                        >
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => {
                                if (focusedGoalId === event.goalId) {
                                  setFocusedGoalId(null);
                                } else {
                                  setFocusedGoalId(event.goalId);
                                }
                              }}
                              className="text-sm font-medium text-neutral-200 hover:text-emerald-400 transition-colors text-left truncate block w-full"
                              title={`Focus on ${event.goalTitle}`}
                            >
                              {event.goalTitle}
                            </button>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs ${getStatusColor(event.status)}`}>
                                {getStatusLabel(event.status)}
                              </span>
                              {event.trendExplanation && (
                                <span className="text-xs text-neutral-600">
                                  &middot; {event.trendExplanation}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Progress indicator */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-16 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, event.progressPercent)}%` }}
                              />
                            </div>
                            <span className="text-xs text-neutral-500 w-8 text-right">
                              {event.progressPercent}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* View Goal Detail Link */}
          {selectedDateEvents.length > 0 && onViewGoal && (
            <div className="px-4 py-2 border-t border-white/[0.04]">
              {selectedDateEvents.length === 1 ? (
                <button
                  onClick={() => onViewGoal(selectedDateEvents[0].goalId)}
                  className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  View goal details
                </button>
              ) : (
                <span className="text-xs text-neutral-600">
                  Click a goal name to focus on it
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
