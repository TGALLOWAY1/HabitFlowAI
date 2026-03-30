import { Info } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const concepts = [
  {
    title: 'Habits',
    meaning: 'Small repeated actions that build consistency over time.',
    differs: 'Unlike tasks, habits are ongoing — they don\'t get "done."',
    example: 'Drink water, stretch for 5 minutes, practice Portuguese.',
  },
  {
    title: 'Goals',
    meaning: 'Outcomes or milestones your habits help create.',
    differs: 'Goals give your habits direction and purpose.',
    example: 'Run a 10K, improve sleep, become conversational in Portuguese.',
  },
  {
    title: 'Routines',
    meaning: 'Repeatable sequences that reduce friction.',
    differs: 'Routines group multiple actions into a single flow.',
    example: 'Morning reset, gym prep, evening shutdown.',
  },
  {
    title: 'Tasks',
    meaning: 'One-off or short-term obligations.',
    differs: 'Unlike habits, tasks are transient — do them and move on.',
    example: 'Call landlord, submit form, buy groceries.',
  },
  {
    title: 'Journal',
    meaning: 'Reflection, review, and self-observation.',
    differs: 'Journal is your space for introspection, not tracking.',
    example: 'Evening check-in, free write, weekly reflection.',
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
            {concepts.map((item) => (
              <div key={item.title} className="rounded-lg bg-neutral-800/50 border border-white/5 p-4">
                <h4 className="text-sm font-semibold text-white mb-1.5">{item.title}</h4>
                <p className="text-sm text-neutral-300 mb-1">{item.meaning}</p>
                <p className="text-xs text-neutral-500 mb-2">{item.differs}</p>
                <p className="text-xs text-neutral-500 italic">e.g. {item.example}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
