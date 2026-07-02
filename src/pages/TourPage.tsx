import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Compass,
  LayoutDashboard,
  Calendar,
  Target,
  ClipboardList,
  BookOpen,
  Route as RouteIcon,
  Sparkles,
  Brain,
  Wand2,
  GitCompareArrows,
  MoonStar,
  Settings as SettingsIcon,
  Map,
  Monitor,
  Smartphone,
  Play,
  CheckCircle2,
  FlaskConical,
  FileText,
} from 'lucide-react';

/**
 * Take a Tour — an interactive, guided walk through the real application.
 *
 * Instead of a static feature list, each stop pairs a short narrative (what
 * problem the area solves, how it fits the larger system, how you use it)
 * with a LIVE preview: an iframe running the actual app in read-only demo
 * mode (?demo=1&embed=1) against seeded data. The Desktop/Mobile toggle
 * resizes the preview viewport, so real Tailwind breakpoints and the real
 * mobile navigation render — not a scaled screenshot.
 *
 * Honesty rules (see FEATURE_AUDIT.md):
 * - Every step badge tells the truth: "Functional today" for shipped areas,
 *   "Beta" for the email-gated pages, and explicit callouts where the demo
 *   shows a sample AI report rather than a live Gemini generation.
 * - AI stops (Weekly Review, Journal Review, Wellbeing Insights, Routine
 *   Builder) are marked with `ai: true` and get a violet treatment so the
 *   AI layer is visible at a glance in the chip nav.
 * - Roadmap items never appear as features; the final stop links to the
 *   dedicated Roadmap page instead.
 */

// Routes the tour can send the user to — a subset of the app's AppRoute union.
type TourNavRoute = 'dashboard' | 'tracker' | 'routines' | 'goals' | 'journal' | 'tasks' | 'roadmap';

// The tour renders in two contexts:
//  - 'app':  inside the authenticated/demo app (CTAs jump into the app).
//  - 'auth': on the unauthenticated auth screen (CTAs point to sign up / demo).
type TourPageProps =
  | {
      mode?: 'app';
      onNavigate: (route: TourNavRoute, params?: Record<string, string>) => void;
      onOpenSettings: () => void;
      onBack: () => void;
    }
  | {
      mode: 'auth';
      onCreateAccount: () => void;
      onSignIn: () => void;
      onBack: () => void;
      onViewRoadmap: () => void;
    };

type BadgeTone = 'live' | 'beta' | 'roadmap' | 'ai';

interface TourStep {
  id: string;
  /** Short label for the step chip row. */
  navLabel: string;
  title: string;
  icon: React.FC<{ size?: number; className?: string }>;
  badge: { label: string; tone: BadgeTone };
  /** Narrative: problem → how it works → how it fits the system. */
  paragraphs: string[];
  /** Optional scannable specifics. */
  bullets?: string[];
  /** Interaction hint for the live preview. */
  tryIt?: string;
  /** Honesty callout rendered under the narrative. */
  callout?: string;
  /** App view the live preview shows; null = step has no preview. */
  preview: { route: string; params?: Record<string, string> } | null;
  /** AI-powered stop — gets the violet AI treatment in the chip nav and panel. */
  ai?: boolean;
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    navLabel: 'Welcome',
    title: 'This tour is the real app',
    icon: Compass,
    badge: { label: 'Live demo — read-only', tone: 'live' },
    paragraphs: [
      'HabitFlow is a full-stack habit system: habits, routines, goals, tasks, journaling, and wellbeing tracking in one place — with an AI layer woven through it. It’s built as a TypeScript monorepo: React 19 + Vite on the front, Express 5 + MongoDB behind it.',
      'What makes it different from a checkbox tracker is one architectural rule: entries are the single source of truth. Every streak, progress bar, correlation, and AI review is derived from raw entries at read time — there is no stored “completion state” that can drift out of sync. That same rule is what makes the AI trustworthy: it only ever reasons over facts the server computed from your entries.',
      'Four stops on this tour are AI features — look for the violet chips above:',
    ],
    bullets: [
      'Weekly AI Review — a grounded seven-section report on your week',
      'AI Journal Review — themes, stressors, and self-talk patterns from your own writing',
      'Wellbeing Insights — statistically computed correlations, narrated by AI',
      'AI Routine Builder — Quick/Standard/Deep routine variants drafted on demand',
    ],
    callout:
      'The panel beside this text is not a screenshot — it’s the actual application running read-only against ten weeks of seeded demo data. Click around at any stop.',
    tryIt: 'Toggle Desktop ↔ Mobile above the preview, then click anything inside it.',
    preview: { route: 'dashboard' },
  },
  {
    id: 'dashboard',
    navLabel: 'Dashboard',
    title: 'Dashboard — the day at a glance',
    icon: LayoutDashboard,
    badge: { label: 'Functional today', tone: 'live' },
    paragraphs: [
      'The problem it solves: tracking six domains usually means six screens. The dashboard compresses “how is today going?” into one view so the daily loop takes seconds, not minutes.',
      'It composes a daily habit completion ring, a wellbeing card (morning/evening check-in status plus health quick-actions), pinned goals with live progress, pinned routines with one-tap start, today’s tasks, and journal shortcuts that deep-link into the right tab.',
      'Everything on it is a derived view over the same entries you’ll see on the other stops — nothing here is separately stored, so it can never disagree with the detail pages.',
    ],
    tryIt: 'Open the Wellbeing card’s chevron for the 7-day overview, or tap a pinned routine.',
    preview: { route: 'dashboard' },
  },
  {
    id: 'habits',
    navLabel: 'Habits',
    title: 'Habits — entries are the truth',
    icon: Calendar,
    badge: { label: 'Functional today', tone: 'live' },
    paragraphs: [
      'The core loop. Habits are done/not-done or numeric (glasses, miles, hours), scheduled daily, on specific weekdays, or N-times-per-week. Each tap writes an immutable-style entry; streaks and heatmaps are recomputed from those entries on every read.',
      'Bundles group habits: a checklist bundle (like the demo’s Wind-Down Checklist) succeeds by a configurable rule — all, any, count, or percent — while choice bundles let you pick one alternative per day. Habits also link outward: to goals (completions become progress) and to routine steps (running a routine auto-logs them).',
    ],
    bullets: [
      'Grid, Today, and weekly Schedule views of the same data',
      'Color-coded categories with drag-and-drop ordering',
      'Archiving preserves full history; restore is one click',
    ],
    tryIt: 'Switch between Grid / Today / Schedule, and expand the Wind-Down Checklist bundle.',
    preview: { route: 'tracker' },
  },
  {
    id: 'ai-weekly',
    navLabel: 'Weekly Review',
    title: 'AI Weekly Review — grounded, not generated fluff',
    icon: Sparkles,
    badge: { label: 'AI · Functional today · BYOK', tone: 'ai' },
    ai: true,
    paragraphs: [
      'A week of tracking produces more data than anyone rereads. The Weekly Review (on the Habits page you just saw, below the grid) turns it into a report you’d actually read — without inventing anything.',
      'How it works: the server first aggregates the week into observed facts — per-habit days-logged vs. cadence, sleep and mood averages, journal counts, goal progress. Only those facts go to Gemini, with a schema-constrained prompt that separates facts from inferred patterns from suggestions and forbids fabricating data.',
      'The result has seven sections: Week at a Glance, Facts, Patterns (each with a low/medium/high confidence), Journal Themes, Wins, Areas for Attention, and Recommendations — plus honest Data Limitations when a week is too thin to conclude much. Every report is archived, so rereading history never spends an API call.',
    ],
    callout:
      'AI runs on your own free Gemini API key (BYOK) — the key lives in your browser, never on the server. The archived report in this demo was composed from the demo dataset’s real numbers so you can see the format; with a key configured, reviews generate live.',
    tryIt: 'On the Habits grid, scroll below the tracker and open the Weekly AI Review’s history (clock icon).',
    preview: { route: 'tracker' },
  },
  {
    id: 'goals',
    navLabel: 'Goals',
    title: 'Goals — outcomes derived from actions',
    icon: Target,
    badge: { label: 'Functional today', tone: 'live' },
    paragraphs: [
      'Habits answer “did I do the thing today?”; goals answer “is it adding up to anything?”. A goal links habits and derives its progress entirely from their entries — log 2.5 hours of deep work and the 150-hour goal moves by exactly that much.',
      'Because progress is derived, it’s self-correcting: fix a fat-fingered entry and the goal recomputes — even reopening a “completed” goal if the corrected data no longer earns it.',
      'Cumulative goals take milestones (the demo’s deep-work goal has crossed 25/50/75 hours). Goal tracks sequence goals — the demo’s Run 40 → 80 → 150 miles track advanced automatically when stage one completed, and each stage only counts miles from its own time window.',
    ],
    tryIt: 'Open “Log 150 hours of deep work” for the trend chart, then check the Achievements tab.',
    preview: { route: 'goals' },
  },
  {
    id: 'tasks',
    navLabel: 'Tasks',
    title: 'Tasks — one-off things with a finish line',
    icon: ClipboardList,
    badge: { label: 'Functional today', tone: 'live' },
    paragraphs: [
      '“Book the dentist” isn’t a habit, and forcing it into a recurring tracker pollutes your streaks. Tasks give one-off to-dos their own simple home: a Today list and an Inbox backlog, promote/demote between them, done, gone.',
      'It’s deliberately the simplest domain in the app — a counterweight that keeps the habit system honest about what recurring behavior actually is.',
    ],
    tryIt: 'Move an inbox task to Today with the arrow that appears on hover.',
    preview: { route: 'tasks' },
  },
  {
    id: 'journal',
    navLabel: 'Journal',
    title: 'Journal — reflection with structure when you want it',
    icon: BookOpen,
    badge: { label: 'Functional today', tone: 'live' },
    paragraphs: [
      'Numbers can’t tell you why a week felt hard. The journal captures that context: free-write when you just need to think, or 11 templates across six categories — each voiced by a persona like “The Strategic Coach” — when you want structure.',
      'Daily templates upsert by day (same template + same date updates the entry, so check-ins never duplicate), and 90 days of history is browsable and editable. Journal text also feeds the AI review on the next stop.',
    ],
    tryIt: 'Open Templates and preview “Morning Primer”, then browse History.',
    preview: { route: 'journal' },
  },
  {
    id: 'ai-journal',
    navLabel: 'Journal Review',
    title: 'AI Journal Review — themes, stressors, self-talk',
    icon: Brain,
    badge: { label: 'AI · Functional today · BYOK', tone: 'ai' },
    ai: true,
    paragraphs: [
      'Patterns in your own writing are the hardest to see from inside. The AI Journal Review reads a date range you choose (last 7/30 days or custom) and returns a structured reflection: Overview, Emotional Themes, Recurring Stressors, and Self-Talk Patterns — each backed by paraphrased evidence with a confidence level — plus Wins, Reflection Questions, and Suggested Next Steps.',
      'It’s deliberately bounded: grounded only in your entries, paraphrase instead of long quotes, no diagnoses or medical advice, and entries suggesting crisis surface a gentle support notice instead of AI counseling. A separate weekly Journal Summary lands as a dismissible banner and is saved into your history.',
    ],
    callout: 'Generated on demand with your own Gemini key; empty or sparse ranges get an honest low-data notice instead of invented themes.',
    tryIt: 'Open the AI Review tab in the Journal to see the range picker and the saved summary.',
    preview: { route: 'journal', params: { tab: 'review' } },
  },
  {
    id: 'routines',
    navLabel: 'Routines',
    title: 'Routines — doing the work vs. tracking it',
    icon: RouteIcon,
    badge: { label: 'Functional today', tone: 'live' },
    paragraphs: [
      'A habit records that you did something; a routine walks you through doing it. Routines are ordered steps with instructions, images, and countdown/stopwatch timers, executed in a guided runner with a progress bar.',
      'Variants let one routine flex to the day you’re having — the demo’s Morning Kickstart has a 10-minute Quick and a 25-minute Standard version. Steps link to habits, so finishing the runner auto-logs them: do the work once, tracking happens for free.',
      'Writing good variants is real work, though — which is exactly what the next stop’s AI does for you.',
    ],
    tryIt: 'Preview “Morning Kickstart” and compare its Quick vs Standard variants.',
    preview: { route: 'routines' },
  },
  {
    id: 'ai-routines',
    navLabel: 'Routine Builder',
    title: 'AI Routine Builder — variants drafted from your routine',
    icon: Wand2,
    badge: { label: 'AI · Functional today · BYOK', tone: 'ai' },
    ai: true,
    paragraphs: [
      'Variants are what make routines survive bad days, but writing three versions of every routine by hand is tedious. In the routine editor, one “Suggest with AI” click sends the routine’s title and existing steps to Gemini, which drafts Quick, Standard, and Deep variants scaled to different amounts of time and energy.',
      'The suggestions arrive as editable drafts — rename, retime, reorder, or delete steps before anything is saved; nothing is applied silently. And because variant steps keep their habit links, an AI-drafted routine plugs straight into the tracking system: run it and the entries log themselves.',
    ],
    callout:
      'BYOK like all AI here: suggestions run on your own free Gemini key, so the read-only demo can’t generate drafts live. The demo’s Morning Kickstart shows the end state — a routine with the kind of Quick/Standard variants the AI drafts for you.',
    tryIt: 'Preview “Morning Kickstart” and flip between its variants — the exact shape “Suggest with AI” produces.',
    preview: { route: 'routines' },
  },
  {
    id: 'insights',
    navLabel: 'Wellbeing',
    title: 'Wellbeing Insights — statistics before narrative',
    icon: GitCompareArrows,
    badge: { label: 'AI · Beta', tone: 'beta' },
    ai: true,
    paragraphs: [
      'Does the wind-down routine actually help? Wellbeing Insights answers with statistics computed server-side from canonical entries: it splits days by factor (habit done vs. not, medication taken vs. not), compares wellbeing outcomes with Cohen’s d effect sizes, and only surfaces relationships with at least 5 days per group and a meaningful effect.',
      'The AI Review tab then narrates those numbers into a readable wellbeing story — what’s helping, what’s holding you back, what to try. The AI is deliberately downstream of the statistics: it can only describe correlations the engine actually measured, so it can’t invent a pattern that isn’t in your data. Everything is framed as correlation — never causation.',
      'Alongside it: Overview, Correlations, Habits, Medications (with adherence), and Predictions (simple linear-trend projections per metric). The demo data contains a genuine pattern to find: wind-down evenings really do precede better sleep scores. The engine detects it because it’s in the data, not because it’s scripted.',
    ],
    callout: 'Beta: in production this page is email-gated while it stabilizes; the demo unlocks it read-only. Promoting it into primary navigation is on the roadmap.',
    tryIt: 'Open the Correlations tab and look for the wind-down ↔ sleep relationship.',
    preview: { route: 'wellbeing-history' },
  },
  {
    id: 'sleep',
    navLabel: 'Sleep',
    title: 'Sleep — consistency, independence, and causes',
    icon: MoonStar,
    badge: { label: 'Beta', tone: 'beta' },
    paragraphs: [
      'Sleep gets a dedicated analytics tab built around one question: am I becoming more consistent at sleeping well? Each morning check-in can log bedtime, wake time, duration, quality, a manually-entered Apple Watch sleep score, and whether a sleep aid was used.',
      'From those entries it derives headline metrics with trends, a consistency score (circular standard deviation of bed/wake clock times — rewarding regularity, not just duration), sleep-aid independence streaks, and charts against your configurable targets. Its correlation engine ranks behaviors — phone in bed, late caffeine, wind-down, any habit — by measured effect on sleep outcomes.',
    ],
    callout:
      'Beta: lives on the email-gated Analytics page (unlocked read-only in the demo). Apple Watch scores are entered manually today — automatic Apple Health sync exists but is allowlisted behind an external sync bridge, so the tour doesn’t present it as generally available.',
    tryIt: 'Open the Sleep tab on the Analytics page and check the consistency score.',
    preview: { route: 'analytics' },
  },
  {
    id: 'settings',
    navLabel: 'Settings',
    title: 'Settings — your keys, your data',
    icon: SettingsIcon,
    badge: { label: 'Functional today', tone: 'live' },
    paragraphs: [
      'Settings is small on purpose, but two choices in it define the product’s posture. First: AI is bring-your-own-key — you paste a free Gemini API key and it’s stored only in your browser’s localStorage, sent per-request, never persisted server-side. No key, no AI; everything else works without it.',
      'Second: data control. Archived habits can be reviewed and restored (nothing is hard-deleted behind your back — truth records soft-delete), the new-user setup guide can be reopened anytime, and Delete All Data is a real, permanent, confirmed wipe.',
    ],
    tryIt: 'Click the gear icon in the preview’s header to open Settings.',
    preview: { route: 'dashboard' },
  },
  {
    id: 'next',
    navLabel: 'What’s next',
    title: 'What exists, and what’s next',
    icon: Map,
    badge: { label: 'Roadmap', tone: 'roadmap' },
    paragraphs: [
      'Everything you just walked through is functional today — this tour ran inside the live product, and FEATURE_AUDIT.md in the repository keeps the implemented/partial/planned split honest.',
      'What doesn’t exist yet lives on one page, clearly labeled: shareable URLs, multi-user households, pluggable AI providers (Claude/OpenAI alongside Gemini), dictation journaling, native mobile wrappers, and more. Features never appear there and here at the same time — you should never have to wonder whether something is real.',
    ],
    preview: null,
  },
];

const badgeStyles: Record<BadgeTone, string> = {
  live: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  beta: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  roadmap: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  ai: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
};

/** Build the embedded-preview URL for a step. */
function previewSrc(step: TourStep): string {
  const params = new URLSearchParams({ demo: '1', embed: '1' });
  if (step.preview) {
    params.set('view', step.preview.route);
    Object.entries(step.preview.params ?? {}).forEach(([k, v]) => params.set(k, v));
  }
  return `/?${params.toString()}`;
}

export const TourPage: React.FC<TourPageProps> = (props) => {
  const isAuth = props.mode === 'auth';
  const [stepIndex, setStepIndex] = useState(0);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeLoadedRef = useRef(false);
  const step = STEPS[stepIndex];
  // Fixed initial src: step changes navigate the loaded app via postMessage —
  // changing src would reload the whole preview on every step.
  const initialPreviewSrc = useMemo(() => previewSrc(STEPS[0]), []);

  // Drive the (already loaded) embedded app to the current step's view.
  const postNavigate = (target: TourStep) => {
    if (!target.preview || !iframeLoadedRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'habitflow-demo-navigate', route: target.preview.route, params: target.preview.params ?? {} },
      window.location.origin
    );
  };

  useEffect(() => {
    postNavigate(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const goTo = (index: number) => {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, index)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const roadmapAction = () => {
    if (props.mode === 'auth') props.onViewRoadmap();
    else props.onNavigate('roadmap');
  };

  const StepIcon = step.icon;

  return (
    <div className={`mx-auto flex flex-col gap-6 pb-4 ${isAuth ? 'min-h-screen bg-neutral-900 text-white px-4 py-8 max-w-6xl' : 'max-w-6xl'}`}>
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={props.onBack}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {isAuth ? 'Back to sign in' : 'Back to Dashboard'}
        </button>
      </div>

      {/* Hero (kept tight so the tour starts immediately) */}
      <header className="text-center flex flex-col items-center gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
          Take a Tour of HabitFlow
        </h1>
        <p className="text-neutral-400 max-w-2xl text-sm leading-relaxed">
          {STEPS.length} short stops through the live product — about four minutes. Four of them
          are <span className="text-violet-300 font-semibold">AI features</span>: the Weekly AI
          Review, the AI Journal Review, Wellbeing Insights, and the AI Routine Builder — all
          grounded in your own data. The preview is the real app in read-only demo mode; explore
          it freely at every stop.
        </p>
      </header>

      {/* Step chips */}
      <nav aria-label="Tour steps" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {STEPS.map((s, i) => {
          const ChipIcon = s.icon;
          const active = i === stepIndex;
          return (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? s.ai
                    ? 'bg-violet-500/15 text-violet-200 border-violet-500/40'
                    : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                  : i < stepIndex
                    ? 'bg-neutral-800/80 text-neutral-300 border-white/10 hover:text-white'
                    : s.ai
                      ? 'bg-violet-500/5 text-violet-300/70 border-violet-500/20 hover:text-violet-200'
                      : 'bg-neutral-900/60 text-neutral-500 border-white/5 hover:text-neutral-300'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <ChipIcon size={13} aria-hidden="true" />
              {s.navLabel}
              {s.ai && (
                <span className="text-[9px] leading-none font-bold px-1 py-0.5 rounded bg-violet-500/20 text-violet-300">
                  AI
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Main: narrative + live preview */}
      <div className={`grid grid-cols-1 gap-6 ${step.preview ? 'lg:grid-cols-[minmax(320px,2fr),3fr]' : ''}`}>
        {/* Narrative panel */}
        <article className="bg-neutral-900/40 border border-white/5 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 h-fit">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                  step.ai
                    ? 'bg-gradient-to-br from-violet-400/20 to-fuchsia-500/20 border-violet-500/20'
                    : 'bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 border-emerald-500/20'
                }`}
              >
                <StepIcon size={20} className={step.ai ? 'text-violet-300' : 'text-emerald-300'} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">
                  Stop {stepIndex + 1} of {STEPS.length}
                </p>
                <h2 className="text-lg font-semibold text-white leading-snug">{step.title}</h2>
              </div>
            </div>
          </div>

          <span className={`self-start text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${badgeStyles[step.badge.tone]}`}>
            {step.badge.label}
          </span>

          <div className="flex flex-col gap-3">
            {step.paragraphs.map((p, i) => (
              <p key={i} className="text-sm text-neutral-300 leading-relaxed">{p}</p>
            ))}
          </div>

          {step.bullets && (
            <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
              {step.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-neutral-400">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>
          )}

          {step.tryIt && (
            <div className="bg-neutral-800/60 border border-white/5 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <Play size={14} className="text-cyan-300 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-neutral-300"><span className="font-semibold text-cyan-200">Try it:</span> {step.tryIt}</p>
            </div>
          )}

          {step.callout && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <FlaskConical size={14} className="text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-neutral-300">{step.callout}</p>
            </div>
          )}

          {step.id === 'next' && (
            <div className="flex flex-col gap-3 pt-1">
              <button
                onClick={roadmapAction}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-neutral-800 border border-white/10 text-neutral-200 font-semibold hover:bg-neutral-700 hover:text-white transition-colors"
              >
                <Map size={16} aria-hidden="true" />
                View the Roadmap
              </button>
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
                </>
              ) : (
                <button
                  onClick={() => props.onNavigate('dashboard')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Go to Dashboard
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
              <a
                href="https://github.com/TGALLOWAY1/HabitFlowAI/blob/main/FEATURE_AUDIT.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <FileText size={14} aria-hidden="true" />
                Read the full feature audit
              </a>
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
            {stepIndex < STEPS.length - 1 ? (
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

        {/* Live preview panel */}
        {step.preview && (
          <section aria-label="Live demo preview" className="flex flex-col gap-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-neutral-500">
                Live preview — the real app, read-only, on seeded demo data.
              </p>
              <div className="inline-flex rounded-full border border-white/10 bg-neutral-900 p-0.5" role="group" aria-label="Preview device">
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
            </div>

            <div className={device === 'mobile' ? 'flex justify-center' : ''}>
              <div
                className={
                  device === 'mobile'
                    ? 'w-[390px] max-w-full h-[700px] rounded-[2.2rem] border-[6px] border-neutral-700 bg-neutral-950 overflow-hidden shadow-2xl transition-all'
                    : 'w-full h-[640px] rounded-xl border border-white/10 bg-neutral-950 overflow-hidden shadow-2xl transition-all'
                }
              >
                {/* One persistent iframe: a real viewport at the chosen size, so
                    actual responsive breakpoints render. Step changes navigate
                    it via postMessage instead of reloading. */}
                <iframe
                  ref={iframeRef}
                  src={initialPreviewSrc}
                  title="HabitFlow live demo preview"
                  className="w-full h-full border-0"
                  onLoad={() => {
                    iframeLoadedRef.current = true;
                    postNavigate(step);
                  }}
                />
              </div>
            </div>
            <p className="text-[11px] text-neutral-600 text-center">
              Writes are disabled in the demo — the app will nudge you to create an account instead.
            </p>
          </section>
        )}
      </div>
    </div>
  );
};
