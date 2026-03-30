import { Info } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Example = string | { title: string; steps: string[] };

const primaryItems: { term: string; definition: string; examples: Example[] }[] = [
  {
    term: 'Habit',
    definition: 'A habit is a repeated behavior performed over time. Habits are ongoing and never "finished" — each day or week, a habit is simply performed or not.',
    examples: [
      '"Practice Portuguese for 30 minutes"',
      '"Run for 20 minutes"',
    ],
  },
  {
    term: 'Routine',
    definition: 'A routine is a group of habits or actions performed together in a sequence. Completing a routine helps you perform multiple habits in one flow.',
    examples: [
      {
        title: '"Portuguese Study"',
        steps: ['Review flashcards', 'Make new flashcards', 'Say a new sentence'],
      },
      {
        title: '"Run Day"',
        steps: ['Warm-up stretch', 'Run for 20 minutes', 'Cool-down walk'],
      },
    ],
  },
  {
    term: 'Goal',
    definition: 'A goal is an outcome you are working toward over time. Goals are achieved by consistently performing the habits that support them.',
    examples: [
      '"Become conversational in Portuguese" — supported by: Practice Portuguese habit',
      '"Run a 10K" — supported by: Running habit',
    ],
  },
];

const secondaryItems = [
  {
    term: 'Task',
    badge: 'Dashboard only',
    definition: 'A task is a one-time action with a clear finish. Once completed, it\'s done.',
    examples: [
      '"Register for Portuguese exam"',
      '"Sign up for 10K race"',
    ],
  },
  {
    term: 'Journal',
    badge: 'Dashboard only',
    definition: 'The journal is for reflection and notes — not tracking.',
    examples: [
      '"I learned how to talk about food in Portuguese"',
      '"Ran 5K without stopping for the first time"',
    ],
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

          <div className="p-4 space-y-5">
            {/* The Rules */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2.5">
              <p className="text-xs text-emerald-400 uppercase tracking-wide font-semibold mb-1.5">The Rules</p>
              <ul className="space-y-0.5 text-sm text-neutral-300">
                <li>Habits are <span className="text-emerald-400 font-medium">performed</span></li>
                <li>Routines are <span className="text-emerald-400 font-medium">completed</span></li>
                <li>Goals are <span className="text-emerald-400 font-medium">achieved</span></li>
              </ul>
            </div>

            {/* Primary: Habits, Routines, Goals */}
            {primaryItems.map((item, i) => (
              <div key={item.term}>
                <div className="pl-3 border-l-2 border-emerald-500/40">
                  <p className="text-sm text-neutral-200">
                    <span className="font-bold text-emerald-400">{item.term}</span>
                  </p>
                  <p className="text-sm text-neutral-300 mt-1">{item.definition}</p>
                  <ul className="mt-2 space-y-1.5">
                    {item.examples.map((ex) =>
                      typeof ex === 'string' ? (
                        <li key={ex} className="text-xs text-neutral-400 italic pl-2">
                          — {ex}
                        </li>
                      ) : (
                        <li key={ex.title} className="pl-2">
                          <p className="text-xs text-neutral-400 italic">— {ex.title}</p>
                          <ol className="mt-1 space-y-0.5 pl-4">
                            {ex.steps.map((step, idx) => (
                              <li key={step} className="text-xs text-neutral-500">
                                {idx + 1}. {step}
                              </li>
                            ))}
                          </ol>
                        </li>
                      )
                    )}
                  </ul>
                </div>
                {i < primaryItems.length - 1 && (
                  <div className="border-b border-white/5 mt-5" />
                )}
              </div>
            ))}

            {/* Secondary divider */}
            <div className="pt-1">
              <p className="text-xs text-neutral-600 uppercase tracking-wide font-medium">Secondary</p>
            </div>

            {/* Secondary: Tasks, Journal */}
            {secondaryItems.map((item) => (
              <div key={item.term} className="pl-3 border-l-2 border-neutral-700/60 opacity-80">
                <p className="text-sm text-neutral-300">
                  <span className="font-semibold text-neutral-400">{item.term}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-wide bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">
                    {item.badge}
                  </span>
                </p>
                <p className="text-sm text-neutral-400 mt-1">{item.definition}</p>
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
