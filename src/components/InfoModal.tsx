import { Info } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const definitions = [
  {
    term: 'Habit',
    definition: 'A repeated action you do regularly to build consistency. Habits are ongoing — they never get "done."',
    examples: ['Drink water daily', 'Stretch for 5 minutes', 'Practice Portuguese'],
  },
  {
    term: 'Goal',
    definition: 'An outcome or milestone you\'re working toward. Goals give your habits direction and purpose.',
    examples: ['Run a 10K', 'Improve sleep quality', 'Become conversational in Portuguese'],
  },
  {
    term: 'Routine',
    definition: 'A sequence of actions grouped into a single repeatable flow. Routines reduce friction by chaining steps together.',
    examples: ['Morning reset', 'Gym prep', 'Evening shutdown'],
  },
  {
    term: 'Task',
    definition: 'A specific one-time action with a clear finish. Unlike habits, once it\'s done, it\'s done.',
    examples: ['Buy birthday cake for Saturday', 'Submit tax form', 'Schedule dentist appointment'],
  },
  {
    term: 'Journal',
    definition: 'A space for reflection and self-observation — not tracking. Write freely about how things are going.',
    examples: ['Evening check-in', 'Free write', 'Weekly reflection'],
  },
];

export function InfoModal({ isOpen, onClose }: InfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-0 overflow-y-auto modal-scroll p-4">
        <div
          className="relative bg-neutral-900 border border-white/10 rounded-xl shadow-xl max-w-sm w-full mx-auto my-8 sm:my-16"
          role="dialog"
          aria-labelledby="info-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info size={18} className="text-emerald-400" />
              <h2 id="info-title" className="text-lg font-semibold text-white">
                How HabitFlow Works
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Definitions</p>
            {definitions.map((item) => (
              <div key={item.term} className="pl-3 border-l-2 border-emerald-500/40">
                <p className="text-sm text-neutral-200">
                  <span className="font-bold text-emerald-400">{item.term}:</span>{' '}
                  {item.definition}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {item.examples.map((ex) => (
                    <li key={ex} className="text-xs text-neutral-500 italic pl-2">
                      — {ex}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
