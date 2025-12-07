import React, { useState } from 'react';
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
import { BarChart3, Calendar, ClipboardList, Target } from 'lucide-react';
import type { Activity, ActivityStep } from './types';
import { GoalsPage } from './pages/goals/GoalsPage';
import { CreateGoalFlow } from './pages/goals/CreateGoalFlow';

const HabitTrackerContent: React.FC = () => {
  const { categories, habits, logs, toggleHabit, updateLog } = useHabitStore();
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'tracker' | 'progress' | 'activities' | 'goals'>('tracker');
  const [showCreateGoal, setShowCreateGoal] = useState(false);
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

  const filteredHabits = habits.filter(h => h.categoryId === activeCategoryId && !h.archived);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {view === 'tracker' ? 'Habits' : view === 'progress' ? 'Habit Tracking' : view === 'activities' ? 'Activities' : 'Goals'}
          </h2>
          <div className="flex items-center gap-2 bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setView('tracker')}
              className={`p-2 rounded-md transition-colors ${view === 'tracker' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Habits Tracker"
            >
              <Calendar size={20} />
            </button>
            <button
              onClick={() => setView('progress')}
              className={`p-2 rounded-md transition-colors ${view === 'progress' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Progress Dashboard"
            >
              <BarChart3 size={20} />
            </button>
            <button
              onClick={() => setView('activities')}
              className={`p-2 rounded-md transition-colors ${view === 'activities' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="Activities"
            >
              <ClipboardList size={20} />
            </button>
            <button
              onClick={() => setView('goals')}
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
            setView('goals');
          }}
          onCancel={() => {
            setShowCreateGoal(false);
            setView('goals');
          }}
        />
      ) : view === 'tracker' ? (
        <TrackerGrid
          habits={filteredHabits}
          logs={logs}
          onToggle={toggleHabit}
          onUpdateValue={updateLog}
          onAddHabit={() => setIsModalOpen(true)}
        />
      ) : view === 'progress' ? (
        <ProgressDashboard />
      ) : view === 'activities' ? (
        <ActivityList
          onCreate={() => setActivityEditorState({ isOpen: true, mode: 'create', activity: undefined })}
          onEdit={(activity) => setActivityEditorState({ isOpen: true, mode: 'edit', activity })}
          onCreateFromHabits={(prefillSteps) => setActivityEditorState({ isOpen: true, mode: 'create', activity: undefined, prefillSteps })}
          onStart={(activity) => setActivityRunnerState({ isOpen: true, activity })}
        />
      ) : (
        <GoalsPage onCreateGoal={() => setShowCreateGoal(true)} />
      )}

      <AddHabitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categoryId={activeCategoryId}
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
