import React, { useId, useState } from 'react';
import { ChevronDown, CircleCheck, Flame, Gauge, Smile, type LucideIcon } from 'lucide-react';
import type { Habit } from '../../types';
import { cn } from '../../utils/cn';
import { DAILY_CHECK_IN_JOURNAL_MAX_LENGTH } from '../../shared/dailyCheckIn';
import {
    getCompletionHeadline,
    getEffortOption,
    getMoodOption,
    type CheckInRow,
    type CheckInSummary,
} from './checkInModel';
import { CARD, FOCUS_RING } from './checkInStyles';
import { HabitTile } from './HabitTile';
import { StatusPill } from './IntroStep';

const JournalItem: React.FC<{
    row: CheckInRow;
    color?: string;
    defaultOpen: boolean;
    onChange: (text: string) => void;
}> = ({ row, color, defaultOpen, onChange }) => {
    const [open, setOpen] = useState(defaultOpen);
    const panelId = useId();
    const textareaId = useId();
    const counterId = useId();
    const text = row.reflection?.journalEntry ?? '';

    return (
        <li className={cn(CARD, 'list-none p-4')}>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen(value => !value)}
                className={cn('flex w-full items-center gap-3 rounded-xl text-left', FOCUS_RING)}
            >
                <HabitTile name={row.habit.name} color={color} size="sm" />
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="truncate text-base font-semibold text-white">{row.habit.name}</span>
                        {row.status && <StatusPill status={row.status} />}
                    </span>
                    <span className="block text-sm text-neutral-400">
                        {text.trim() ? 'Note added' : 'Journal your thoughts (optional)'}
                    </span>
                </span>
                <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className={cn('shrink-0 text-neutral-500 motion-safe:transition-transform', open && 'rotate-180')}
                />
            </button>
            {open && (
                <div id={panelId} className="mt-3">
                    <label htmlFor={textareaId} className="sr-only">
                        Journal note for {row.habit.name}
                    </label>
                    <textarea
                        id={textareaId}
                        rows={3}
                        maxLength={DAILY_CHECK_IN_JOURNAL_MAX_LENGTH}
                        value={text}
                        onChange={event => onChange(event.target.value)}
                        placeholder="What helped? What got in the way?"
                        aria-describedby={counterId}
                        className="w-full resize-y rounded-xl border border-white/10 bg-neutral-950/60 p-3 text-base text-white placeholder:text-neutral-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 sm:text-sm"
                    />
                    <p id={counterId} className="mt-1 text-right text-xs text-neutral-500">
                        {text.length}/{DAILY_CHECK_IN_JOURNAL_MAX_LENGTH}
                        <span className="sr-only"> characters</span>
                    </p>
                </div>
            )}
        </li>
    );
};

const SummaryRow: React.FC<{ Icon: LucideIcon; iconClass: string; title: string; detail: string }> = ({ Icon, iconClass, title, detail }) => (
    <li className="flex items-center gap-3 py-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconClass)}>
            <Icon size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0">
            <span className="block text-base font-semibold text-white">{title}</span>
            <span className="block text-sm text-neutral-400">{detail}</span>
        </span>
    </li>
);

interface WrapUpStepProps {
    rows: CheckInRow[];
    colorFor: (habit: Habit) => string | undefined;
    summary: CheckInSummary;
    /** Longest active streak among today's habits (omitted when streaks are hidden). */
    bestStreak: { habitName: string; label: string } | null;
    momentum: { state: string; copy: string } | null;
    onJournalChange: (habitId: string, text: string) => void;
}

/** Page 5: optional per-habit journal notes and the day's summary. */
export const WrapUpStep: React.FC<WrapUpStepProps> = ({ rows, colorFor, summary, bestStreak, momentum, onJournalChange }) => {
    const journalHeadingId = useId();
    const summaryHeadingId = useId();
    const answered = rows.filter(row => row.status !== null);
    const firstWithNote = answered.findIndex(row => row.reflection?.journalEntry);

    const breakdown = [
        summary.partial > 0 && `${summary.partial} partial`,
        summary.skipped > 0 && `${summary.skipped} skipped`,
        summary.unmarked > 0 && `${summary.unmarked} not marked`,
    ].filter(Boolean).join(' · ');
    const mood = getMoodOption(summary.averageMood === null ? null : Math.round(summary.averageMood));
    const effort = getEffortOption(summary.averageEffort === null ? null : Math.round(summary.averageEffort));
    const momentumRow = bestStreak
        ? { title: bestStreak.label, detail: momentum ? `${bestStreak.habitName} · ${momentum.copy}` : bestStreak.habitName }
        : momentum
            ? { title: `${momentum.state} momentum`, detail: momentum.copy }
            : null;

    return (
        <>
            <section aria-labelledby={journalHeadingId} className="flex flex-col gap-3">
                <h3 id={journalHeadingId} className="text-lg font-bold text-white">
                    Journal <span className="text-sm font-normal text-neutral-400">(optional)</span>
                </h3>
                {answered.length === 0 ? (
                    <p className={cn(CARD, 'p-4 text-sm text-neutral-400')}>
                        No habits marked yet. Go back to log what you did, or complete the check-in as it is.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {answered.map((row, index) => (
                            <JournalItem
                                key={row.habit.id}
                                row={row}
                                color={colorFor(row.habit)}
                                // Open notes that exist; otherwise invite the first one.
                                defaultOpen={Boolean(row.reflection?.journalEntry) || (firstWithNote === -1 && index === 0)}
                                onChange={text => onJournalChange(row.habit.id, text)}
                            />
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby={summaryHeadingId} className={cn(CARD, 'px-4 pt-4 pb-1')}>
                <h3 id={summaryHeadingId} className="text-xl font-bold text-white">Today's Summary</h3>
                <ul className="mt-1 divide-y divide-white/5">
                    <SummaryRow
                        Icon={CircleCheck}
                        iconClass="bg-emerald-500/15 text-emerald-400"
                        title={`${summary.done} of ${summary.total} ${summary.total === 1 ? 'habit' : 'habits'} completed`}
                        detail={breakdown || getCompletionHeadline(summary)}
                    />
                    <SummaryRow
                        Icon={Smile}
                        iconClass="bg-sky-500/15 text-sky-400"
                        title={mood ? `Mood logged ${mood.emoji}` : 'Mood not logged'}
                        detail={mood ? mood.summary : 'Rate how your habits felt to see your mood here.'}
                    />
                    <SummaryRow
                        Icon={Gauge}
                        iconClass="bg-violet-500/15 text-violet-400"
                        title={summary.averageEffort === null ? 'Effort not rated' : `Average effort ${summary.averageEffort}/5`}
                        detail={effort ? effort.label : 'Rate effort to track how hard habits feel over time.'}
                    />
                    {momentumRow && (
                        <SummaryRow
                            Icon={Flame}
                            iconClass="bg-amber-500/15 text-amber-400"
                            title={momentumRow.title}
                            detail={momentumRow.detail}
                        />
                    )}
                </ul>
            </section>
        </>
    );
};
