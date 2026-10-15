import React, { useEffect, useId, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, CircleCheck, ClipboardCheck } from 'lucide-react';
import { useHabitStore } from '../../store/HabitContext';
import { useDailyCheckIn } from '../../lib/useDailyCheckIn';
import { cn } from '../../utils/cn';
import { DAILY_CHECK_IN_STEP_COUNT } from '../../shared/dailyCheckIn';
import {
    CHECK_IN_LAST_STEP,
    estimateCheckInMinutes,
    getCheckInHabitTruth,
    getCheckInHabits,
    resolveCheckInStatus,
} from '../check-in/checkInModel';
import { FOCUS_RING } from '../check-in/checkInStyles';

interface DailyCheckInCardProps {
    /** Open the Daily Check-in at a page (1 = intro, 5 = summary). */
    onOpen: (step: number) => void;
}

function todayKey(): string {
    return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Today's local dayKey, re-read when the app returns to the foreground and
 * once a minute, so a dashboard left open (or a resumed home-screen app)
 * moves on to the new day after midnight.
 */
function useTodayKey(): string {
    const [dayKey, setDayKey] = useState(todayKey);
    useEffect(() => {
        const refresh = () => setDayKey(todayKey());
        const timer = window.setInterval(refresh, 60_000);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, []);
    return dayKey;
}

const DayCheckInCard: React.FC<DailyCheckInCardProps & { dayKey: string }> = ({ dayKey, onOpen }) => {
    const { habits, categories, logs, loading: habitsLoading } = useHabitStore();
    const { draft, phase, loading: checkInLoading } = useDailyCheckIn(dayKey);
    const headingId = useId();

    const statuses = useMemo(
        () => getCheckInHabits(habits, categories, dayKey).map(habit =>
            resolveCheckInStatus(getCheckInHabitTruth(habit, logs, dayKey), draft?.habits[habit.id]?.completionStatus),
        ),
        [habits, categories, logs, dayKey, draft],
    );
    const total = statuses.length;

    // Nothing scheduled and nothing started: no check-in to offer today.
    if (!habitsLoading && total === 0 && phase === 'not_started') return null;

    const loading = habitsLoading || checkInLoading;
    const loggedCount = statuses.filter(status => status !== null).length;
    const currentStep = draft?.currentStep ?? 1;
    const stepsDone = Math.max(currentStep - 1, 0);

    let title = 'Daily Check-in';
    let detail: string;
    let action: { label: string; step: number };
    if (phase === 'complete') {
        title = "Today's check-in complete";
        detail = `${loggedCount} ${loggedCount === 1 ? 'habit' : 'habits'} logged`;
        action = { label: 'View summary', step: CHECK_IN_LAST_STEP };
    } else if (phase === 'in_progress') {
        const minutes = estimateCheckInMinutes(currentStep, statuses);
        detail = `${stepsDone} of ${DAILY_CHECK_IN_STEP_COUNT} steps complete · ~${minutes} min left`;
        action = { label: 'Continue check-in', step: Math.max(currentStep, 2) };
    } else {
        detail = `${total} ${total === 1 ? 'habit' : 'habits'} waiting · ~${estimateCheckInMinutes(1, statuses)} min`;
        action = { label: 'Start check-in', step: 1 };
    }

    const complete = phase === 'complete';
    const Icon = complete ? CircleCheck : ClipboardCheck;

    return (
        <section
            aria-labelledby={headingId}
            aria-busy={loading || undefined}
            className={cn(
                'rounded-2xl border p-4 backdrop-blur-sm',
                complete
                    ? 'border-white/5 bg-neutral-900/50'
                    : 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-neutral-900/60 to-neutral-900/50',
            )}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                        className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                            complete ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-500 text-neutral-950',
                        )}
                        aria-hidden="true"
                    >
                        <Icon size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 id={headingId} className="text-base font-semibold text-white">{title}</h3>
                        <p className="text-sm text-neutral-400">{loading ? 'Loading…' : detail}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onOpen(action.step)}
                    disabled={loading}
                    className={cn(
                        'flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto motion-safe:transition-colors',
                        FOCUS_RING,
                        complete
                            ? 'border border-white/10 text-neutral-200 hover:border-white/25 hover:text-white'
                            : 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400',
                    )}
                >
                    {action.label}
                    {!complete && <ArrowRight size={16} aria-hidden="true" />}
                </button>
            </div>

            {phase === 'in_progress' && !loading && (
                <div className="mt-3 flex gap-1" aria-hidden="true">
                    {Array.from({ length: DAILY_CHECK_IN_STEP_COUNT }, (_, index) => (
                        <span
                            key={index}
                            className={cn('h-1 flex-1 rounded-full', index < stepsDone ? 'bg-emerald-400' : 'bg-neutral-700')}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};

/**
 * Dashboard entry point for the optional Daily Check-in. Three states:
 * not started ("4 habits waiting · ~2 min"), in progress ("2 of 5 steps
 * complete"), and complete ("4 habits logged" → View summary).
 */
export const DailyCheckInCard: React.FC<DailyCheckInCardProps> = ({ onOpen }) => {
    const dayKey = useTodayKey();
    // Remount per day so the state shown (and the page it opens) always belongs to today.
    return <DayCheckInCard key={dayKey} dayKey={dayKey} onOpen={onOpen} />;
};
