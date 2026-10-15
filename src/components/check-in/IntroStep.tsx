import React, { useId } from 'react';
import { ChartNoAxesColumn, Check, CircleCheck, NotebookPen, Smile, Sparkles } from 'lucide-react';
import type { Habit } from '../../types';
import { cn } from '../../utils/cn';
import type { CheckInCompletionStatus, CheckInRow } from './checkInModel';
import { CARD } from './checkInStyles';
import { HabitTile } from './HabitTile';

const EXPECTATIONS = [
    { title: "Check off today's habits", body: 'Mark each one done, partial, or skipped.', Icon: CircleCheck },
    { title: 'Log how it felt', body: 'A quick mood check for what you worked on.', Icon: Smile },
    { title: 'Rate your effort', body: 'One tap: how hard was it?', Icon: ChartNoAxesColumn },
    { title: 'Add notes (optional)', body: 'Capture what helped or got in the way.', Icon: NotebookPen },
    { title: 'Review & complete', body: 'See your summary and keep the momentum going.', Icon: Sparkles },
];

const MAX_LISTED_HABITS = 6;

const STATUS_LABELS: Record<CheckInCompletionStatus, string> = {
    done: 'Done',
    partial: 'Partial',
    skipped: 'Skipped',
};

export const StatusPill: React.FC<{ status: CheckInCompletionStatus }> = ({ status }) => (
    <span
        className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            status === 'done' && 'bg-emerald-500/15 text-emerald-300',
            status === 'partial' && 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/40',
            status === 'skipped' && 'bg-rose-500/10 text-rose-300',
        )}
    >
        {status === 'done' && <Check size={12} aria-hidden="true" />}
        {STATUS_LABELS[status]}
    </span>
);

interface IntroStepProps {
    rows: CheckInRow[];
    colorFor: (habit: Habit) => string | undefined;
    dateLabel: string;
    /** Page the user stopped on (in-progress check-ins), or null when not started. */
    resumeStep: number | null;
}

/** Page 1: today's habits and what the flow involves. */
export const IntroStep: React.FC<IntroStepProps> = ({ rows, colorFor, dateLabel, resumeStep }) => {
    const habitsHeadingId = useId();
    const expectHeadingId = useId();
    const listed = rows.slice(0, MAX_LISTED_HABITS);
    const hiddenCount = rows.length - listed.length;
    const nextStep = resumeStep ?? 1;

    return (
        <>
            <section aria-labelledby={habitsHeadingId} className={cn(CARD, 'p-4')}>
                <div className="flex items-center justify-between gap-3">
                    <h3 id={habitsHeadingId} className="text-base font-bold text-white sm:text-lg">
                        {rows.length === 0
                            ? 'No habits scheduled today'
                            : `${rows.length} ${rows.length === 1 ? 'habit' : 'habits'} to check in today`}
                    </h3>
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold tracking-wide text-emerald-300">
                        {dateLabel}
                    </span>
                </div>
                {rows.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-400">
                        Habits scheduled for today show up here. You can add or reschedule habits from the Habits tab.
                    </p>
                ) : (
                    <ul className="mt-2 divide-y divide-white/5">
                        {listed.map(row => (
                            <li key={row.habit.id} className="flex items-center gap-3 py-2.5">
                                <HabitTile name={row.habit.name} color={colorFor(row.habit)} size="sm" />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-100">{row.habit.name}</span>
                                {row.status && <StatusPill status={row.status} />}
                            </li>
                        ))}
                    </ul>
                )}
                {hiddenCount > 0 && <p className="pt-2 text-xs text-neutral-400">+ {hiddenCount} more</p>}
            </section>

            <section aria-labelledby={expectHeadingId}>
                <h3 id={expectHeadingId} className="text-lg font-bold text-white">What to expect</h3>
                <ol className="mt-2">
                    {EXPECTATIONS.map(({ title, body, Icon }, index) => {
                        const stepNumber = index + 1;
                        const done = stepNumber < nextStep;
                        const current = stepNumber === nextStep;
                        return (
                            <li key={title} className="relative flex items-center gap-3 py-2.5">
                                {index < EXPECTATIONS.length - 1 && (
                                    <span
                                        aria-hidden="true"
                                        className="absolute left-4 top-1/2 h-full w-0 -translate-x-1/2 border-l-2 border-dotted border-neutral-700"
                                    />
                                )}
                                <span
                                    className={cn(
                                        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                                        done || current ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300',
                                    )}
                                >
                                    {done ? <Check size={14} aria-hidden="true" /> : stepNumber}
                                    <span className="sr-only">{done ? ', done' : current ? ', up next' : ''}</span>
                                </span>
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-800/70">
                                    <Icon size={20} aria-hidden="true" className={done || current ? 'text-emerald-400' : 'text-neutral-400'} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-white">{title}</span>
                                    <span className="block text-sm text-neutral-400">{body}</span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </section>
        </>
    );
};
