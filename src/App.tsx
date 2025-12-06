import React, { useState } from 'react';
import { HabitProvider, useHabitStore } from './store/HabitContext';
import { ActivityProvider } from './store/ActivityContext';
import { Layout } from './components/Layout';
import { CategoryTabs } from './components/CategoryTabs';
import { TrackerGrid } from './components/TrackerGrid';
import { AddHabitModal } from './components/AddHabitModal';
import { ProgressDashboard } from './components/ProgressDashboard';
import { ActivityList } from './components/ActivityList';
import { BarChart3, Calendar, ClipboardList } from 'lucide-react';
import type { Activity } from './types';

const HabitTrackerContent: React.FC = () => {
  const { categories, habits, logs, toggleHabit, updateLog } = useHabitStore();
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'tracker' | 'progress' | 'activities'>('tracker');
  const [activityEditorState, setActivityEditorState] = useState<{
    mode: 'create' | 'edit';
    activity: Activity | null;
  } | null>(null);

  const filteredHabits = habits.filter(h => h.categoryId === activeCategoryId && !h.archived);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {view === 'tracker' ? 'Habits' : view === 'progress' ? 'Habit Tracking' : 'Activities'}
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

      {view === 'tracker' ? (
        <TrackerGrid
          habits={filteredHabits}
          logs={logs}
          onToggle={toggleHabit}
          onUpdateValue={updateLog}
          onAddHabit={() => setIsModalOpen(true)}
        />
      ) : view === 'progress' ? (
        <ProgressDashboard />
      ) : (
        <ActivityList
          onCreate={() => setActivityEditorState({ mode: 'create', activity: null })}
          onEdit={(activity) => setActivityEditorState({ mode: 'edit', activity })}
        />
      )}

      <AddHabitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categoryId={activeCategoryId}
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
