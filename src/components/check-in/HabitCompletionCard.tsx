import React, { useId, useState } from 'react';
import { Check, Flame } from 'lucide-react';
import type { Habit } from '../../types';
import { cn } from '../../utils/cn';
import type { CheckInCompletionStatus, CheckInRow } from './checkInModel';
import { CARD, FOCUS_RING } from './checkInStyles';
import { CompletionStateSelector } from './CompletionStateSelector';
import { HabitTile } from './HabitTile';

interface HabitCompletionCardProps {
    row: CheckInRow;
    color?: string;
    /** e.g. "12 day streak"; omitted when streaks are hidden or not running. */
    streakLabel?: string | null;
    busy: boolean;
    /** Choice bundle options (child habits). */
    choiceOptions: Habit[];
    completedChoiceIds: Set<string>;
    showChoicePicker: boolean;
    onSelect: (status: CheckInCompletionStatus) => void;
    onPickChoice: (option: Habit) => void;
    onSavePartialAmount: (value: number) => void;
}

function formatAmount(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const PartialAmountInput: React.FC<{
    habitName: string;
    currentValue: number;
    targetValue: number;
    unit?: string;
    busy: boolean;
    onSave: (value: number) => void;
}> = ({ habitName, currentValue, targetValue, unit, busy, onSave }) => {
    const inputId = useId();
    const [amount, setAmount] = useState(currentValue > 0 ? String(currentValue) : '');
    const parsed = Number(amount);
    const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;

    return (
        <form
            className="mt-3 rounded-xl bg-neutral-900/60 p-3"
            onSubmit={event => {
                event.preventDefault();
                if (valid && !busy) onSave(parsed);
            }}
        >
            <label htmlFor={inputId} className="block text-sm text-neutral-300">
                How much did you get<span className="sr-only"> for {habitName}</span>?
            </label>
            <div className="mt-2 flex items-center gap-2">
                <input
                    id={inputId}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={amount}
                    onChange={event => setAmount(event.target.value)}
                    className={cn('min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-base text-white', FOCUS_RING)}
                />
                <span className="shrink-0 text-sm text-neutral-400">
                    of {formatAmount(targetValue)}{unit ? ` ${unit}` : ''}
                </span>
                <button
                    type="submit"
                    disabled={!valid || busy}
                    className={cn(
                        'min-h-[44px] shrink-0 rounded-lg border border-emerald-400/60 px-4 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50',
                        FOCUS_RING,
                    )}
                >
                    Save
                </button>
            </div>
        </form>
    );
};

/** Page 2 card: one habit with Done / Partial / Skip. */
export const HabitCompletionCard: React.FC<HabitCompletionCardProps> = ({
    row,
    color,
    streakLabel,
    busy,
    choiceOptions,
    completedChoiceIds,
    showChoicePicker,
    onSelect,
    onPickChoice,
    onSavePartialAmount,
}) => {
    const { habit, truth, status } = row;
    const pickerLabelId = useId();
    const completedChoices = choiceOptions.filter(option => completedChoiceIds.has(option.id));

    let detail: string | null = null;
    if (truth.kind === 'numeric' && truth.targetValue > 0) {
        detail = `${formatAmount(truth.currentValue)} / ${formatAmount(truth.targetValue)}${truth.unit ? ` ${truth.unit}` : ''}`;
    } else if (truth.kind === 'checklist') {
        detail = `${truth.currentValue}/${truth.targetValue} items`;
    } else if (truth.kind === 'choice' && completedChoices.length > 0) {
        detail = completedChoices.map(option => option.name).join(', ');
    }

    return (
        <li className={cn(CARD, 'list-none p-4')}>
            <div className="flex items-center gap-3">
                <HabitTile name={habit.name} color={color} />
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-white">{habit.name}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-neutral-400">
                        {streakLabel && (
                            <span className="flex items-center gap-1">
                                <Flame size={14} className="text-orange-400" aria-hidden="true" />
                                {streakLabel}
                            </span>
                        )}
                        {detail && <span className="truncate">{detail}</span>}
                    </div>
                </div>
            </div>

            <div className="mt-3">
                <CompletionStateSelector habitName={habit.name} value={status} busy={busy} onSelect={onSelect} />
            </div>

            {truth.kind === 'numeric' && status === 'partial' && truth.targetValue > 0 && (
                <PartialAmountInput
                    habitName={habit.name}
                    currentValue={truth.currentValue}
                    targetValue={truth.targetValue}
                    unit={truth.unit}
                    busy={busy}
                    onSave={onSavePartialAmount}
                />
            )}

            {showChoicePicker && choiceOptions.length > 0 && (
                <div className="mt-3 rounded-xl bg-neutral-900/60 p-3">
                    <p id={pickerLabelId} className="text-sm text-neutral-300" aria-live="polite">
                        Which one did you do?
                    </p>
                    <div role="group" aria-labelledby={pickerLabelId} className="mt-2 flex flex-wrap gap-2">
                        {choiceOptions.map(option => {
                            const done = completedChoiceIds.has(option.id);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    aria-pressed={done}
                                    onClick={() => {
                                        if (!busy && !done) onPickChoice(option);
                                    }}
                                    className={cn(
                                        'flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-sm motion-safe:transition-colors',
                                        FOCUS_RING,
                                        done
                                            ? 'border-emerald-400 bg-emerald-500/15 font-semibold text-emerald-200'
                                            : 'border-white/10 bg-neutral-800 text-neutral-300 hover:border-white/25 hover:text-white',
                                    )}
                                >
                                    {done && <Check size={14} aria-hidden="true" />}
                                    {option.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </li>
    );
};
