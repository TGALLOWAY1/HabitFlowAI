/**
 * Static preview panels for the public tour.
 *
 * Each panel renders the curated sample dataset from `tourContent.ts` in the
 * app's visual language (dark neutral surfaces, emerald/cyan accents). They
 * are deliberately self-contained mockups: no contexts, no API calls, no
 * state beyond what a panel needs to render. AI panels carry an explicit
 * "example output" label so the tour never implies live generation.
 */

import React from 'react';
import {
  Sparkles,
  Brain,
  BookOpen,
  Calendar,
  Target,
  ClipboardList,
  Route as RouteIcon,
  HeartPulse,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Circle,
  Lightbulb,
  ArrowRight,
  Database,
  Check,
  Minus,
  X,
  LayoutGrid,
  LayoutDashboard,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  WEEK_DAYS,
  SAMPLE_HABITS,
  SAMPLE_GOALS,
  SAMPLE_TASKS,
  SAMPLE_WELLBEING,
  SAMPLE_ROUTINE,
  SAMPLE_JOURNAL_ENTRIES,
  WEEKLY_REVIEW_EXAMPLE,
  JOURNAL_EXTRACTION_EXAMPLE,
  INSIGHT_EXAMPLES,
  RECOMMENDATION_EXAMPLES,
  TECH_FACTS,
  type Confidence,
} from './tourContent';

// ---------------------------------------------------------------------------
// Device context — lets the tour render the same panels as the desktop or
// mobile layout. Tailwind breakpoints react to the viewport, not a container,
// so the phone-framed mobile preview forces single-column layouts via this
// context instead of relying on `sm:` classes.
// ---------------------------------------------------------------------------

export type TourDevice = 'desktop' | 'mobile';

const TourDeviceContext = React.createContext<TourDevice>('desktop');
export const TourDeviceProvider = TourDeviceContext.Provider;
const useTourDevice = () => React.useContext(TourDeviceContext);

const PHONE_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'habits', label: 'Habits', icon: Calendar },
  { key: 'routines', label: 'Routines', icon: RouteIcon },
  { key: 'goals', label: 'Goals', icon: Target },
] as const;

export type PhoneTabKey = (typeof PHONE_TABS)[number]['key'];

/**
 * Phone bezel with the app's mobile chrome (header + bottom tab bar),
 * mirroring the real mobile layout's navigation so the preview reads as
 * "the app on a phone" rather than a squeezed desktop panel.
 */
export const PhoneFrame: React.FC<{ activeTab?: PhoneTabKey; children: React.ReactNode }> = ({
  activeTab,
  children,
}) => (
  <div className="mx-auto w-[390px] max-w-full rounded-[2.2rem] border-[6px] border-neutral-700 bg-neutral-950 overflow-hidden shadow-2xl">
    <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
          <LayoutGrid size={11} className="text-white" aria-hidden="true" />
        </div>
        <span className="text-xs font-bold text-white">HabitFlow</span>
      </div>
      <SettingsIcon size={13} className="text-neutral-500" aria-hidden="true" />
    </div>
    <div className="h-[540px] overflow-y-auto bg-neutral-900 p-3">{children}</div>
    <div className="grid grid-cols-4 bg-neutral-950 border-t border-white/5 py-1.5">
      {PHONE_TABS.map(({ key, label, icon: Icon }) => (
        <div
          key={key}
          className={`flex flex-col items-center gap-0.5 py-1 text-[9px] font-medium ${
            key === activeTab ? 'text-emerald-400' : 'text-neutral-600'
          }`}
        >
          <Icon size={15} aria-hidden="true" />
          {label}
        </div>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/** Honesty label rendered on every AI panel. */
export const AiExampleLabel: React.FC<{ text?: string }> = ({ text }) => (
  <div className="flex items-start gap-2 bg-violet-500/10 border border-violet-500/25 rounded-lg px-3 py-2">
    <Sparkles size={14} className="text-violet-300 shrink-0 mt-0.5" aria-hidden="true" />
    <p className="text-xs text-violet-200 leading-relaxed">
      {text ??
        'Example AI output — prewritten from the sample data in this tour. In the app, this is generated on demand by Gemini from your own entries.'}
    </p>
  </div>
);

const confidenceStyles: Record<Confidence, string> = {
  high: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  low: 'bg-neutral-500/10 text-neutral-300 border-neutral-500/30',
};

const ConfidenceChip: React.FC<{ level: Confidence }> = ({ level }) => (
  <span
    className={`shrink-0 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border ${confidenceStyles[level]}`}
  >
    {level}
  </span>
);

const PanelCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-neutral-800/50 border border-white/10 rounded-xl p-4 ${className ?? ''}`}>{children}</div>
);

const PanelHeading: React.FC<{ icon: React.FC<{ size?: number; className?: string }>; label: string }> = ({
  icon: Icon,
  label,
}) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon size={15} className="text-emerald-400" aria-hidden="true" />
    <h3 className="text-sm font-semibold text-white">{label}</h3>
  </div>
);

// ---------------------------------------------------------------------------
// Stop 1 — Welcome: the behavioral-dataset diagram
// ---------------------------------------------------------------------------

const DOMAIN_CHIPS = [
  { label: 'Habits', icon: Calendar },
  { label: 'Routines', icon: RouteIcon },
  { label: 'Goals', icon: Target },
  { label: 'Tasks', icon: ClipboardList },
  { label: 'Journal', icon: BookOpen },
  { label: 'Wellbeing', icon: HeartPulse },
];

const AI_OUTPUT_CHIPS = ['Weekly reviews', 'Journal analysis', 'Patterns & correlations', 'Recommendations'];

export const DataFlowPanel: React.FC = () => (
  <PanelCard className="flex flex-col gap-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {DOMAIN_CHIPS.map(({ label, icon: Icon }) => (
        <div
          key={label}
          className="flex items-center gap-2 bg-neutral-900/70 border border-white/5 rounded-lg px-3 py-2"
        >
          <Icon size={14} className="text-cyan-300" aria-hidden="true" />
          <span className="text-xs font-medium text-neutral-200">{label}</span>
        </div>
      ))}
    </div>
    <div className="flex items-center justify-center gap-2 text-neutral-500">
      <ArrowRight size={14} className="rotate-90" aria-hidden="true" />
    </div>
    <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-3">
      <Database size={15} className="text-emerald-300" aria-hidden="true" />
      <span className="text-sm font-semibold text-emerald-200">One structured behavioral dataset</span>
    </div>
    <div className="flex items-center justify-center gap-2 text-neutral-500">
      <ArrowRight size={14} className="rotate-90" aria-hidden="true" />
    </div>
    <div className="flex flex-wrap justify-center gap-2">
      {AI_OUTPUT_CHIPS.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/25 rounded-full px-3 py-1.5 text-xs font-medium text-violet-200"
        >
          <Sparkles size={12} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  </PanelCard>
);

// ---------------------------------------------------------------------------
// Stop 2 — Dashboard preview
// ---------------------------------------------------------------------------

const dayCellStyles = {
  done: 'bg-emerald-500/80 text-neutral-900',
  missed: 'bg-neutral-700/60 text-neutral-400',
  off: 'bg-transparent text-neutral-700',
} as const;

const DayCell: React.FC<{ state: 'done' | 'missed' | 'off' }> = ({ state }) => (
  <span
    className={`w-5 h-5 rounded flex items-center justify-center ${dayCellStyles[state]}`}
    role="img"
    aria-label={state === 'done' ? 'Done' : state === 'missed' ? 'Missed' : 'Not scheduled'}
  >
    {state === 'done' ? (
      <Check size={11} strokeWidth={3} aria-hidden="true" />
    ) : state === 'missed' ? (
      <X size={10} aria-hidden="true" />
    ) : (
      <Minus size={10} aria-hidden="true" />
    )}
  </span>
);

export const DashboardPreview: React.FC = () => {
  const device = useTourDevice();
  return (
  <div className="flex flex-col gap-3">
    {/* Habit week grid */}
    <PanelCard>
      <PanelHeading icon={Calendar} label="This week's habits" />
      <div className="flex flex-col gap-1.5 overflow-x-auto">
        <div className="grid grid-cols-[minmax(7rem,1fr),repeat(7,1.25rem),auto] gap-x-1.5 items-center text-[10px] text-neutral-500 font-semibold">
          <span />
          {WEEK_DAYS.map((d) => (
            <span key={d} className="text-center">
              {d[0]}
            </span>
          ))}
          <span />
        </div>
        {SAMPLE_HABITS.map((habit) => (
          <div
            key={habit.name}
            className="grid grid-cols-[minmax(7rem,1fr),repeat(7,1.25rem),auto] gap-x-1.5 items-center"
          >
            <span className="flex items-center gap-1.5 text-xs text-neutral-200 truncate">
              <Circle size={7} className={`${habit.color} fill-current shrink-0`} aria-hidden="true" />
              {habit.name}
            </span>
            {habit.days.map((state, i) => (
              <DayCell key={i} state={state} />
            ))}
            <span className="text-[10px] text-neutral-500 pl-1.5 whitespace-nowrap">{habit.summary}</span>
          </div>
        ))}
      </div>
    </PanelCard>

    <div className={`grid grid-cols-1 gap-3 ${device === 'desktop' ? 'sm:grid-cols-2' : ''}`}>
      {/* Wellbeing */}
      <PanelCard>
        <PanelHeading icon={HeartPulse} label="Wellbeing" />
        <div className="flex flex-col gap-2">
          {Object.values(SAMPLE_WELLBEING).map((metric) => (
            <div key={metric.label} className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-neutral-400">{metric.label}</span>
              <span className="text-xs text-white font-semibold">
                {metric.value} <span className="text-neutral-500 font-normal">· {metric.note}</span>
              </span>
            </div>
          ))}
        </div>
      </PanelCard>

      {/* Goals */}
      <PanelCard>
        <PanelHeading icon={Target} label="Goals at a glance" />
        <div className="flex flex-col gap-2.5">
          {SAMPLE_GOALS.map((goal) => (
            <div key={goal.name}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs text-neutral-200 truncate">{goal.name}</span>
                <span className="text-[10px] text-neutral-500 whitespace-nowrap">{goal.progressLabel}</span>
              </div>
              <div className="h-1.5 rounded-full bg-neutral-700/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                  style={{ width: `${goal.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </PanelCard>

      {/* Tasks */}
      <PanelCard>
        <PanelHeading icon={ClipboardList} label="Today's tasks" />
        <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
          {SAMPLE_TASKS.map((task) => (
            <li key={task.name} className="flex items-center gap-2 text-xs">
              {task.done ? (
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
              ) : (
                <Circle size={14} className="text-neutral-600 shrink-0" aria-hidden="true" />
              )}
              <span className={task.done ? 'text-neutral-500 line-through' : 'text-neutral-200'}>{task.name}</span>
            </li>
          ))}
        </ul>
      </PanelCard>

      {/* Routine + journal signal */}
      <PanelCard>
        <PanelHeading icon={RouteIcon} label="Pinned routine" />
        <p className="text-xs text-neutral-200 font-medium">{SAMPLE_ROUTINE.name}</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">{SAMPLE_ROUTINE.detail}</p>
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
          <BookOpen size={13} className="text-rose-300 shrink-0" aria-hidden="true" />
          <p className="text-[11px] text-neutral-400">Journal: 3 entries this week — feeds the AI stops ahead</p>
        </div>
      </PanelCard>
    </div>
  </div>
  );
};

// ---------------------------------------------------------------------------
// Stop 3 — AI Weekly Review example
// ---------------------------------------------------------------------------

const ReviewSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <h4 className="text-[11px] uppercase tracking-wide font-semibold text-neutral-500 mb-1.5">{label}</h4>
    {children}
  </div>
);

const BulletList: React.FC<{ items: string[]; icon?: 'check' | 'dot' | 'bulb' }> = ({ items, icon = 'dot' }) => (
  <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-2 text-xs text-neutral-300 leading-relaxed">
        {icon === 'check' ? (
          <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
        ) : icon === 'bulb' ? (
          <Lightbulb size={13} className="text-cyan-300 shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <Circle size={5} className="text-neutral-600 fill-current shrink-0 mt-1.5" aria-hidden="true" />
        )}
        {item}
      </li>
    ))}
  </ul>
);

export const WeeklyReviewPreview: React.FC = () => (
  <div className="flex flex-col gap-3">
    <AiExampleLabel />
    <PanelCard className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-violet-300" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-white">Weekly AI Review</h3>
        <span className="text-[10px] text-neutral-500 ml-auto">Mon – Sun</span>
      </div>
      <ReviewSection label="Week at a glance">
        <p className="text-xs text-neutral-300 leading-relaxed">{WEEKLY_REVIEW_EXAMPLE.weekAtAGlance}</p>
      </ReviewSection>
      <ReviewSection label="Wins">
        <BulletList items={WEEKLY_REVIEW_EXAMPLE.wins} icon="check" />
      </ReviewSection>
      <ReviewSection label="Patterns">
        <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
          {WEEKLY_REVIEW_EXAMPLE.patterns.map((pattern) => (
            <li key={pattern.text} className="flex items-start gap-2 text-xs text-neutral-300 leading-relaxed">
              <ConfidenceChip level={pattern.confidence} />
              {pattern.text}
            </li>
          ))}
        </ul>
      </ReviewSection>
      <ReviewSection label="Blockers">
        <BulletList items={WEEKLY_REVIEW_EXAMPLE.blockers} />
      </ReviewSection>
      <ReviewSection label="Recommendations">
        <BulletList items={WEEKLY_REVIEW_EXAMPLE.recommendations} icon="bulb" />
      </ReviewSection>
      <ReviewSection label="Next week focus">
        <BulletList items={WEEKLY_REVIEW_EXAMPLE.nextWeekFocus} icon="check" />
      </ReviewSection>
    </PanelCard>
  </div>
);

// ---------------------------------------------------------------------------
// Stop 4 — Journal Intelligence example
// ---------------------------------------------------------------------------

export const JournalIntelligencePreview: React.FC = () => {
  const device = useTourDevice();
  return (
  <div className="flex flex-col gap-3">
    <PanelCard>
      <PanelHeading icon={BookOpen} label="Journal entries (sample data)" />
      <div className="flex flex-col gap-3">
        {SAMPLE_JOURNAL_ENTRIES.map((entry) => (
          <div key={entry.day} className="bg-neutral-900/70 border border-white/5 rounded-lg px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-neutral-500 mb-1">
              {entry.day} · {entry.template}
            </p>
            <p className="text-xs text-neutral-300 leading-relaxed">“{entry.excerpt}”</p>
          </div>
        ))}
      </div>
    </PanelCard>

    <AiExampleLabel text="Example AI extraction — prewritten from the three sample entries above. In the app, Gemini performs this structured extraction on your own free-form writing." />

    <PanelCard className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Brain size={15} className="text-violet-300" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-white">AI Journal Review</h3>
      </div>
      <ReviewSection label="Themes">
        <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
          {JOURNAL_EXTRACTION_EXAMPLE.themes.map((theme) => (
            <li key={theme.text} className="flex items-start gap-2 text-xs text-neutral-300 leading-relaxed">
              <ConfidenceChip level={theme.confidence} />
              {theme.text}
            </li>
          ))}
        </ul>
      </ReviewSection>
      <div className={`grid grid-cols-1 gap-4 ${device === 'desktop' ? 'sm:grid-cols-2' : ''}`}>
        <ReviewSection label="Stressors">
          <BulletList items={JOURNAL_EXTRACTION_EXAMPLE.stressors} />
        </ReviewSection>
        <ReviewSection label="Blockers">
          <BulletList items={JOURNAL_EXTRACTION_EXAMPLE.blockers} />
        </ReviewSection>
        <ReviewSection label="Goals mentioned">
          <BulletList items={JOURNAL_EXTRACTION_EXAMPLE.goalsMentioned} />
        </ReviewSection>
        <ReviewSection label="Emotional patterns">
          <BulletList items={JOURNAL_EXTRACTION_EXAMPLE.emotionalPatterns} />
        </ReviewSection>
      </div>
    </PanelCard>
  </div>
  );
};

// ---------------------------------------------------------------------------
// Stop 5 — Behavioral insights & recommendations example
// ---------------------------------------------------------------------------

export const InsightsPreview: React.FC = () => (
  <div className="flex flex-col gap-3">
    <AiExampleLabel text="Example outputs — prewritten from the tour's sample data. In the app, correlations are computed server-side from your entries, and recommendations are generated by Gemini grounded on those numbers." />

    <PanelCard>
      <PanelHeading icon={TrendingUp} label="What's helping / what's holding you back" />
      <div className="flex flex-col gap-2">
        {INSIGHT_EXAMPLES.map((insight) => (
          <div key={insight.finding} className="flex items-start gap-2.5 bg-neutral-900/70 border border-white/5 rounded-lg px-3 py-2.5">
            {insight.direction === 'positive' ? (
              <TrendingUp size={14} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <TrendingDown size={14} className="text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div>
              <p className="text-xs font-semibold text-neutral-200">{insight.finding}</p>
              <p className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">{insight.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </PanelCard>

    <PanelCard>
      <PanelHeading icon={Lightbulb} label="Recommended next steps" />
      <BulletList items={RECOMMENDATION_EXAMPLES} icon="bulb" />
    </PanelCard>
  </div>
);

// ---------------------------------------------------------------------------
// Stop 6 — Technical credibility panel
// ---------------------------------------------------------------------------

export const TechPanel: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {TECH_FACTS.map((fact) => (
      <PanelCard key={fact.title}>
        <h3 className="text-xs font-semibold text-white mb-1">{fact.title}</h3>
        <p className="text-[11px] text-neutral-400 leading-relaxed">{fact.detail}</p>
      </PanelCard>
    ))}
  </div>
);
