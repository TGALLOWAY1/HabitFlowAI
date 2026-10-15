import React, { useId } from 'react';
import type { Habit } from '../../types';
import { cn } from '../../utils/cn';
import type { CheckInRow } from './checkInModel';
import { CARD } from './checkInStyles';
import { EffortSelector } from './EffortSelector';
import { HabitTile } from './HabitTile';
import { MoodSlider } from './MoodSlider';
import { MoodTagSelector } from './MoodTagSelector';

interface ReflectionStepProps {
    row: CheckInRow | undefined;
    index: number;
    count: number;
    colorFor: (habit: Habit) => string | undefined;
}

/** Which habit is being reflected on, and where it sits in the sequence. */
const ReflectionHabitHeader: React.FC<ReflectionStepProps & { row: CheckInRow }> = ({ row, index, count, colorFor }) => (
    <section
        aria-label={`${row.habit.name}, habit ${index + 1} of ${count}`}
        className={cn(CARD, 'flex items-center gap-3 p-4')}
    >
        <HabitTile name={row.habit.name} color={colorFor(row.habit)} />
        <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-white">{row.habit.name}</p>
            <p className="truncate text-sm text-neutral-400">
                {row.habit.description?.trim() || (row.status === 'done' ? 'Completed today' : 'Partly done today')}
            </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300" aria-hidden="true">
            {index + 1} of {count}
        </span>
    </section>
);

const NothingToReflect: React.FC = () => (
    <section className={cn(CARD, 'p-5 text-center')}>
        <p className="text-base font-semibold text-white">Nothing to reflect on yet</p>
        <p className="mt-1 text-sm text-neutral-400">
            Mark habits Done or Partial on the previous page to log how they felt. Skipped habits don't need a reflection.
        </p>
    </section>
);

interface MoodStepProps extends ReflectionStepProps {
    onMoodChange: (habitId: string, score: number) => void;
    onTagsChange: (habitId: string, tags: string[]) => void;
}

/** Page 3: emoji mood + optional tags, one habit at a time. */
export const MoodStep: React.FC<MoodStepProps> = ({ row, index, count, colorFor, onMoodChange, onTagsChange }) => {
    const moodHeadingId = useId();
    const tagsHeadingId = useId();
    if (!row) return <NothingToReflect />;

    return (
        <>
            <ReflectionHabitHeader row={row} index={index} count={count} colorFor={colorFor} />
            <section className={cn(CARD, 'p-5')}>
                <h3 id={moodHeadingId} className="text-lg font-bold text-white">Overall, how did it feel?</h3>
                <p className="mt-0.5 text-sm text-neutral-400">Tap an emoji or slide to match your mood.</p>
                <div className="mt-5">
                    <MoodSlider
                        value={row.reflection?.moodScore ?? null}
                        labelledBy={moodHeadingId}
                        onChange={score => onMoodChange(row.habit.id, score)}
                    />
                </div>
            </section>
            <section>
                <h3 id={tagsHeadingId} className="text-base font-bold text-white">What best describes your experience?</h3>
                <p className="mt-0.5 text-sm text-neutral-400">Select any that fit (optional).</p>
                <div className="mt-3">
                    <MoodTagSelector
                        value={row.reflection?.moodTags ?? []}
                        labelledBy={tagsHeadingId}
                        onChange={tags => onTagsChange(row.habit.id, tags)}
                    />
                </div>
            </section>
        </>
    );
};

interface EffortStepProps extends ReflectionStepProps {
    onEffortChange: (habitId: string, score: number) => void;
}

/** Page 4: perceived effort, one habit at a time. */
export const EffortStep: React.FC<EffortStepProps> = ({ row, index, count, colorFor, onEffortChange }) => {
    const effortHeadingId = useId();
    if (!row) return <NothingToReflect />;

    return (
        <>
            <ReflectionHabitHeader row={row} index={index} count={count} colorFor={colorFor} />
            <section className={cn(CARD, 'p-5')}>
                <h3 id={effortHeadingId} className="text-base font-semibold text-white">
                    Rate the effort<span className="sr-only"> for {row.habit.name}</span>
                </h3>
                <div className="mt-4">
                    <EffortSelector
                        value={row.reflection?.effortScore ?? null}
                        labelledBy={effortHeadingId}
                        onChange={score => onEffortChange(row.habit.id, score)}
                    />
                </div>
            </section>
        </>
    );
};
