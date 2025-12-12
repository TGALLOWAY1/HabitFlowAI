import React, { useState, useEffect } from 'react';
import { HabitProvider, useHabitStore } from './store/HabitContext';
import { RoutineProvider } from './store/RoutineContext';
import { TaskProvider } from './context/TaskContext';
import { Layout } from './components/Layout';
import { CategoryTabs } from './components/CategoryTabs';
import { TrackerGrid } from './components/TrackerGrid';
import { AddHabitModal } from './components/AddHabitModal';
import { ProgressDashboard } from './components/ProgressDashboard';
import { RoutineList } from './components/RoutineList';
import { RoutineEditorModal } from './components/RoutineEditorModal';
import { RoutineRunnerModal } from './components/RoutineRunnerModal';
import { BarChart3, Calendar, ClipboardList, Target, Clock, BookOpenText, CheckSquare } from 'lucide-react';
import type { Routine, Habit } from './types';
import { GoalsPage } from './pages/goals/GoalsPage';
import { CreateGoalFlow } from './pages/goals/CreateGoalFlow';
import { GoalDetailPage } from './pages/goals/GoalDetailPage';
import { GoalCompletedPage } from './pages/goals/GoalCompletedPage';
import { WinArchivePage } from './pages/goals/WinArchivePage';
import { CalendarView } from './components/CalendarView';

import { JournalPage } from './pages/JournalPage';
import { TasksPage } from './pages/TasksPage';

// Simple router state
type AppRoute = 'tracker' | 'progress' | 'routines' | 'goals' | 'calendar' | 'wins' | 'journal' | 'tasks';

// Helper functions for URL syncing
function parseRouteFromLocation(location: Location): AppRoute {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");

  switch (view) {
    case "progress":
    case "routines": // Renamed from activities
    case "goals":
    case "wins":
    case "tracker":
    case "calendar":
    case "journal":
    case "tasks":
      return view as AppRoute;
    default:
      return "tracker"; // default view
  }
}

function buildUrlForRoute(route: AppRoute, params: Record<string, string> = {}): string {
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.set("view", route);

  // Clear any existing ID params to prevent leakage between views
  searchParams.delete("goalId");

  // Set new params
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, value);
  });

  return `${window.location.pathname}?${searchParams.toString()}`;
}

const HabitTrackerContent: React.FC = () => {
  const { categories, habits, logs, toggleHabit, updateLog, lastPersistenceError, clearPersistenceError } = useHabitStore();
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');

  // Set default category to "Physical Health" when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      const physicalHealthCategory = categories.find(cat =>
        cat.name.toLowerCase() === 'physical health'
      );
      if (physicalHealthCategory) {
        setActiveCategoryId(physicalHealthCategory.id);
      } else {
        // Fallback to first category if "Physical Health" doesn't exist
        setActiveCategoryId(categories[0].id);
      }
    }
  }, [categories, activeCategoryId]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // Initial State from URL
  const [view, setView] = useState<AppRoute>(() => parseRouteFromLocation(window.location));
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("goalId");
  });

  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [completedGoalId, setCompletedGoalId] = useState<string | null>(null);

  // Routine State
  const [routineEditorState, setRoutineEditorState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    routine?: Routine;
  }>({ isOpen: false, mode: 'create' });

  const [routineRunnerState, setRoutineRunnerState] = useState<{
    isOpen: boolean;
    routine?: Routine;
  }>({ isOpen: false });

  // Initialize URL if not present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("view")) {
      const initialRoute = parseRouteFromLocation(window.location);
      const url = buildUrlForRoute(initialRoute);
      window.history.replaceState({ view: initialRoute }, "", url);
    }
  }, []);

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

  const filteredHabits = habits.filter(h => h.categoryId === activeCategoryId && !h.archived);

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
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {view === 'tracker' ? 'Habits' : view === 'progress' ? 'Habit Tracking' : view === 'routines' ? 'Routines' : view === 'journal' ? 'Journal' : view === 'tasks' ? 'Tasks' : 'Goals'}
          </h2>
          <div className="flex items-center gap-2 bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => handleNavigate('tracker')}
              className={`p-2 rounded-md transition-colors ${view === 'tracker' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Habits Tracker"
            >
              <Calendar size={20} />
            </button>
            <button
              onClick={() => handleNavigate('tasks')}
              className={`p-2 rounded-md transition-colors ${view === 'tasks' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Tasks (Minimal)"
            >
              <CheckSquare size={20} />
            </button>
            <button
              onClick={() => handleNavigate('calendar')}
              className={`p-2 rounded-md transition-colors ${view === 'calendar' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Weekly Calendar"
            >
              <Clock size={20} />
            </button>
            <button
              onClick={() => handleNavigate('progress')}
              className={`p-2 rounded-md transition-colors ${view === 'progress' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Progress Dashboard"
            >
              <BarChart3 size={20} />
            </button>
            <button
              onClick={() => handleNavigate('routines')}
              className={`p-2 rounded-md transition-colors ${view === 'routines' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Routines"
            >
              <ClipboardList size={20} />
            </button>
            <button
              onClick={() => handleNavigate('goals')}
              className={`p-2 rounded-md transition-colors ${view === 'goals' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Goals"
            >
              <Target size={20} />
            </button>
            <button
              onClick={() => handleNavigate('journal')}
              className={`p-2 rounded-md transition-colors ${view === 'journal' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Journal"
            >
              <BookOpenText size={20} />
            </button>
          </div>
        </div>

        {view === 'tracker' && (
          <CategoryTabs
            categories={categories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
          />
        )}
      </div>

      {showCreateGoal ? (
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
          onAddBadge={() => {
            // Redirect to Win Archive after badge upload
            setCompletedGoalId(null);
            handleNavigate('wins');
          }}
          onViewGoalDetail={(goalId) => {
            setCompletedGoalId(null);
            handleNavigate('goals', { goalId });
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
        />
      ) : view === 'tracker' ? (
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
            setIsModalOpen(true);
          }}
          onRunRoutine={(routine) => setRoutineRunnerState({ isOpen: true, routine })}
        />
      ) : view === 'progress' ? (
        <ProgressDashboard
          onCreateGoal={() => setShowCreateGoal(true)}
          onViewGoal={(goalId) => {
            handleNavigate('goals', { goalId });
          }}
        />
      ) : view === 'routines' ? (
        <RoutineList
          onCreate={() => setRoutineEditorState({ isOpen: true, mode: 'create', routine: undefined })}
          onEdit={(routine) => setRoutineEditorState({ isOpen: true, mode: 'edit', routine })}
          onStart={(routine) => setRoutineRunnerState({ isOpen: true, routine })}
        />
      ) : view === 'calendar' ? (
        <CalendarView />
      ) : view === 'journal' ? (
        <JournalPage />
      ) : view === 'tasks' ? (
        <TasksPage />
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
      )}

      <AddHabitModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingHabit(null);
        }}
        categoryId={activeCategoryId}
        initialData={editingHabit}
      />

      <RoutineEditorModal
        isOpen={routineEditorState.isOpen}
        mode={routineEditorState.mode}
        initialRoutine={routineEditorState.routine}
        onClose={() => setRoutineEditorState({ ...routineEditorState, isOpen: false })}
      />

      <RoutineRunnerModal
        isOpen={routineRunnerState.isOpen}
        routine={routineRunnerState.routine}
        onClose={() => setRoutineRunnerState({ isOpen: false })}
      />
    </div>
  );
};

function App() {
  return (
    <HabitProvider>
      <RoutineProvider>
        <TaskProvider>
          <Layout>
            <HabitTrackerContent />
          </Layout>
        </TaskProvider>
      </RoutineProvider>
    </HabitProvider>
  );
}

export default App;
