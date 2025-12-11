import React, { useState, useEffect } from 'react';
import { HabitProvider, useHabitStore } from './store/HabitContext';
import { ActivityProvider } from './store/ActivityContext';
import { Layout } from './components/Layout';
import { CategoryTabs } from './components/CategoryTabs';
import { TrackerGrid } from './components/TrackerGrid';
import { AddHabitModal } from './components/AddHabitModal';
import { ProgressDashboard } from './components/ProgressDashboard';
import { ActivityList } from './components/ActivityList';
import { ActivityEditorModal } from './components/ActivityEditorModal';
import { ActivityRunnerModal } from './components/ActivityRunnerModal';
import { BarChart3, Calendar, ClipboardList, Target, Clock } from 'lucide-react';
import type { Activity, ActivityStep, Habit } from './types';
import { GoalsPage } from './pages/goals/GoalsPage';
import { CreateGoalFlow } from './pages/goals/CreateGoalFlow';
import { GoalDetailPage } from './pages/goals/GoalDetailPage';
import { GoalCompletedPage } from './pages/goals/GoalCompletedPage';
import { WinArchivePage } from './pages/goals/WinArchivePage';
import { CalendarView } from './components/CalendarView';

// Simple router state
type AppRoute = 'tracker' | 'progress' | 'activities' | 'goals' | 'calendar' | 'wins';

// Helper functions for URL syncing
function parseRouteFromLocation(location: Location): AppRoute {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");

  switch (view) {
    case "progress":
    case "activities":
    case "goals":
    case "wins":
    case "tracker":
    case "calendar":
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
  const [activityEditorState, setActivityEditorState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    activity?: Activity;
    prefillSteps?: ActivityStep[];
  }>({ isOpen: false, mode: 'create' });
  const [activityRunnerState, setActivityRunnerState] = useState<{
    isOpen: boolean;
    activity?: Activity;
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
            {view === 'tracker' ? 'Habits' : view === 'progress' ? 'Habit Tracking' : view === 'activities' ? 'Activities' : 'Goals'}
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
              onClick={() => handleNavigate('activities')}
              className={`p-2 rounded-md transition-colors ${view === 'activities' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Activities"
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
        />
      ) : view === 'progress' ? (
        <ProgressDashboard
          onCreateGoal={() => setShowCreateGoal(true)}
          onViewGoal={(goalId) => {
            handleNavigate('goals', { goalId });
          }}
        />
      ) : view === 'activities' ? (
        <ActivityList
          onCreate={() => setActivityEditorState({ isOpen: true, mode: 'create', activity: undefined })}
          onEdit={(activity) => setActivityEditorState({ isOpen: true, mode: 'edit', activity })}
          onCreateFromHabits={(prefillSteps) => setActivityEditorState({ isOpen: true, mode: 'create', activity: undefined, prefillSteps })}
          onStart={(activity) => setActivityRunnerState({ isOpen: true, activity })}
        />

        // ... (in HabitTrackerContent return)

      ) : view === 'calendar' ? (
        <CalendarView />
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

      <ActivityEditorModal
        isOpen={activityEditorState.isOpen}
        mode={activityEditorState.mode}
        initialActivity={activityEditorState.activity}
        prefillSteps={activityEditorState.prefillSteps}
        onClose={() => setActivityEditorState({ ...activityEditorState, isOpen: false })}
      />

      <ActivityRunnerModal
        isOpen={activityRunnerState.isOpen}
        activity={activityRunnerState.activity}
        onClose={() => setActivityRunnerState({ isOpen: false })}
      />
    </div>
  );
};

function App() {
  return (
    <HabitProvider>
      <ActivityProvider>
        <Layout>
          <HabitTrackerContent />
        </Layout>
      </ActivityProvider>
    </HabitProvider>
  );
}

export default App;
