import React from 'react';
import {
  Sparkles,
  Brain,
  BookOpen,
  Wand2,
  Target,
  Calendar,
  Route as RouteIcon,
  ClipboardList,
  HeartPulse,
  Compass,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Mic,
  Users,
  KeyRound,
  MessageSquareText,
  LineChart,
  ScrollText,
  Clock,
} from 'lucide-react';

// Routes the tour can send the user to — a subset of the app's AppRoute union.
type TourNavRoute = 'dashboard' | 'tracker' | 'routines' | 'goals' | 'journal';

// The tour renders in two contexts:
//  - 'app':  inside the authenticated app (CTAs jump into the app; opens Settings).
//  - 'auth': on the unauthenticated auth screen (CTAs point to sign up / sign in).
type TourPageProps =
  | {
      mode?: 'app';
      onNavigate: (route: TourNavRoute) => void;
      onOpenSettings: () => void;
      onBack: () => void;
    }
  | {
      mode: 'auth';
      onCreateAccount: () => void;
      onSignIn: () => void;
      onBack: () => void;
    };

interface Feature {
  icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  description: string;
}

interface RoadmapFeature extends Feature {
  status: 'Planned' | 'Exploring';
}

// What HabitFlow lets you track — a quick orientation for new users.
const CORE_FEATURES: Feature[] = [
  {
    icon: Calendar,
    title: 'Habits',
    description:
      'Track daily behaviors — done/not-done or a numeric quantity — with flexible scheduling, categories, streaks, and bundles.',
  },
  {
    icon: RouteIcon,
    title: 'Routines',
    description:
      'Build multi-step routines with Quick, Standard, and Deep variants, step timers, and a guided runner that auto-logs linked habits.',
  },
  {
    icon: Target,
    title: 'Goals',
    description:
      'Set cumulative or one-time goals with milestones and trends. Link habits so completions count as progress toward the goal.',
  },
  {
    icon: BookOpen,
    title: 'Journal',
    description:
      'Free-write or use persona-driven templates. Entries feed AI summaries and reviews that surface themes over time.',
  },
  {
    icon: HeartPulse,
    title: 'Wellbeing',
    description:
      'Log morning and evening check-ins, sleep, mood, and medication. Insights correlate wellbeing with your habits.',
  },
  {
    icon: ClipboardList,
    title: 'Tasks',
    description:
      'Capture one-off to-dos in Today and Inbox lists — a clear finish line separate from recurring habits.',
  },
];

// AI features that are shipped and usable today (Gemini BYOK).
const AI_NOW: Feature[] = [
  {
    icon: Sparkles,
    title: 'Weekly AI Review',
    description:
      'A comprehensive weekly report on the Habits page. It reads your real habit, sleep, mood, journal, and goal data and returns a Week at a Glance narrative, Facts, Patterns (with confidence levels), Journal Themes, Wins, Areas for Attention, and Recommendations — plus honest Data Limitations when a week is thin.',
  },
  {
    icon: LineChart,
    title: 'Insights AI Review',
    description:
      'On the Insights page, turn your computed correlations and trend predictions into a plain-language narrative: a Summary, Key Findings, Patterns, an Outlook, and Recommendations. Everything is framed as correlation, never cause and effect.',
  },
  {
    icon: Brain,
    title: 'AI Journal Review',
    description:
      'Pick a date range and generate a structured, grounded review of your entries: Overview, Emotional Themes, Recurring Stressors, Wins, Self-Talk Patterns, Reflection Questions, and Suggested Next Steps. Supportive and non-clinical — no diagnoses.',
  },
  {
    icon: MessageSquareText,
    title: 'Journal Summaries',
    description:
      'An auto-generated weekly summary of your journal entries — themes, highlights, and actionable feedback — shown as a dismissible banner and saved to your journal history.',
  },
  {
    icon: Wand2,
    title: 'AI Variant Suggestions',
    description:
      'While building a routine, let AI analyze your title and steps to suggest Quick, Standard, and Deep variants with full step lists.',
  },
  {
    icon: ScrollText,
    title: 'Persona-Driven Journaling',
    description:
      'Choose an AI persona (like "The Strategic Coach") to shape your journaling prompts with a specific tone and perspective.',
  },
  {
    icon: Clock,
    title: 'AI Report History',
    description:
      'Every Weekly AI Review and Journal Summary is saved to a browsable archive. Reopen or delete past reports by date — reading history never spends another API call.',
  },
];

// AI features on the roadmap — see ROADMAP.md for the source of truth.
const AI_ROADMAP: RoadmapFeature[] = [
  {
    icon: KeyRound,
    title: 'Pluggable AI Providers',
    status: 'Planned',
    description:
      'Bring your own Anthropic (Claude) or OpenAI key alongside the current Gemini integration, so you can pick the model that fits you.',
  },
  {
    icon: ScrollText,
    title: 'Journal Questionnaire Templates',
    status: 'Planned',
    description:
      'Guided check-ins built from reusable prompt sets — structured reflection that goes beyond today’s persona templates.',
  },
  {
    icon: Mic,
    title: 'Dictation Journal Mode',
    status: 'Planned',
    description:
      'A voice-first journaling workflow so you can capture reflections by speaking instead of typing.',
  },
  {
    icon: Users,
    title: 'Persona Switching UX',
    status: 'Exploring',
    description:
      'A smoother way to switch between coaching personas across the app, tuning the voice of your AI guidance.',
  },
  {
    icon: Compass,
    title: 'Identity Prompts & Coaching',
    status: 'Exploring',
    description:
      'Deeper, identity-based coaching that connects your habits to who you want to become, grounded in psychological-safety principles.',
  },
];

const statusStyles: Record<RoadmapFeature['status'], string> = {
  Planned: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Exploring: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

export const TourPage: React.FC<TourPageProps> = (props) => {
  const isAuth = props.mode === 'auth';
  return (
    <div className={`max-w-4xl mx-auto flex flex-col gap-10 pb-4 ${isAuth ? 'min-h-screen bg-neutral-900 text-white px-4 py-8' : ''}`}>
      {/* Back link */}
      <button
        onClick={props.onBack}
        className="self-start inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors -mb-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {isAuth ? 'Back to sign in' : 'Back to Dashboard'}
      </button>

      {/* Hero */}
      <header className="text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Compass size={28} className="text-white" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
          Take a Tour of HabitFlow
        </h1>
        <p className="text-neutral-300 max-w-2xl text-base leading-relaxed">
          HabitFlow helps you build better routines by tracking habits, goals, journaling, and
          wellbeing in one place — then turns your own data into grounded, AI-powered insight. Here's a
          quick tour of what you can do today and what's coming next.
        </p>
      </header>

      {/* What you can track */}
      <section aria-labelledby="tour-core-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="tour-core-heading" className="text-xl font-semibold text-white">
            What you can track
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Six connected domains — everything is derived from a single source of truth, so your views
            always stay in sync.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CORE_FEATURES.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <Icon size={18} className="text-emerald-400 shrink-0" aria-hidden="true" />
                <h3 className="font-semibold text-white">{title}</h3>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* AI features — available now */}
      <section aria-labelledby="tour-ai-now-heading" className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 id="tour-ai-now-heading" className="text-xl font-semibold text-white">
              AI features — available now
            </h2>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            Every AI feature reads only your real data and keeps facts, patterns, and suggestions
            separate — if the data is thin, it says so instead of inventing patterns. They run on your
            own Gemini API key (BYOK), which stays in your browser and is never stored on our servers.
          </p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0">
          {AI_NOW.map(({ icon: Icon, title, description }) => (
            <li
              key={title}
              className="bg-neutral-900/40 border border-emerald-500/15 rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <Icon size={18} className="text-emerald-400 shrink-0" aria-hidden="true" />
                <h3 className="font-semibold text-white">{title}</h3>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
            </li>
          ))}
        </ul>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-4 py-3 flex items-start gap-2">
          <KeyRound size={16} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          {props.mode === 'auth' ? (
            <p className="text-sm text-neutral-300">
              After you create an account, add a free Gemini API key in Settings to enable AI
              features. Your key is stored only in your browser — never on our servers.
            </p>
          ) : (
            <p className="text-sm text-neutral-300">
              To enable AI features, add a free Gemini API key in{' '}
              <button
                onClick={props.onOpenSettings}
                className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200 transition-colors"
              >
                Settings
              </button>
              . Your key is stored only in your browser.
            </p>
          )}
        </div>
      </section>

      {/* AI features — on the roadmap */}
      <section aria-labelledby="tour-ai-roadmap-heading" className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Rocket size={20} className="text-amber-400 shrink-0" aria-hidden="true" />
            <h2 id="tour-ai-roadmap-heading" className="text-xl font-semibold text-white">
              AI features — on the roadmap
            </h2>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            What we're building next. Planned items are committed; exploring items are directions we're
            still investigating.
          </p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0">
          {AI_ROADMAP.map(({ icon: Icon, title, description, status }) => (
            <li
              key={title}
              className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={18} className="text-neutral-300 shrink-0" aria-hidden="true" />
                  <h3 className="font-semibold text-white truncate">{title}</h3>
                </div>
                <span
                  className={`shrink-0 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${statusStyles[status]}`}
                >
                  {status}
                </span>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Call to action */}
      <section aria-labelledby="tour-cta-heading" className="flex flex-col gap-4">
        <h2 id="tour-cta-heading" className="text-xl font-semibold text-white text-center">
          Ready to dive in?
        </h2>
        {props.mode === 'auth' ? (
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={props.onCreateAccount}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 transition-colors shadow-lg shadow-emerald-500/20"
            >
              Create an account
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button
              onClick={props.onSignIn}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-800 border border-white/10 text-neutral-200 font-semibold hover:bg-neutral-700 hover:text-white transition-colors"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => props.onNavigate('dashboard')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 transition-colors shadow-lg shadow-emerald-500/20"
            >
              Go to Dashboard
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button
              onClick={() => props.onNavigate('tracker')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-800 border border-white/10 text-neutral-200 font-semibold hover:bg-neutral-700 hover:text-white transition-colors"
            >
              <Calendar size={16} aria-hidden="true" />
              Track Habits
            </button>
            <button
              onClick={() => props.onNavigate('journal')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-800 border border-white/10 text-neutral-200 font-semibold hover:bg-neutral-700 hover:text-white transition-colors"
            >
              <BookOpen size={16} aria-hidden="true" />
              Open Journal
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
