import { useState } from 'react';
import { Info, BookOpen, Sparkles, CheckCircle2, Calculator, CheckSquare, Layers, Target, CalendarCheck, Brain, Activity, Trophy } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Example = string | { title: string; steps: string[] };

const primaryItems: { term: string; definition: string; trackingTypes?: boolean; examples: Example[] }[] = [
  {
    term: 'Habit',
    definition: 'A habit is a repeated behavior performed over time. Habits are ongoing and never "finished" — each day or week, a habit is simply performed or not.',
    trackingTypes: true,
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

function renderExamples(examples: Example[]) {
  if (examples.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {examples.map((ex) =>
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
  );
}

export function InfoModal({ isOpen, onClose }: InfoModalProps) {
  const [activeTab, setActiveTab] = useState<'basics' | 'advanced' | 'ai' | 'health'>('basics');

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

          {/* Tab bar */}
          <div className="flex gap-3 px-4 pt-4 border-b border-white/5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('basics')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'basics'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
            >
              <BookOpen size={14} className={activeTab === 'basics' ? 'text-emerald-400' : ''} />
              Basics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('advanced')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'advanced'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
            >
              <Sparkles size={14} className={activeTab === 'advanced' ? 'text-emerald-400' : ''} />
              Advanced
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'ai'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
            >
              <Brain size={14} className={activeTab === 'ai' ? 'text-emerald-400' : ''} />
              AI
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'health'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
            >
              <Activity size={14} className={activeTab === 'health' ? 'text-emerald-400' : ''} />
              Health
              <span className="text-[9px] uppercase tracking-wide bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded font-semibold">Beta</span>
            </button>
          </div>

          {/* Basics tab */}
          {activeTab === 'basics' && (
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
                    {item.trackingTypes && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Tracking types</p>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 pl-2">
                          <CheckCircle2 size={13} className="text-blue-400 shrink-0" />
                          <span><span className="font-semibold text-blue-400">Done (Y/N)</span> — Simply mark as performed or not</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 pl-2">
                          <Calculator size={13} className="text-amber-400 shrink-0" />
                          <span><span className="font-semibold text-amber-400">Quantity</span> — Track a numeric value (e.g., minutes, reps, pages)</span>
                        </div>
                      </div>
                    )}
                    {renderExamples(item.examples)}
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

              {/* Link to advanced tab */}
              <div className="pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setActiveTab('advanced')}
                  className="text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
                >
                  Learn about bundles, linking, and more →
                </button>
              </div>
            </div>
          )}

          {/* Advanced tab */}
          {activeTab === 'advanced' && (
            <div className="p-4 space-y-5">

              {/* Habit Bundles */}
              <div className="pl-3 border-l-2 border-emerald-500/40">
                <p className="text-sm text-neutral-200">
                  <span className="font-bold text-emerald-400">Habit Bundles</span>
                </p>
                <p className="text-sm text-neutral-300 mt-1">A bundle groups multiple habits together. Two types:</p>

                {/* Checklist: definition then example */}
                <div className="mt-2.5 space-y-1">
                  <div className="text-xs text-neutral-400 pl-2 flex items-start gap-1.5">
                    <CheckSquare size={13} className="text-indigo-400 mt-0.5 shrink-0" />
                    <span><span className="font-bold text-indigo-400">Checklist Bundle</span> — Complete a set of habits as a group. Configure how many must be done: all, any, a specific count, or a percentage.</span>
                  </div>
                  <div className="pl-2">
                    <p className="text-xs text-neutral-400 italic pl-5">— Checklist: "Morning Health"</p>
                    <ol className="mt-1 space-y-0.5 pl-9">
                      <li className="text-xs text-neutral-500">1. Take vitamins</li>
                      <li className="text-xs text-neutral-500">2. Drink water</li>
                      <li className="text-xs text-neutral-500">3. Stretch — success rule: complete all 3</li>
                    </ol>
                  </div>
                </div>

                {/* Choice: definition then example */}
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-neutral-400 pl-2 flex items-start gap-1.5">
                    <Layers size={13} className="text-amber-400 mt-0.5 shrink-0" />
                    <span><span className="font-bold text-amber-400">Choice Bundle</span> — Pick one option from a set of alternatives each day. Only one needs to be performed.</span>
                  </div>
                  <div className="pl-2">
                    <p className="text-xs text-neutral-400 italic pl-5">— Choice: "Cardio"</p>
                    <ol className="mt-1 space-y-0.5 pl-9">
                      <li className="text-xs text-neutral-500">1. Run, Cycle, or Swim — perform whichever suits the day</li>
                    </ol>
                  </div>
                </div>

                {/* Note about moving habits into bundles */}
                <div className="mt-3 bg-neutral-800/50 rounded-lg px-2.5 py-2 text-xs text-neutral-400">
                  <p className="font-medium text-neutral-300 mb-1">Managing bundles</p>
                  <ul className="space-y-0.5">
                    <li>- You can move an existing habit into a checklist or choice bundle</li>
                    <li>- You can remove a habit from a bundle (end or archive the membership)</li>
                    <li>- Converting a habit into a bundle is one-way — a bundle cannot be converted back to a regular habit</li>
                  </ul>
                </div>
              </div>

              <div className="border-b border-white/5" />

              {/* Linking */}
              <div className="pl-3 border-l-2 border-emerald-500/40">
                <p className="text-sm text-neutral-200">
                  <span className="font-bold text-emerald-400">Linking</span>
                </p>
                <p className="text-sm text-neutral-300 mt-1">Connect habits to goals and routines for automatic progress tracking.</p>
                <ul className="mt-1.5 space-y-1">
                  <li className="text-xs text-neutral-400 pl-2">- Habit-Goal Link — When you perform a linked habit, it counts as evidence toward your goal&apos;s progress.</li>
                  <li className="text-xs text-neutral-400 pl-2">- Habit-Routine Link — When you complete a routine, its linked habits are automatically marked as performed.</li>
                </ul>
                <div className="flex items-center gap-1.5 mt-2 pl-2 text-xs text-neutral-500">
                  <Trophy size={12} className="text-amber-500 shrink-0" />
                  <span className="italic">Habits linked to a goal display this icon in the tracker.</span>
                </div>
                {renderExamples(['"Run for 20 minutes" linked to "Run a 10K" goal — every run updates your goal progress automatically'])}
              </div>

              <div className="border-b border-white/5" />

              {/* Routine Variants */}
              <div className="pl-3 border-l-2 border-emerald-500/40">
                <p className="text-sm text-neutral-200">
                  <span className="font-bold text-emerald-400">Routine Variants</span>
                </p>
                <p className="text-sm text-neutral-300 mt-1">Create multiple versions of the same routine for different situations — like Quick, Standard, and Deep versions. Each variant has its own steps, duration, and linked habits.</p>
                {renderExamples([{ title: '"Portuguese Study" variants:', steps: ['Quick (10 min) — Review flashcards', 'Standard (30 min) — Flashcards + practice sentences + podcast', 'Deep (60 min) — All of the above + write in Portuguese'] }])}
              </div>

              <div className="border-b border-white/5" />

              {/* Wellbeing Check-ins */}
              <div className="pl-3 border-l-2 border-emerald-500/40">
                <p className="text-sm text-neutral-200">
                  <span className="font-bold text-emerald-400">Wellbeing Check-ins</span>
                </p>
                <p className="text-sm text-neutral-300 mt-1">Track how you feel with morning and evening check-ins. Rate subjective metrics like mood, energy, stress, focus, and sleep quality on simple scales.</p>
                {renderExamples(['"Morning: rate sleep quality, energy, readiness"', '"Evening: rate stress, satisfaction, focus for the day"'])}
              </div>

              <div className="border-b border-white/5" />

              {/* Goal Types */}
              <div className="pl-3 border-l-2 border-emerald-500/40">
                <p className="text-sm text-neutral-200">
                  <span className="font-bold text-emerald-400">Goal Types</span>
                </p>
                <p className="text-sm text-neutral-300 mt-1">Two types of goals to match different objectives:</p>
                <ul className="mt-1.5 space-y-1.5">
                  <li className="text-xs text-neutral-400 pl-2 flex items-start gap-1.5">
                    <Target size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span><span className="font-semibold text-emerald-400">Cumulative</span> — Track total progress toward a target number (e.g., "Run 100 miles").</span>
                  </li>
                  <li className="text-xs text-neutral-400 pl-2 flex items-start gap-1.5">
                    <CalendarCheck size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span><span className="font-semibold text-emerald-400">One-time</span> — A binary milestone to achieve (e.g., "Pass the Portuguese B2 exam").</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* AI tab */}
          {activeTab === 'ai' && (
            <div className="p-4 space-y-5">
              <div className="pl-3 border-l-2 border-emerald-500/40">
                <p className="text-sm text-neutral-200">
                  <span className="font-bold text-emerald-400">AI Features</span>
                </p>
                <p className="text-sm text-neutral-300 mt-1">AI-powered tools to enhance your experience (uses your own API key):</p>
                <ul className="mt-2 space-y-2">
                  <li className="text-xs text-neutral-400 pl-2">
                    <span className="font-semibold text-neutral-300">Variant Suggestions</span>
                    <p className="mt-0.5">AI analyzes your routine and suggests Quick/Standard/Deep variants with full step lists.</p>
                  </li>
                  <li className="text-xs text-neutral-400 pl-2">
                    <span className="font-semibold text-neutral-300">Journal Summaries</span>
                    <p className="mt-0.5">Get AI-generated summaries of your journal entries.</p>
                  </li>
                  <li className="text-xs text-neutral-400 pl-2">
                    <span className="font-semibold text-neutral-300">Persona-Driven Insights</span>
                    <p className="mt-0.5">Choose an AI persona (like "The Strategic Coach") to guide your journaling prompts.</p>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Health tab */}
          {activeTab === 'health' && (
            <div className="p-4 space-y-5">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5">
                <p className="text-xs text-amber-400 uppercase tracking-wide font-semibold">Beta Feature</p>
                <p className="text-xs text-neutral-400 mt-1">Apple Health integration is currently available to select users.</p>
              </div>

              <div className="pl-3 border-l-2 border-emerald-500/40">
                <p className="text-sm text-neutral-200">
                  <span className="font-bold text-emerald-400">Apple Health Integration</span>
                </p>
                <p className="text-sm text-neutral-300 mt-1">Sync health data from Apple Health to automatically track habits based on real-world activity.</p>

                <ul className="mt-2 space-y-2">
                  <li className="text-xs text-neutral-400 pl-2">
                    <span className="font-semibold text-neutral-300">Getting Started</span>
                    <p className="mt-0.5">Go to Settings &rarr; Apple Health to connect metrics and create health-tracked habits from a dedicated page.</p>
                  </li>
                  <li className="text-xs text-neutral-400 pl-2">
                    <span className="font-semibold text-neutral-300">Supported Metrics</span>
                    <p className="mt-0.5">Steps, active calories, sleep hours, workout minutes, and weight.</p>
                  </li>
                  <li className="text-xs text-neutral-400 pl-2">
                    <span className="font-semibold text-neutral-300">Health Rules</span>
                    <p className="mt-0.5">Define rules that auto-log habits when health data meets a threshold (e.g., auto-log "Walk" when steps exceed 8,000).</p>
                  </li>
                  <li className="text-xs text-neutral-400 pl-2">
                    <span className="font-semibold text-neutral-300">Suggestions</span>
                    <p className="mt-0.5">Receive suggestions to log habits based on your health data. Accept or dismiss each suggestion.</p>
                  </li>
                  <li className="text-xs text-neutral-400 pl-2">
                    <span className="font-semibold text-neutral-300">Auto-Logged Entries</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Activity size={11} className="text-emerald-500/70 shrink-0" />
                      <span>Entries from Apple Health are marked with this icon in the tracker.</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
