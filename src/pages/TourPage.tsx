import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Compass,
  LayoutDashboard,
  Sparkles,
  Brain,
  GitCompareArrows,
  Cpu,
  Map,
  Monitor,
  Smartphone,
} from 'lucide-react';
import {
  DataFlowPanel,
  DashboardPreview,
  WeeklyReviewPreview,
  JournalIntelligencePreview,
  InsightsPreview,
  TechPanel,
  TourDeviceProvider,
  PhoneFrame,
  type TourDevice,
  type PhoneTabKey,
} from './tour/TourPreviews';

/**
 * Take a Tour — a curated product walkthrough built for a first-time
 * evaluator (a recruiter, a hiring manager) rather than a live demo.
 *
 * Six stops: value proposition → dashboard → AI Weekly Review → Journal
 * Intelligence → behavioral insights → how it's built. Each stop pairs a
 * short narrative with a static preview panel rendered from one curated,
 * deterministic sample dataset (`tour/tourContent.ts`).
 *
 * Honesty rules:
 * - No live API calls and no Gemini key involved — every AI panel carries
 *   an explicit "example output, prewritten from the sample data" label,
 *   and nothing implies live generation.
 * - The previews are labeled mockups of app views, not the running app.
 */

// Routes the tour can send the user to — a subset of the app's AppRoute union.
type TourNavRoute = 'dashboard' | 'roadmap';

// The tour renders in two contexts:
//  - 'app':  inside the authenticated app (final CTA returns to the dashboard).
//  - 'auth': on the unauthenticated auth screen (CTAs point to sign up / sign in).
type TourPageProps =
  | {
      mode?: 'app';
      onNavigate: (route: TourNavRoute, params?: Record<string, string>) => void;
      onBack: () => void;
    }
  | {
      mode: 'auth';
      onCreateAccount: () => void;
      onSignIn: () => void;
      onBack: () => void;
      onViewRoadmap: () => void;
    };

interface TourStep {
  id: string;
  /** Short label for the step chip row. */
  navLabel: string;
  title: string;
  icon: React.FC<{ size?: number; className?: string }>;
  /** True for the stops that showcase AI output examples. */
  aiStop?: boolean;
  /** Narrative paragraphs shown beside the preview panel. */
  paragraphs: string[];
  /** Static preview panel for this stop. */
  panel: React.FC;
  /**
   * Present on stops whose preview represents an app view. Enables the
   * Desktop/Mobile toggle; `mobileTab` highlights the matching item in the
   * phone frame's mock bottom tab bar.
   */
  appPreview?: { mobileTab?: PhoneTabKey };
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    navLabel: 'Welcome',
    title: 'One behavioral dataset. AI that reads it.',
    icon: Compass,
    paragraphs: [
      'HabitFlow unifies habits, routines, goals, tasks, journaling, and wellbeing check-ins into a single structured behavioral dataset. One architectural rule holds it together: entries are the only source of truth — every streak, progress bar, and correlation is derived from them at read time.',
      'That dataset is what makes the AI features work. Instead of generating generic advice, HabitFlow turns your actual week — what you did, how you slept, what you wrote — into grounded reflection, patterns, and recommendations.',
      'This tour walks through the product on one curated sample week. The AI stops show prewritten example outputs composed from that same data, clearly labeled — no API calls, no key required.',
    ],
    panel: DataFlowPanel,
  },
  {
    id: 'dashboard',
    navLabel: 'Dashboard',
    title: 'The day at a glance',
    icon: LayoutDashboard,
    paragraphs: [
      'The dashboard compresses “how is this week going?” into one view: the habit grid, wellbeing check-ins, goal progress, today’s tasks, pinned routines, and journal activity.',
      'Notice how the domains reference each other — deep-work hours feed the 150-hour goal, the wind-down routine auto-logs its habits, and mood tracks with run days. That cross-domain signal is exactly what the AI reads on the next three stops.',
      'The panel here is a preview rendered from the tour’s sample week: a user pushing toward a Q3 launch, strong on execution, slipping on sleep. Use the Desktop/Mobile toggle above it to see how the same view adapts to a phone — bottom tab bar included.',
    ],
    panel: DashboardPreview,
    appPreview: { mobileTab: 'dashboard' },
  },
  {
    id: 'ai-weekly',
    navLabel: 'Weekly Review',
    title: 'AI Weekly Review — the week, synthesized',
    icon: Sparkles,
    aiStop: true,
    paragraphs: [
      'A week of tracking produces more data than anyone rereads. The Weekly Review turns it into a report worth reading: it synthesizes habit completion, goal progress, journal entries, mood and energy, and blockers into wins, patterns, and concrete next steps.',
      'It’s engineered to be grounded, not generative fluff: the server first aggregates entries into observed facts, and a schema-constrained prompt separates those facts from inferred patterns (each with a confidence level) from suggestions — and forbids inventing data.',
      'The example beside this text was prewritten from the sample week on the previous stop. Read the Patterns section — every claim traces back to numbers you can see on the dashboard.',
    ],
    panel: WeeklyReviewPreview,
    appPreview: { mobileTab: 'habits' },
  },
  {
    id: 'ai-journal',
    navLabel: 'Journal AI',
    title: 'Journal Intelligence — structure from free-form text',
    icon: Brain,
    aiStop: true,
    paragraphs: [
      'Patterns in your own writing are the hardest to see from inside. HabitFlow uses an LLM to perform structured extraction on free-form journal entries: themes, stressors, blockers, goals you mentioned, and emotional patterns — each theme tagged with a confidence level and grounded in the entries.',
      'Below are three realistic sample entries and the example extraction composed from them. Note what the extraction catches that a keyword search wouldn’t: the presentation outline deferred across multiple entries, and frustration that is self-directed rather than situational.',
      'The real feature is deliberately bounded: paraphrase over long quotes, no diagnoses, and honest low-data notices when a range is too thin to analyze.',
    ],
    panel: JournalIntelligencePreview,
    appPreview: {},
  },
  {
    id: 'insights',
    navLabel: 'Insights',
    title: 'From daily activity to next steps',
    icon: GitCompareArrows,
    aiStop: true,
    paragraphs: [
      'The end of the pipeline: HabitFlow converts logged behavior into actionable guidance. Statistics come first — the server splits days by factor (wind-down done vs. not, run vs. rest) and compares outcomes, framing everything as correlation, never causation.',
      'AI then narrates those computed numbers into recommendations that are specific to the data: which habit to protect, which to leave alone, and which single blocker to schedule first.',
      'Each recommendation below cites the sample data it came from — that traceability is the design goal of every AI feature in the product.',
    ],
    panel: InsightsPreview,
    appPreview: {},
  },
  {
    id: 'built',
    navLabel: 'How it’s built',
    title: 'How it’s built',
    icon: Cpu,
    paragraphs: [
      'HabitFlow is a full-stack TypeScript application built and maintained as a production codebase: typed end to end, tested with Vitest and Supertest, CI on every push, and deployed with the frontend and API as separate services.',
      'The AI layer is a deliberate architecture, not a chatbot bolt-on: structured behavioral data in, schema-constrained Gemini prompts, typed review objects out — with the prompt engineering to keep outputs grounded in observed facts.',
    ],
    panel: TechPanel,
  },
];

export const TourPage: React.FC<TourPageProps> = (props) => {
  const isAuth = props.mode === 'auth';
  const [stepIndex, setStepIndex] = useState(0);
  const [device, setDevice] = useState<TourDevice>('desktop');
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  // The toggle only appears on stops that preview an app view; the choice
  // persists across stops so a mobile-curious reader stays in mobile.
  const showDeviceToggle = Boolean(step.appPreview);
  const isMobilePreview = showDeviceToggle && device === 'mobile';

  const goTo = (index: number) => {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, index)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const StepIcon = step.icon;
  const Panel = step.panel;

  return (
    <div
      className={`mx-auto flex flex-col gap-6 pb-8 ${
        isAuth ? 'min-h-screen bg-neutral-900 text-white px-4 py-8 max-w-5xl' : 'max-w-5xl'
      }`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={props.onBack}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {isAuth ? 'Back to sign in' : 'Back to Dashboard'}
        </button>
        <span className="text-xs text-neutral-600">
          Stop {stepIndex + 1} of {STEPS.length}
        </span>
      </div>

      {/* Hero (kept tight so the tour starts immediately) */}
      <header className="text-center flex flex-col items-center gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
          A Tour of HabitFlow
        </h1>
        <p className="text-neutral-400 max-w-2xl text-sm leading-relaxed">
          Six short stops — about two minutes. A curated walkthrough of the product and its AI
          features, on sample data. No account, no setup.
        </p>
      </header>

      {/* Step chips */}
      <nav aria-label="Tour steps" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:justify-center">
        {STEPS.map((s, i) => {
          const ChipIcon = s.icon;
          const active = i === stepIndex;
          return (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                  : i < stepIndex
                    ? 'bg-neutral-800/80 text-neutral-300 border-white/10 hover:text-white'
                    : 'bg-neutral-900/60 text-neutral-500 border-white/5 hover:text-neutral-300'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <ChipIcon size={13} aria-hidden="true" />
              {s.navLabel}
            </button>
          );
        })}
      </nav>

      {/* Main: narrative + curated preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,2fr),3fr] gap-6 items-start">
        {/* Narrative panel */}
        <article className="bg-neutral-900/40 border border-white/5 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <StepIcon size={20} className="text-emerald-300" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-white leading-snug">{step.title}</h2>
          </div>

          {step.aiStop && (
            <span className="self-start inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-300 border-violet-500/30">
              <Sparkles size={11} aria-hidden="true" />
              AI feature
            </span>
          )}

          <div className="flex flex-col gap-3">
            {step.paragraphs.map((p, i) => (
              <p key={i} className="text-sm text-neutral-300 leading-relaxed">
                {p}
              </p>
            ))}
          </div>

          {isLastStep && (
            <div className="flex flex-col gap-3 pt-1">
              {props.mode === 'auth' ? (
                <>
                  <button
                    onClick={props.onCreateAccount}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    Create an account
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  <button
                    onClick={props.onSignIn}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-neutral-800 border border-white/10 text-neutral-200 font-semibold hover:bg-neutral-700 hover:text-white transition-colors"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={props.onViewRoadmap}
                    className="inline-flex items-center justify-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <Map size={14} aria-hidden="true" />
                    See what’s on the roadmap
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => props.onNavigate('dashboard')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    Go to Dashboard
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => props.onNavigate('roadmap')}
                    className="inline-flex items-center justify-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <Map size={14} aria-hidden="true" />
                    See what’s on the roadmap
                  </button>
                </>
              )}
            </div>
          )}

          {/* Prev / Next */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <button
              onClick={() => goTo(stepIndex - 1)}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-neutral-300 bg-neutral-800 border border-white/10 hover:bg-neutral-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Back
            </button>
            {!isLastStep ? (
              <button
                onClick={() => goTo(stepIndex + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 transition-colors shadow-lg shadow-emerald-500/20"
              >
                Next stop
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <span className="text-xs text-neutral-500">End of tour</span>
            )}
          </div>
        </article>

        {/* Curated preview panel */}
        <section aria-label="Preview" className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-neutral-500">
              {step.aiStop
                ? 'Preview · example output from the sample dataset'
                : 'Preview · rendered from the sample dataset'}
            </p>
            {showDeviceToggle && (
              <div
                className="inline-flex rounded-full border border-white/10 bg-neutral-900 p-0.5"
                role="group"
                aria-label="Preview device"
              >
                <button
                  onClick={() => setDevice('desktop')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    device === 'desktop' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                  aria-pressed={device === 'desktop'}
                >
                  <Monitor size={13} aria-hidden="true" />
                  Desktop
                </button>
                <button
                  onClick={() => setDevice('mobile')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    device === 'mobile' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                  aria-pressed={device === 'mobile'}
                >
                  <Smartphone size={13} aria-hidden="true" />
                  Mobile
                </button>
              </div>
            )}
          </div>
          <TourDeviceProvider value={isMobilePreview ? 'mobile' : 'desktop'}>
            {isMobilePreview ? (
              <PhoneFrame activeTab={step.appPreview?.mobileTab}>
                <Panel />
              </PhoneFrame>
            ) : (
              <Panel />
            )}
          </TourDeviceProvider>
        </section>
      </div>
    </div>
  );
};
