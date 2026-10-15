import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parse } from 'date-fns';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { Habit } from '../types';
import { useHabitStore } from '../store/HabitContext';
import { useDashboardPrefs } from '../store/DashboardPrefsContext';
import { useToast } from '../components/Toast';
import { useProgressOverview } from '../lib/useProgressOverview';
import { useDailyCheckIn } from '../lib/useDailyCheckIn';
import { isEmbedMode } from '../lib/demoMode';
import { getCompletionEntryValue } from '../domain/habits/completion';
import { getEffectiveCategoryId } from '../utils/habitUtils';
import { DAILY_CHECK_IN_STEP_COUNT } from '../shared/dailyCheckIn';
import { CheckInLayout } from '../components/check-in/CheckInLayout';
import { HabitCompletionCard } from '../components/check-in/HabitCompletionCard';
import { IntroStep } from '../components/check-in/IntroStep';
import { EffortStep, MoodStep } from '../components/check-in/ReflectionSteps';
import { WrapUpStep } from '../components/check-in/WrapUpStep';
import { PRIMARY_BUTTON, SECONDARY_TEXT_BUTTON } from '../components/check-in/checkInStyles';
import {
    CHECK_IN_LAST_STEP,
    buildCheckInSummary,
    estimateCheckInMinutes,
    formatStreakLabel,
    getCheckInHabitTruth,
    getCheckInHabits,
    getNextStep,
    getPreviousStep,
    needsReflection,
    parseCheckInStep,
    resolveCheckInStatus,
    type CheckInCompletionStatus,
    type CheckInRow,
} from '../components/check-in/checkInModel';

const STEP_COPY: Record<number, { title: string; subtitle: string }> = {
    1: { title: 'Daily Check-in', subtitle: 'Log your progress, build momentum, and set up a better tomorrow.' },
    2: { title: 'What did you complete?', subtitle: 'Mark what you worked on today. No pressure — progress counts.' },
    3: { title: 'How did it feel?', subtitle: 'Take a moment to reflect on how each habit made you feel today.' },
    4: { title: 'How much effort did it take?', subtitle: 'A quick gut check — one tap per habit.' },
    5: { title: 'Wrap up your day', subtitle: 'Reflect on your progress and set yourself up for tomorrow.' },
};

interface CheckInHistoryState {
    view: 'check-in';
    step: number;
    prevStep: number;
    /** Entry was pushed (not replaced), so history.back() returns to prevStep. */
    pushed: boolean;
}

function readStepFromUrl(): number {
    return parseCheckInStep(new URLSearchParams(window.location.search).get('step'));
}

/** The app scrolls inside one container that persists across views. */
function scrollAppToTop(): void {
    document.querySelector('main.app-scroll')?.scrollTo?.({ top: 0 });
}

interface CheckInPageProps {
    /** Leave the flow. Progress is saved continuously, so nothing is lost. */
    onExit: () => void;
}

/**
 * Daily Check-in — optional guided path layered on top of habit tracking
 * (`?view=check-in&step=1..5`). Completion changes go through the same habit
 * store calls as the Today view, so habitEntries stay the only completion
 * truth; reflections persist via useDailyCheckIn.
 */
export const CheckInPage: React.FC<CheckInPageProps> = ({ onExit: exitFlow }) => {
    // Start each visit at the top, and hand the next view an unscrolled page.
    useEffect(() => {
        scrollAppToTop();
    }, []);
    const onExit = useCallback(() => {
        scrollAppToTop();
        exitFlow();
    }, [exitFlow]);

    const {
        habits,
        categories,
        logs,
        loading: habitsLoading,
        upsertHabitEntry,
        deleteHabitEntryByKey,
        toggleHabit,
    } = useHabitStore();
    const { hideStreaks } = useDashboardPrefs();
    const { showToast } = useToast();
    const { data: progress, refresh: refreshProgress } = useProgressOverview();

    const [dayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const {
        draft,
        phase,
        loading: checkInLoading,
        saveError,
        readOnly,
        setStep: saveResumeStep,
        updateHabit,
        complete,
    } = useDailyCheckIn(dayKey);

    const [step, setStep] = useState(readStepFromUrl);
    const [reflectIndex, setReflectIndex] = useState(0);
    const [pendingStatus, setPendingStatus] = useState<Record<string, CheckInCompletionStatus>>({});
    const [choicePickerFor, setChoicePickerFor] = useState<string | null>(null);
    const [completing, setCompleting] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const stepRef = useRef(step);
    const focusHeadingRef = useRef(false);

    const loading = habitsLoading || checkInLoading;
    const dateLabel = useMemo(
        () => format(parse(dayKey, 'yyyy-MM-dd', new Date()), 'EEE, MMM d').toUpperCase(),
        [dayKey],
    );

    // ─── Derived rows (entries are completion truth) ───────────────────────

    const habitById = useMemo(() => new Map(habits.map(habit => [habit.id, habit])), [habits]);
    const categoryColorById = useMemo(() => new Map(categories.map(category => [category.id, category.color])), [categories]);
    const colorFor = useCallback(
        (habit: Habit) => categoryColorById.get(getEffectiveCategoryId(habit, habitById)),
        [categoryColorById, habitById],
    );

    const rows: CheckInRow[] = useMemo(
        () => getCheckInHabits(habits, categories, dayKey).map(habit => {
            const truth = getCheckInHabitTruth(habit, logs, dayKey);
            const reflection = draft?.habits[habit.id];
            return {
                habit,
                truth,
                reflection,
                status: pendingStatus[habit.id] ?? resolveCheckInStatus(truth, reflection?.completionStatus),
            };
        }),
        [habits, categories, logs, dayKey, draft, pendingStatus],
    );
    const reflectRows = useMemo(() => rows.filter(row => needsReflection(row.status)), [rows]);
    const unmarkedCount = rows.filter(row => row.status === null).length;
    const summary = useMemo(() => buildCheckInSummary(rows), [rows]);
    const currentReflectIndex = Math.min(reflectIndex, Math.max(reflectRows.length - 1, 0));

    const progressByHabitId = useMemo(
        () => new Map((progress?.habitsToday ?? []).map(entry => [entry.habit.id, entry])),
        [progress],
    );
    const streakLabelFor = (habitId: string): string | null => {
        const entry = progressByHabitId.get(habitId);
        return !hideStreaks && entry && entry.currentStreak > 0 ? formatStreakLabel(entry.formattedStreak) : null;
    };
    // Celebrate the longest streak kept alive today (done habits only).
    const bestStreak = useMemo(() => {
        if (hideStreaks) return null;
        let best: { habitName: string; label: string; streak: number } | null = null;
        for (const row of rows) {
            if (row.status !== 'done') continue;
            const entry = progressByHabitId.get(row.habit.id);
            if (entry && entry.currentStreak > 0 && (!best || entry.currentStreak > best.streak)) {
                best = { habitName: row.habit.name, label: formatStreakLabel(entry.formattedStreak), streak: entry.currentStreak };
            }
        }
        return best;
    }, [hideStreaks, rows, progressByHabitId]);
    const momentum = progress?.momentum?.global
        ? { state: progress.momentum.global.state, copy: progress.momentum.global.copy }
        : null;

    // ─── Navigation (URL step + browser history) ───────────────────────────

    const applyStep = (next: number) => {
        const previous = stepRef.current;
        stepRef.current = next;
        if (next === 3 || next === 4) {
            // Forward: resume at the first habit still missing an answer. Back: land on the last habit.
            const key = next === 3 ? 'moodScore' : 'effortScore';
            const firstOpen = reflectRows.findIndex(row => row.reflection?.[key] == null);
            setReflectIndex(next > previous ? Math.max(firstOpen, 0) : Math.max(reflectRows.length - 1, 0));
        }
        if (next === CHECK_IN_LAST_STEP) refreshProgress();
        focusHeadingRef.current = true;
        setStep(next);
    };
    const applyStepRef = useRef(applyStep);
    applyStepRef.current = applyStep;

    const navigateToStep = (next: number, mode: 'push' | 'replace' = 'push') => {
        const params = new URLSearchParams(window.location.search);
        params.set('view', 'check-in');
        params.set('step', String(next));
        const url = `${window.location.pathname}?${params.toString()}`;
        // Embedded previews must not grow the parent page's history.
        const pushed = mode === 'push' && !isEmbedMode();
        const state: CheckInHistoryState = { view: 'check-in', step: next, prevStep: stepRef.current, pushed };
        if (pushed) window.history.pushState(state, '', url);
        else window.history.replaceState(state, '', url);
        applyStep(next);
    };

    useEffect(() => {
        const onPopState = () => {
            const params = new URLSearchParams(window.location.search);
            if (params.get('view') === 'check-in') applyStepRef.current(parseCheckInStep(params.get('step')));
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    // Remember where the user is so "Continue" resumes there. The intro never
    // moves the resume point, and a finished check-in has nothing to resume.
    useEffect(() => {
        if (loading || step < 2 || phase === 'complete') return;
        saveResumeStep(step);
    }, [loading, step, phase, saveResumeStep]);

    // Announce each new page/habit to assistive tech and start at the top.
    useEffect(() => {
        if (!focusHeadingRef.current) return;
        focusHeadingRef.current = false;
        headingRef.current?.focus({ preventScroll: true });
        scrollAppToTop();
    }, [step, currentReflectIndex]);

    const showReflectIndex = (index: number) => {
        focusHeadingRef.current = true;
        setReflectIndex(index);
    };

    const goNext = () => {
        if ((step === 3 || step === 4) && currentReflectIndex < reflectRows.length - 1) {
            showReflectIndex(currentReflectIndex + 1);
            return;
        }
        navigateToStep(getNextStep(step, reflectRows.length));
    };

    const goBack = () => {
        if ((step === 3 || step === 4) && currentReflectIndex > 0) {
            showReflectIndex(currentReflectIndex - 1);
            return;
        }
        if (step === 1) {
            onExit();
            return;
        }
        const previous = getPreviousStep(step, reflectRows.length);
        const state = window.history.state as Partial<CheckInHistoryState> | null;
        if (state?.view === 'check-in' && state.pushed && state.step === step && state.prevStep === previous) {
            window.history.back(); // popstate applies the step
        } else {
            navigateToStep(previous, 'replace');
        }
    };

    const startOrContinue = () => {
        if (phase === 'in_progress' && draft) navigateToStep(Math.max(draft.currentStep, 2));
        else navigateToStep(2);
    };

    // ─── Completion changes (through the existing habit store) ────────────

    const withPending = async (habitId: string, status: CheckInCompletionStatus, action: () => Promise<void>) => {
        setPendingStatus(previous => ({ ...previous, [habitId]: status }));
        try {
            await action();
        } finally {
            setPendingStatus(previous => {
                const next = { ...previous };
                delete next[habitId];
                return next;
            });
        }
    };

    /** Same completion value the rest of the app writes (boolean 1, numeric target). */
    const writeCompletion = async (habit: Habit): Promise<boolean> => {
        const value = getCompletionEntryValue(habit, dayKey);
        if (value === null) {
            showToast(`"${habit.name}" needs a valid target before it can be marked done.`, 'error');
            return false;
        }
        await upsertHabitEntry(habit.id, dayKey, { value, source: 'manual' });
        return true;
    };

    /** Un-complete exactly like unchecking in the Today view (soft delete). */
    const clearCompletion = async (row: CheckInRow) => {
        const isBundle = row.truth.kind === 'checklist' || row.truth.kind === 'choice';
        const habitIds = isBundle
            ? (row.habit.subHabitIds ?? []).filter(childId => logs[`${childId}-${dayKey}`])
            : [row.habit.id];
        for (const habitId of habitIds) {
            await deleteHabitEntryByKey(habitId, dayKey);
        }
    };

    /** Once entries say "done", a declared partial/skipped is stale. */
    const clearDeclaredStatus = (row: CheckInRow) => {
        if (row.reflection?.completionStatus) updateHabit(row.habit.id, { completionStatus: null });
    };

    const handleSelect = (row: CheckInRow, status: CheckInCompletionStatus) => {
        const { habit, truth } = row;
        if (pendingStatus[habit.id]) return;
        if (!(status === 'done' && truth.kind === 'choice')) {
            setChoicePickerFor(current => (current === habit.id ? null : current));
        }

        if (status === 'done') {
            if (truth.isComplete) {
                clearDeclaredStatus(row);
                return;
            }
            if (truth.kind === 'choice') {
                setChoicePickerFor(habit.id);
                return;
            }
            void withPending(habit.id, 'done', async () => {
                let completed = true;
                if (truth.kind === 'checklist') await toggleHabit(habit.id, dayKey); // completes every item
                else completed = await writeCompletion(habit);
                if (completed) clearDeclaredStatus(row);
            });
            return;
        }

        updateHabit(habit.id, { completionStatus: status });
        if (truth.isComplete) void withPending(habit.id, status, () => clearCompletion(row));
    };

    const handlePickChoice = (row: CheckInRow, option: Habit) => {
        if (pendingStatus[row.habit.id]) return;
        void withPending(row.habit.id, 'done', async () => {
            if (await writeCompletion(option)) {
                clearDeclaredStatus(row);
                setChoicePickerFor(null);
            }
        });
    };

    const handleSavePartialAmount = (row: CheckInRow, value: number) => {
        void withPending(row.habit.id, 'partial', async () => {
            if (value > 0) await upsertHabitEntry(row.habit.id, dayKey, { value, source: 'manual' });
            else if (logs[`${row.habit.id}-${dayKey}`]) await deleteHabitEntryByKey(row.habit.id, dayKey);
            // Reaching the target makes it done (entries win), so drop the stale declaration.
            if (row.truth.targetValue > 0 && value >= row.truth.targetValue) clearDeclaredStatus(row);
        });
    };

    const handleComplete = async () => {
        if (completing) return;
        setCompleting(true);
        const wasComplete = phase === 'complete';
        const synced = await complete();
        setCompleting(false);
        if (readOnly) showToast('Demo check-in finished — nothing was saved.', 'info');
        else if (!synced) showToast('Check-in saved on this device. It will sync when you are back online.', 'info');
        else showToast(wasComplete ? 'Check-in updated.' : 'Daily check-in complete — nice work!', 'success');
        onExit();
    };

    // ─── Render ────────────────────────────────────────────────────────────

    const reflectRow = reflectRows[currentReflectIndex];
    const isCycling = (step === 3 || step === 4) && reflectRows.length > 0;
    const minutesLeft = estimateCheckInMinutes(step, rows.map(row => row.status));

    let primaryLabel: string;
    let onPrimary: () => void = goNext;
    if (step === 1) {
        if (rows.length === 0) {
            primaryLabel = 'Back to Dashboard';
            onPrimary = onExit;
        } else {
            primaryLabel = phase === 'complete'
                ? 'Review Check-in'
                : phase === 'in_progress' ? 'Continue Daily Check-in' : 'Start Daily Check-in';
            onPrimary = startOrContinue;
        }
    } else if (step === 2) {
        primaryLabel = reflectRows.length > 0 ? 'Continue to Reflection' : 'Continue';
    } else if (isCycling && currentReflectIndex < reflectRows.length - 1) {
        primaryLabel = 'Next habit';
    } else if (step === CHECK_IN_LAST_STEP) {
        primaryLabel = phase === 'complete' ? 'Save & Close' : 'Complete Check-in';
        onPrimary = () => { void handleComplete(); };
    } else {
        primaryLabel = 'Continue';
    }

    const backLabel = step === 1
        ? 'Back to Dashboard'
        : isCycling && currentReflectIndex > 0 ? 'Previous habit' : 'Previous page';

    const footer = (
        <div className="flex flex-col gap-1">
            {step === 2 && unmarkedCount > 0 && !loading && (
                <p className="pb-2 text-center text-xs text-neutral-400">
                    {unmarkedCount} {unmarkedCount === 1 ? 'habit' : 'habits'} not marked yet — that's okay.
                </p>
            )}
            {saveError && step > 1 && (
                <p role="status" className="pb-2 text-center text-xs text-amber-300">{saveError}</p>
            )}
            <button
                type="button"
                onClick={onPrimary}
                disabled={loading || completing}
                aria-busy={completing || undefined}
                className={PRIMARY_BUTTON}
            >
                {completing && <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" />}
                {primaryLabel}
                {!completing && <ArrowRight size={20} aria-hidden="true" />}
            </button>
            {step > 1 && (
                <button type="button" onClick={onExit} className={SECONDARY_TEXT_BUTTON}>
                    Finish later
                </button>
            )}
        </div>
    );

    return (
        <CheckInLayout
            step={step}
            totalSteps={DAILY_CHECK_IN_STEP_COUNT}
            minutesLeft={minutesLeft}
            title={STEP_COPY[step].title}
            subtitle={STEP_COPY[step].subtitle}
            headingRef={headingRef}
            backLabel={backLabel}
            onBack={goBack}
            footer={footer}
        >
            {loading ? (
                <div className="flex items-center justify-center py-16" role="status">
                    <Loader2 size={28} className="text-emerald-500 motion-safe:animate-spin" aria-hidden="true" />
                    <span className="sr-only">Loading your check-in…</span>
                </div>
            ) : step === 1 ? (
                <IntroStep
                    rows={rows}
                    colorFor={colorFor}
                    dateLabel={dateLabel}
                    resumeStep={phase === 'in_progress' && draft ? Math.max(draft.currentStep, 2) : null}
                />
            ) : step === 2 ? (
                rows.length === 0 ? (
                    <p className="text-center text-sm text-neutral-400">No habits are scheduled for today.</p>
                ) : (
                    <ul className="flex flex-col gap-3" aria-label="Today's habits">
                        {rows.map(row => {
                            const choiceOptions = row.truth.kind === 'choice'
                                ? (row.habit.subHabitIds ?? [])
                                    .map(id => habitById.get(id))
                                    .filter((option): option is Habit => !!option)
                                : [];
                            return (
                                <HabitCompletionCard
                                    key={row.habit.id}
                                    row={row}
                                    color={colorFor(row.habit)}
                                    streakLabel={streakLabelFor(row.habit.id)}
                                    busy={Boolean(pendingStatus[row.habit.id])}
                                    choiceOptions={choiceOptions}
                                    completedChoiceIds={new Set(
                                        choiceOptions
                                            .filter(option => logs[`${option.id}-${dayKey}`]?.completed)
                                            .map(option => option.id),
                                    )}
                                    showChoicePicker={choicePickerFor === row.habit.id}
                                    onSelect={status => handleSelect(row, status)}
                                    onPickChoice={option => handlePickChoice(row, option)}
                                    onSavePartialAmount={value => handleSavePartialAmount(row, value)}
                                />
                            );
                        })}
                    </ul>
                )
            ) : step === 3 ? (
                <MoodStep
                    row={reflectRow}
                    index={currentReflectIndex}
                    count={reflectRows.length}
                    colorFor={colorFor}
                    onMoodChange={(habitId, score) => updateHabit(habitId, { moodScore: score })}
                    onTagsChange={(habitId, tags) => updateHabit(habitId, { moodTags: tags })}
                />
            ) : step === 4 ? (
                <EffortStep
                    row={reflectRow}
                    index={currentReflectIndex}
                    count={reflectRows.length}
                    colorFor={colorFor}
                    onEffortChange={(habitId, score) => updateHabit(habitId, { effortScore: score })}
                />
            ) : (
                <WrapUpStep
                    rows={rows}
                    colorFor={colorFor}
                    summary={summary}
                    bestStreak={bestStreak}
                    momentum={momentum}
                    onJournalChange={(habitId, text) => updateHabit(habitId, { journalEntry: text === '' ? null : text })}
                />
            )}
        </CheckInLayout>
    );
};
