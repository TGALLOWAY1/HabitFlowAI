import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { AuthProvider } from './store/AuthContext';
import { HabitProvider, useHabitStore } from './store/HabitContext';
import { RoutineProvider } from './store/RoutineContext';
import { TaskProvider } from './context/TaskContext';
import { ToastProvider } from './components/Toast';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { CategoryTabs } from './components/CategoryTabs';
import { TrackerGrid } from './components/TrackerGrid';
import { CategoryMomentumBanner } from './components/CategoryMomentumBanner';
import { AddHabitModal } from './components/AddHabitModal';
import { ProgressDashboard } from './components/ProgressDashboard';
import { RoutineList } from './components/RoutineList';
import { RoutineEditorModal } from './components/RoutineEditorModal';
import { RoutineRunnerModal } from './components/RoutineRunnerModal';
import { RoutinePreviewModal } from './components/RoutinePreviewModal';
import { HabitHistoryModal } from './components/HabitHistoryModal';
import { BottomTabBar } from './components/BottomTabBar';

import { Plus, List, CalendarDays, CalendarClock, Trophy } from 'lucide-react';
import type { Routine, Habit } from './types';
import { CreateGoalModal } from './components/CreateGoalModal';
import { iterateGoal, createGoal, fetchGoal } from './lib/persistenceClient';
import { DayView } from './components/day-view/DayView';
import { ScheduleView } from './components/day-view/ScheduleView';
import { DevIdentityPanel } from './components/DevIdentityPanel';
import { DashboardPrefsProvider } from './store/DashboardPrefsContext';

// Lazy-loaded pages — split into separate chunks for faster initial load
const GoalsPage = React.lazy(() => import('./pages/goals/GoalsPage').then(m => ({ default: m.GoalsPage })));
const GoalDetailPage = React.lazy(() => import('./pages/goals/GoalDetailPage').then(m => ({ default: m.GoalDetailPage })));
const GoalCompletedPage = React.lazy(() => import('./pages/goals/GoalCompletedPage').then(m => ({ default: m.GoalCompletedPage })));
const WinArchivePage = React.lazy(() => import('./pages/goals/WinArchivePage').then(m => ({ default: m.WinArchivePage })));
const GoalScheduleView = React.lazy(() => import('./pages/goals/GoalScheduleView').then(m => ({ default: m.GoalScheduleView })));
const JournalPage = React.lazy(() => import('./pages/JournalPage').then(m => ({ default: m.JournalPage })));
const TasksPage = React.lazy(() => import('./pages/TasksPage').then(m => ({ default: m.TasksPage })));
const DebugEntriesPage = React.lazy(() => import('./pages/DebugEntriesPage').then(m => ({ default: m.DebugEntriesPage })));
const WellbeingHistoryPage = React.lazy(() => import('./pages/WellbeingHistoryPage').then(m => ({ default: m.WellbeingHistoryPage })));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const AppleHealthPage = React.lazy(() => import('./pages/AppleHealthPage').then(m => ({ default: m.AppleHealthPage })));

// Simple router state
type AppRoute = 'tracker' | 'dashboard' | 'routines' | 'goals' | 'wins' | 'journal' | 'tasks' | 'day' | 'debug-entries' | 'wellbeing-history' | 'analytics' | 'health';


// Helper functions for URL syncing
function parseRouteFromLocation(location: Location): AppRoute {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");

  switch (view) {
    case "dashboard":
    case "progress": // Legacy support
    case "streak-dashboard":
    case "streaks":
      return "dashboard";
    case "routines":
      return "routines";
    case "goals":
      return "goals";
    case "daily":
      return "tracker";
    case "wins":
      return "wins";
    case "tracker":
      return "tracker";
    case "journal":
      return "journal";
    case "tasks":
      return "tasks";
    case "day":
      return "tracker"; // Redirect old 'day' view to tracker
    case "debug-entries":
      return "debug-entries";
    case "wellbeing-history":
      return "wellbeing-history";
    case "analytics":
      return "analytics";
    case "health":
      return "health";
    default:

      return "dashboard"; // default view
  }
}

function buildUrlForRoute(route: AppRoute, params: Record<string, string> = {}): string {
  const searchParams = new URLSearchParams(window.location.search);

  if (route === 'dashboard') {
    searchParams.delete("view");
  } else {
    searchParams.set("view", route);
  }

  // Clear any existing ID params to prevent leakage between views
  searchParams.delete("goalId");

  // Set new params
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, value);
  });

  const queryString = searchParams.toString();
  return queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
}

const HabitTrackerContent: React.FC = () => {
  const { categories, habits, logs, toggleHabit, updateLog, deleteHabit, lastPersistenceError, clearPersistenceError, potentialEvidence, loading } = useHabitStore();
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const UNCATEGORIZED_ID = '__uncategorized__';

  const noCategoryCategoryIds = useMemo(
    () => new Set(categories
      .filter(cat => cat.name.trim().toLowerCase() === 'no category')
      .map(cat => cat.id)),
    [categories]
  );

  const visibleCategories = useMemo(
    () => categories.filter(cat => !noCategoryCategoryIds.has(cat.id)),
    [categories, noCategoryCategoryIds]
  );

  const isUncategorizedHabit = React.useCallback((habit: Habit) => {
    return noCategoryCategoryIds.has(habit.categoryId) || !categories.some(c => c.id === habit.categoryId);
  }, [categories, noCategoryCategoryIds]);

  // Set default category to "Physical Health" when categories are loaded
  useEffect(() => {
    const activeExistsInVisible = visibleCategories.some(cat => cat.id === activeCategoryId);
    const activeIsUncategorized = activeCategoryId === UNCATEGORIZED_ID;

    if (activeCategoryId && (activeExistsInVisible || activeIsUncategorized)) {
      return;
    }

    if (visibleCategories.length > 0) {
      const physicalHealthCategory = visibleCategories.find(cat =>
        cat.name.toLowerCase() === 'physical health'
      );
      if (physicalHealthCategory) {
        setActiveCategoryId(physicalHealthCategory.id);
      } else {
        // Fallback to first category if "Physical Health" doesn't exist
        setActiveCategoryId(visibleCategories[0].id);
      }
    } else if (habits.some(h => !h.archived && isUncategorizedHabit(h))) {
      setActiveCategoryId(UNCATEGORIZED_ID);
    }
  }, [activeCategoryId, habits, isUncategorizedHabit, visibleCategories]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isBundleConvert, setIsBundleConvert] = useState(false);
  const [historyHabit, setHistoryHabit] = useState<Habit | null>(null);

  // Initial State from URL
  const [view, setView] = useState<AppRoute>(() => parseRouteFromLocation(window.location));
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("goalId");
  });

  // Track View Mode: 'all', 'day', or 'schedule' — default to 'day' for new users
  const [trackerViewMode, setTrackerViewMode] = useState<'all' | 'day' | 'schedule'>(() =>
    habits.length === 0 ? 'day' : 'all'
  );

  // Goals View Mode: 'all', 'schedule', or 'achievements'
  const [goalsViewMode, setGoalsViewMode] = useState<'all' | 'schedule' | 'achievements'>('all');


  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [completedGoalId, setCompletedGoalId] = useState<string | null>(null);

  // Routine State
  const [routineEditorState, setRoutineEditorState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    routine?: Routine;
    initialVariantId?: string;
  }>({ isOpen: false, mode: 'create' });

  const [routineRunnerState, setRoutineRunnerState] = useState<{
    isOpen: boolean;
    routine?: Routine;
    variantId?: string;
  }>({ isOpen: false });

  const [routinePreviewState, setRoutinePreviewState] = useState<{
    isOpen: boolean;
    routine?: Routine;
  }>({ isOpen: false });


  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteFromLocation(window.location);
      const params = new URLSearchParams(window.location.search);
      setView(route);
      setSelectedGoalId(params.get("goalId"));
      setShowCreateGoal(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Navigation handler that updates state and browser history
  const handleNavigate = (route: AppRoute, params: Record<string, string> = {}) => {
    setShowCreateGoal(false);
    setView(route);

    // Update ephemeral state based on route
    if (params.goalId) {
      setSelectedGoalId(params.goalId);
    } else if (route !== 'goals') {
      // Clear selected goal if navigating away or back to main list
      setSelectedGoalId(null);
    } else if (route === 'goals' && !params.goalId) {
      // Explicitly clearing goal ID when going back to goal list
      setSelectedGoalId(null);
    }

    const url = buildUrlForRoute(route, params);
    window.history.pushState({ view: route, ...params }, "", url);
  };

  // Detect habits that are uncategorized either by missing category linkage
  // or by the backend-managed "No Category" bucket.
  const categoryIds = useMemo(() => new Set(categories.map(c => c.id)), [categories]);
  const hasUncategorized = useMemo(
    () => habits.some(h => !h.archived && (noCategoryCategoryIds.has(h.categoryId) || !categoryIds.has(h.categoryId))),
    [habits, categoryIds, noCategoryCategoryIds]
  );

  const uncategorizedCategory = useMemo(
    () => hasUncategorized ? { id: UNCATEGORIZED_ID, name: 'Uncategorized', color: 'bg-amber-600' } : null,
    [hasUncategorized]
  );

  const filteredHabits = habits.filter(h => {
    if (h.archived) return false;
    if (activeCategoryId === UNCATEGORIZED_ID) {
      return noCategoryCategoryIds.has(h.categoryId) || !categoryIds.has(h.categoryId);
    }
    return h.categoryId === activeCategoryId;
  });

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Error Banner */}
      {lastPersistenceError && (
        <div className="p-3 mb-2 text-sm text-red-100 bg-red-600/90 border border-red-500/50 rounded-lg flex items-center justify-between shadow-lg backdrop-blur-sm">
          <span>{lastPersistenceError}</span>
          <button
            type="button"
            className="ml-4 px-3 py-1 text-red-100 hover:text-white hover:bg-red-700/50 rounded transition-colors font-medium"
            onClick={clearPersistenceError}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Title Section */}
        <div className={`flex flex-col gap-2 ${view === 'journal' || view === 'analytics' ? 'hidden' : ''}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              {view === 'tracker' ? 'Habits' : view === 'dashboard' ? 'Dashboard' : view === 'routines' ? 'Routines' : view === 'tasks' ? 'Tasks' : 'Goals'}
            </h2>

            <div className="flex items-center gap-3">
              {view === 'tracker' && (
                <button
                  onClick={() => { setEditingHabit(null); setIsModalOpen(true); }}
                  className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-900 transition-colors"
                  title="Add Habit"
                >
                  <Plus size={20} />
                </button>
              )}
              {view === 'goals' && !selectedGoalId && (
                <button
                  onClick={() => setShowCreateGoal(true)}
                  className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-900 transition-colors"
                  title="Create Goal"
                >
                  <Plus size={20} />
                </button>
              )}
              {view === 'routines' && (
                <button
                  onClick={() => setRoutineEditorState({ isOpen: true, mode: 'create', routine: undefined })}
                  className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-900 transition-colors"
                  title="New Routine"
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Goals View Toggle — centered below title */}
          {view === 'goals' && !selectedGoalId && !completedGoalId && (
            <div className="flex gap-4 border-b border-white/5">
              {([
                { id: 'all' as const, label: 'All', icon: List },
                { id: 'schedule' as const, label: 'Schedule', icon: CalendarClock },
                { id: 'achievements' as const, label: 'Achievements', icon: Trophy },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setGoalsViewMode(id)}
                  className={`pb-3 px-3 text-sm font-medium transition-colors relative ${goalsViewMode === id ? 'text-emerald-400' : 'text-white/40 hover:text-white/60'}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    {label}
                  </div>
                  {goalsViewMode === id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Tracker View Toggle — centered below title */}
          {view === 'tracker' && (
            <div className="flex gap-4 border-b border-white/5">
              {([
                { id: 'all' as const, label: 'All', icon: List },
                { id: 'day' as const, label: 'Today', icon: CalendarDays },
                { id: 'schedule' as const, label: 'Schedule', icon: CalendarClock },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTrackerViewMode(id)}
                  className={`pb-3 px-3 text-sm font-medium transition-colors relative ${trackerViewMode === id ? 'text-emerald-400' : 'text-white/40 hover:text-white/60'}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    {label}
                  </div>
                  {trackerViewMode === id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>




      {
        view === 'tracker' && trackerViewMode === 'all' && (
          <CategoryTabs
            categories={visibleCategories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
            uncategorized={uncategorizedCategory}
          />
        )
      }

      {
        view === 'tracker' && activeCategoryId && trackerViewMode === 'all' && (
          <CategoryMomentumBanner
            categoryId={activeCategoryId}
            habits={filteredHabits}
            logs={logs}
          />
        )
      }

      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>}>
      {
        completedGoalId ? (
          <GoalCompletedPage
            goalId={completedGoalId}
            onBack={() => {
              setCompletedGoalId(null);
              handleNavigate('goals');
            }}
            onViewWinArchive={() => {
              setCompletedGoalId(null);
              setGoalsViewMode('achievements');
              handleNavigate('goals');
            }}
            onViewGoalDetail={(goalId) => {
              setCompletedGoalId(null);
              handleNavigate('goals', { goalId });
            }}
            onLevelUp={async (goalId) => {
              try {
                const result = await iterateGoal(goalId);
                setCompletedGoalId(null);
                if (result.iteratedGoal) {
                  handleNavigate('goals', { goalId: result.iteratedGoal.id });
                } else {
                  handleNavigate('goals');
                }
              } catch (err) {
                console.error('Failed to level up goal:', err);
              }
            }}
            onRepeat={async (goalId) => {
              try {
                const original = await fetchGoal(goalId);
                const { id, createdAt, completedAt, sortOrder, ...goalData } = original;
                await createGoal(goalData);
                setCompletedGoalId(null);
                handleNavigate('goals');
              } catch (err) {
                console.error('Failed to repeat goal:', err);
              }
            }}
            onArchive={() => {
              setCompletedGoalId(null);
              setGoalsViewMode('achievements');
              handleNavigate('goals');
            }}
          />
        ) : view === 'wins' ? (
          // Legacy wins route: show achievements tab within goals
          <WinArchivePage
            onViewGoal={(goalId) => {
              handleNavigate('goals', { goalId });
            }}
          />
        ) : selectedGoalId ? (
          <GoalDetailPage
            goalId={selectedGoalId}
            onBack={() => {
              handleNavigate('goals');
            }}
            onNavigateToCompleted={(goalId) => {
              // First clear selected goal so we don't render detail page
              setSelectedGoalId(null);
              setCompletedGoalId(goalId);
              handleNavigate('goals');
            }}
            onViewWinArchive={() => {
              setGoalsViewMode('achievements');
              handleNavigate('goals');
            }}
            onViewHabit={(habitId) => {
              const habit = habits.find(h => h.id === habitId);
              if (habit) {
                setHistoryHabit(habit);
              }
            }}
            onViewGoal={(goalId) => {
              handleNavigate('goals', { goalId });
            }}
          />
        ) : view === 'tracker' ? (
          trackerViewMode === 'all' ? (
            <TrackerGrid
              habits={filteredHabits}
              logs={logs}
              onToggle={toggleHabit}
              onUpdateValue={updateLog}
              onAddHabit={() => {
                setEditingHabit(null);
                setIsModalOpen(true);
              }}
              onEditHabit={(habit) => {
                setEditingHabit(habit);
                setIsBundleConvert(false);
                setIsModalOpen(true);
              }}
              onConvertToBundle={(habit) => {
                setEditingHabit(habit);
                setIsBundleConvert(true);
                setIsModalOpen(true);
              }}
              onRunRoutine={(routine) => setRoutineRunnerState({ isOpen: true, routine })}
              onViewHistory={(habit) => setHistoryHabit(habit)}
              potentialEvidence={potentialEvidence}
              loading={loading}
            />
          ) : trackerViewMode === 'schedule' ? (
            <ScheduleView />
          ) : (
            <DayView
              onAddHabit={() => setIsModalOpen(true)}
              onEditHabit={(habit) => {
                setEditingHabit(habit);
                setIsBundleConvert(false);
                setIsModalOpen(true);
              }}
              onViewHistory={(habit) => setHistoryHabit(habit)}
              onDeleteHabit={deleteHabit}
            />
          )
        ) : view === 'dashboard' ? (
          <ProgressDashboard
            onCreateGoal={() => setShowCreateGoal(true)}
            onViewGoal={(goalId) => {
              handleNavigate('goals', { goalId });
            }}
            onSelectCategory={(categoryId) => {
              setActiveCategoryId(categoryId);
              handleNavigate('tracker');
            }}
            onNavigateWellbeingHistory={() => handleNavigate('wellbeing-history')}
            onStartRoutine={(routine) => setRoutineRunnerState({ isOpen: true, routine, variantId: routine.defaultVariantId })}
            onPreviewRoutine={(routine) => setRoutinePreviewState({ isOpen: true, routine })}
            onNavigateToJournal={() => handleNavigate('journal')}
            onNavigateToRoutines={() => handleNavigate('routines')}
            onNavigateToTasks={() => handleNavigate('tasks')}
            onNavigate={(route) => handleNavigate(route as AppRoute)}
          />
        ) : view === 'wellbeing-history' ? (
          <WellbeingHistoryPage onBack={() => handleNavigate('dashboard')} />
        ) : view === 'routines' ? (
          <RoutineList
            onCreate={() => setRoutineEditorState({ isOpen: true, mode: 'create', routine: undefined })}
            onEdit={(routine) => setRoutineEditorState({ isOpen: true, mode: 'edit', routine })}
            onStart={(routine) => setRoutineRunnerState({ isOpen: true, routine, variantId: routine.defaultVariantId })}
            onPreview={(routine) => setRoutinePreviewState({ isOpen: true, routine })}
          />
        ) : view === 'journal' ? (
          <JournalPage />
        ) : view === 'tasks' ? (
          <TasksPage />
        ) : view === 'debug-entries' ? (
          <DebugEntriesPage />
        ) : view === 'analytics' ? (
          <AnalyticsPage onBack={() => handleNavigate('dashboard')} />
        ) : view === 'health' ? (
          <AppleHealthPage onBack={() => handleNavigate('dashboard')} />
        ) : goalsViewMode === 'schedule' ? (
          <GoalScheduleView
            onViewGoal={(goalId) => {
              handleNavigate('goals', { goalId });
            }}
          />
        ) : goalsViewMode === 'achievements' ? (
          <WinArchivePage
            onViewGoal={(goalId) => {
              handleNavigate('goals', { goalId });
            }}
          />
        ) : (
          <GoalsPage
            onCreateGoal={() => setShowCreateGoal(true)}
            onViewGoal={(goalId) => {
              handleNavigate('goals', { goalId });
            }}
            onNavigateToCompleted={(goalId) => {
              setCompletedGoalId(goalId);
              handleNavigate('goals');
            }}
            onViewWinArchive={() => {
              setGoalsViewMode('achievements');
            }}
          />
        )
      }
      </Suspense>

      <AddHabitModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingHabit(null);
          setIsBundleConvert(false);
        }}
        categoryId={activeCategoryId}
        initialData={editingHabit}
        initialBundleConvert={isBundleConvert}
        onNavigate={(route) => handleNavigate(route as AppRoute)}
      />

      {
        historyHabit && (
          <HabitHistoryModal
            habitId={historyHabit.id}
            onClose={() => setHistoryHabit(null)}
          />
        )
      }

      <RoutineEditorModal
        isOpen={routineEditorState.isOpen}
        mode={routineEditorState.mode}
        initialRoutine={routineEditorState.routine}
        initialVariantId={routineEditorState.initialVariantId}
        onClose={() => setRoutineEditorState({ ...routineEditorState, isOpen: false })}
      />

      <RoutineRunnerModal
        isOpen={routineRunnerState.isOpen}
        routine={routineRunnerState.routine}
        variantId={routineRunnerState.variantId}
        onClose={() => setRoutineRunnerState({ isOpen: false })}
      />

      <RoutinePreviewModal
        isOpen={routinePreviewState.isOpen}
        routine={routinePreviewState.routine}
        onClose={() => setRoutinePreviewState({ isOpen: false, routine: undefined })}
        onStart={(routine, variantId) => {
          setRoutinePreviewState({ isOpen: false, routine: undefined });
          setRoutineRunnerState({ isOpen: true, routine, variantId });
        }}
        onEdit={(routine, variantId) => {
          setRoutinePreviewState({ isOpen: false, routine: undefined });
          setRoutineEditorState({ isOpen: true, mode: 'edit', routine, initialVariantId: variantId });
        }}
      />

      <CreateGoalModal
        isOpen={showCreateGoal}
        onClose={() => setShowCreateGoal(false)}
      />

      <BottomTabBar activeView={view} onNavigate={handleNavigate} />
    </div >
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate>
          <ToastProvider>
            <HabitProvider>
              <RoutineProvider>
                <TaskProvider>
                  <DashboardPrefsProvider>
                    <Layout>
                      <HabitTrackerContent />
                    </Layout>
                    {import.meta.env.DEV && <DevIdentityPanel />}
                  </DashboardPrefsProvider>
                </TaskProvider>
              </RoutineProvider>
            </HabitProvider>
          </ToastProvider>
        </AuthGate>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
