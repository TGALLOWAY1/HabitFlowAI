import React from 'react';
import { Sparkles, Calendar, CheckSquare, BookOpenText, Target, Check } from 'lucide-react';

interface SetupStep {
  title: string;
  description: string;
  examples: string[];
  icon: React.FC<{ size?: number; className?: string }>;
  completed: boolean;
  route: string;
}

interface SetupDashboardProps {
  hasHabits: boolean;
  hasTasks: boolean;
  hasJournalEntries: boolean;
  goalsCount: number;
  onNavigate: (route: string) => void;
}

export const SetupDashboard: React.FC<SetupDashboardProps> = ({
  hasHabits,
  hasTasks,
  hasJournalEntries,
  goalsCount,
  onNavigate,
}) => {
  const steps: SetupStep[] = [
    {
      title: 'Add your first habit',
      description: 'Start with something small you want to do most days.',
      examples: ['Drink water', '10-minute walk', 'Read 5 pages'],
      icon: Calendar,
      completed: hasHabits,
      route: 'tracker',
    },
    {
      title: 'Add one task for today',
      description: 'Capture something on your mind to get it off your plate.',
      examples: ['Email recruiter', 'Wash dishes', 'Schedule dentist'],
      icon: CheckSquare,
      completed: hasTasks,
      route: 'tasks',
    },
    {
      title: 'Choose a journal template',
      description: 'Pick a way to reflect — or just start writing.',
      examples: ['Free Write', 'Morning Reflection', 'Evening Review'],
      icon: BookOpenText,
      completed: hasJournalEntries,
      route: 'journal',
    },
    {
      title: 'Create your first goal',
      description: 'Give your habits direction with a meaningful outcome.',
      examples: ['Build consistency', 'Reach a milestone', 'Complete a project'],
      icon: Target,
      completed: goalsCount > 0,
      route: 'goals',
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const firstIncomplete = steps.find(s => !s.completed);

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Welcome Header */}
      <div className="text-center pt-4">
        <div className="w-12 h-12 mx-auto bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
          <Sparkles size={24} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to HabitFlow</h2>
        <p className="text-neutral-400 text-sm">
          Let's get you set up in a few quick steps.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex gap-1.5">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`w-8 h-1 rounded-full transition-colors ${
                step.completed ? 'bg-emerald-500' : 'bg-neutral-700'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-neutral-500 ml-2">{completedCount}/{steps.length}</span>
      </div>

      {/* Primary CTA */}
      {firstIncomplete && (
        <button
          onClick={() => onNavigate(firstIncomplete.route)}
          className="mx-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-emerald-500/20"
        >
          {completedCount === 0 ? 'Start Setup' : 'Continue Setup'}
        </button>
      )}

      {/* Setup Steps */}
      <div className="flex flex-col gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.route}
              onClick={() => onNavigate(step.route)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                step.completed
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-neutral-800/50 border-white/5 hover:border-white/10 hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  step.completed
                    ? 'bg-emerald-500/20'
                    : 'bg-neutral-700/50'
                }`}>
                  {step.completed ? (
                    <Check size={16} className="text-emerald-400" />
                  ) : (
                    <Icon size={16} className="text-neutral-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-medium mb-0.5 ${
                    step.completed ? 'text-emerald-300' : 'text-white'
                  }`}>
                    {step.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mb-2">
                    {step.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {step.examples.map((ex) => (
                      <span
                        key={ex}
                        className="px-2 py-0.5 text-[11px] text-neutral-500 bg-neutral-800/60 rounded-full border border-white/5"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* All done message */}
      {completedCount === steps.length && (
        <div className="text-center py-4">
          <p className="text-emerald-400 text-sm font-medium mb-1">You're all set!</p>
          <p className="text-neutral-500 text-xs">Your dashboard will fill in as you use HabitFlow.</p>
        </div>
      )}
    </div>
  );
};
