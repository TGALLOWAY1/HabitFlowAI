import React from 'react';
import {
  ArrowLeft,
  Map,
  Route as RouteIcon,
  Link2,
  Users,
  KeyRound,
  ScrollText,
  Mic,
  Smartphone,
  Trees,
  MessageSquareText,
  Compass,
  LineChart,
  ShieldCheck,
} from 'lucide-react';

/**
 * Roadmap page — the single user-facing home for future functionality.
 *
 * Honesty contract: nothing on this page exists in the product yet. Items are
 * mirrored from ROADMAP.md (the engineering source of truth) and labeled with
 * an explicit status so visitors never wonder whether a feature already
 * exists. Shipped functionality lives in the app and the Take a Tour page,
 * never here.
 */

// The page renders in two contexts, mirroring TourPage:
//  - 'app':  inside the authenticated/demo app.
//  - 'auth': pre-login (from the login screen or the tour).
type RoadmapPageProps = {
  mode?: 'app' | 'auth';
  onBack: () => void;
};

type RoadmapStatus = 'In Development' | 'Planned' | 'Exploring';

interface RoadmapItem {
  icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  status: RoadmapStatus;
  description: string;
}

const NEAR_TERM: RoadmapItem[] = [
  {
    icon: LineChart,
    title: 'Analytics in primary navigation',
    status: 'In Development',
    description:
      'Promote the Analytics page (today a beta page reached from the user menu) into the main tab bar, replacing Tasks.',
  },
  {
    icon: ShieldCheck,
    title: 'Archive & history hardening',
    status: 'In Development',
    description:
      'Data-integrity work so deleting or unlinking a habit can never erase the historical meaning of past entries, however tangled the links.',
  },
  {
    icon: Link2,
    title: 'Shareable page URLs',
    status: 'Planned',
    description:
      'Move from query-string routing (?view=…) to clean path-based URLs so every page is linkable and shareable.',
  },
];

const LATER: RoadmapItem[] = [
  {
    icon: Users,
    title: 'Multi-user households',
    status: 'Planned',
    description:
      'Invites, shared habits, and per-user views. The household/user identity model already underpins the API — the UI on top is what remains.',
  },
  {
    icon: KeyRound,
    title: 'Pluggable AI providers',
    status: 'Planned',
    description:
      'Bring your own Anthropic (Claude) or OpenAI key alongside the current Gemini integration, and pick the model that fits you.',
  },
  {
    icon: ScrollText,
    title: 'Journal questionnaire templates',
    status: 'Planned',
    description:
      'Guided check-ins built from reusable prompt sets — structured reflection beyond today’s 11 persona templates.',
  },
  {
    icon: Mic,
    title: 'Dictation journal mode',
    status: 'Planned',
    description: 'A voice-first journaling workflow: capture reflections by speaking instead of typing.',
  },
];

const EXPLORING: RoadmapItem[] = [
  {
    icon: Smartphone,
    title: 'Native iOS/Android wrappers',
    status: 'Exploring',
    description:
      'Real push notifications for routines and check-ins. HabitFlow is responsive web today — installable, but without native notifications.',
  },
  {
    icon: Trees,
    title: 'Skills & skill tree',
    status: 'Exploring',
    description: 'A progression layer that turns long-run consistency into visible skill growth.',
  },
  {
    icon: MessageSquareText,
    title: 'Persona switching UX',
    status: 'Exploring',
    description:
      'A smoother way to switch coaching personas across the app. Persona-toned journal templates exist today; app-wide switching does not.',
  },
  {
    icon: Compass,
    title: 'Identity prompts & coaching',
    status: 'Exploring',
    description:
      'Deeper coaching that connects habits to who you want to become, grounded in psychological-safety principles.',
  },
];

const statusStyles: Record<RoadmapStatus, string> = {
  'In Development': 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  Planned: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Exploring: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

const Section: React.FC<{ id: string; title: string; subtitle: string; items: RoadmapItem[] }> = ({ id, title, subtitle, items }) => (
  <section aria-labelledby={id} className="flex flex-col gap-4">
    <div>
      <h2 id={id} className="text-xl font-semibold text-white">{title}</h2>
      <p className="text-sm text-neutral-400 mt-1">{subtitle}</p>
    </div>
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0">
      {items.map(({ icon: Icon, title: itemTitle, status, description }) => (
        <li key={itemTitle} className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icon size={18} className="text-neutral-300 shrink-0" aria-hidden="true" />
              <h3 className="font-semibold text-white truncate">{itemTitle}</h3>
            </div>
            <span className={`shrink-0 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${statusStyles[status]}`}>
              {status}
            </span>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
        </li>
      ))}
    </ul>
  </section>
);

export const RoadmapPage: React.FC<RoadmapPageProps> = ({ mode = 'app', onBack }) => {
  const isAuth = mode === 'auth';
  return (
    <div className={`max-w-4xl mx-auto flex flex-col gap-10 pb-4 ${isAuth ? 'min-h-screen bg-neutral-900 text-white px-4 py-8' : ''}`}>
      <button
        onClick={onBack}
        className="self-start inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors -mb-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </button>

      <header className="text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-sky-400 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20">
          <Map size={28} className="text-white" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
          Roadmap
        </h1>
        <p className="text-neutral-300 max-w-2xl text-base leading-relaxed">
          Where HabitFlow is headed next. To keep things honest, this page only lists what{' '}
          <span className="text-white font-medium">doesn’t exist yet</span> — everything you can
          use today lives in the app and the tour, never here.
        </p>
        <div className="flex flex-wrap justify-center gap-2 text-[11px]">
          <span className={`px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${statusStyles['In Development']}`}>In Development — being built now</span>
          <span className={`px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${statusStyles['Planned']}`}>Planned — committed, not started</span>
          <span className={`px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${statusStyles['Exploring']}`}>Exploring — direction under investigation</span>
        </div>
      </header>

      <Section
        id="roadmap-near-term"
        title="Coming soon"
        subtitle="The next things to ship."
        items={NEAR_TERM}
      />
      <Section
        id="roadmap-later"
        title="Later"
        subtitle="Committed direction, sequenced after the near-term work."
        items={LATER}
      />
      <Section
        id="roadmap-exploring"
        title="Exploring"
        subtitle="Ideas being evaluated — these may change shape or not happen."
        items={EXPLORING}
      />

      <footer className="text-center text-sm text-neutral-500 flex items-center justify-center gap-2">
        <RouteIcon size={14} aria-hidden="true" />
        Mirrored from <code className="text-neutral-400">ROADMAP.md</code> in the repository — updated as items ship.
      </footer>
    </div>
  );
};
