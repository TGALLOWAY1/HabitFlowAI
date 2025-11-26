import React, { useState } from 'react';
import { HabitProvider, useHabitStore } from './store/HabitContext';
import { Layout } from './components/Layout';
import { CategoryTabs } from './components/CategoryTabs';
import { TrackerGrid } from './components/TrackerGrid';
import { AddHabitModal } from './components/AddHabitModal';
import { ProgressDashboard } from './components/ProgressDashboard';
import { BarChart3, Calendar } from 'lucide-react';

const HabitTrackerContent: React.FC = () => {
  const { categories, habits, logs, toggleHabit, updateLog } = useHabitStore();
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'tracker' | 'progress'>('tracker');

  const filteredHabits = habits.filter(h => h.categoryId === activeCategoryId && !h.archived);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">My Habits</h2>
          <div className="flex items-center gap-2 bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setView('tracker')}
              className={`p-2 rounded-md transition-colors ${view === 'tracker' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              <Calendar size={20} />
            </button>
            <button
              onClick={() => setView('progress')}
              className={`p-2 rounded-md transition-colors ${view === 'progress' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              <BarChart3 size={20} />
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
      ) : (
        <ProgressDashboard />
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
      <Layout>
        <HabitTrackerContent />
      </Layout>
    </HabitProvider>
  );
}

export default App;
