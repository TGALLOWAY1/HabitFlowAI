import React, { useState, useEffect, useMemo } from 'react';
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

import { Plus, Trophy } from 'lucide-react';
import type { Routine, Habit } from './types';
import { GoalsPage } from './pages/goals/GoalsPage';
import { CreateGoalFlow } from './pages/goals/CreateGoalFlow';
import { GoalDetailPage } from './pages/goals/GoalDetailPage';
import { GoalCompletedPage } from './pages/goals/GoalCompletedPage';
import { WinArchivePage } from './pages/goals/WinArchivePage';
import { iterateGoal, createGoal, fetchGoal } from './lib/persistenceClient';
import { invalidateAllGoalCaches } from './lib/goalDataCache';
import { DayView } from './components/day-view/DayView';
import { WeeklyView } from './components/day-view/WeeklyView';

import { JournalPage } from './pages/JournalPage';
import { TasksPage } from './pages/TasksPage';
import { DebugEntriesPage } from './pages/DebugEntriesPage';
import { DevIdentityPanel } from './components/DevIdentityPanel';
import { WellbeingHistoryPage } from './pages/WellbeingHistoryPage';
import { DashboardPrefsProvider } from './store/DashboardPrefsContext';

// Simple router state
type AppRoute = 'tracker' | 'dashboard' | 'routines' | 'goals' | 'wins' | 'journal' | 'tasks' | 'day' | 'debug-entries' | 'wellbeing-history';


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
  const { categories, habits, logs, toggleHabit, updateLog, lastPersistenceError, clearPersistenceError, potentialEvidence } = useHabitStore();
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

  // Track View Mode: 'grid', 'day', or 'weekly' — default to 'day' for new users
  const [trackerViewMode, setTrackerViewMode] = useState<'grid' | 'day' | 'weekly'>(() =>
    habits.length === 0 ? 'day' : 'grid'
  );


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
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Navigation handler that updates state and browser history
  const handleNavigate = (route: AppRoute, params: Record<string, string> = {}) => {
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
        <div className={`flex flex-col gap-2 ${view === 'journal' ? 'hidden' : ''}`}>
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
              {view === 'goals' && (
                <>
                  <button
                    onClick={() => handleNavigate('wins')}
                    className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                    title="Win Archive"
                  >
                    <Trophy size={20} />
                  </button>
                  <button
                    onClick={() => setShowCreateGoal(true)}
                    className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-900 transition-colors"
                    title="Create Goal"
                  >
                    <Plus size={20} />
                  </button>
                </>
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

          {/* Tracker View Toggle — centered below title */}
          {view === 'tracker' && (
            <div className="flex justify-center">
              <div className="flex bg-neutral-800 p-0.5 rounded-lg">
                <button
                  onClick={() => setTrackerViewMode('grid')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${trackerViewMode === 'grid' ? 'bg-neutral-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setTrackerViewMode('day')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${trackerViewMode === 'day' ? 'bg-neutral-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                >
                  Today
                </button>
                <button
                  onClick={() => setTrackerViewMode('weekly')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${trackerViewMode === 'weekly' ? 'bg-neutral-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                >
                  Weekly
                </button>
              </div>
            </div>
          )}
        </div>
      </div>




      {
        view === 'tracker' && trackerViewMode === 'grid' && (
          <CategoryTabs
            categories={visibleCategories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
            uncategorized={uncategorizedCategory}
          />
        )
      }

      {
        view === 'tracker' && activeCategoryId && trackerViewMode === 'grid' && (
          <CategoryMomentumBanner
            categoryId={activeCategoryId}
            habits={filteredHabits}
            logs={logs}
          />
        )
      }

      {
        showCreateGoal ? (
          <CreateGoalFlow
            onComplete={() => {
              setShowCreateGoal(false);
              handleNavigate('goals');
            }}
            onCancel={() => {
              setShowCreateGoal(false);
              handleNavigate('goals');
            }}
          />
        ) : completedGoalId ? (
          <GoalCompletedPage
            goalId={completedGoalId}
            onBack={() => {
              setCompletedGoalId(null);
              handleNavigate('goals');
            }}
            onViewWinArchive={() => {
              setCompletedGoalId(null);
              handleNavigate('wins');
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
                invalidateAllGoalCaches();
                setCompletedGoalId(null);
                handleNavigate('goals');
              } catch (err) {
                console.error('Failed to repeat goal:', err);
              }
            }}
            onArchive={() => {
              setCompletedGoalId(null);
              handleNavigate('wins');
            }}
          />
        ) : view === 'wins' ? (
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
              handleNavigate('wins');
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
          trackerViewMode === 'grid' ? (
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
            />
          ) : trackerViewMode === 'weekly' ? (
            <WeeklyView />
          ) : (
            <DayView onAddHabit={() => setIsModalOpen(true)} />
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
              handleNavigate('wins');
            }}
          />
        )
      }

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
