import React from 'react';
import { CircleCheck, CircleX, Contrast } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { CheckInCompletionStatus } from './checkInModel';
import { FOCUS_RING } from './checkInStyles';

const OPTIONS = [
    { value: 'done', label: 'Done', Icon: CircleCheck },
    { value: 'partial', label: 'Partial', Icon: Contrast },
    { value: 'skipped', label: 'Skip', Icon: CircleX },
] as const;

const SELECTED_STYLES: Record<CheckInCompletionStatus, string> = {
    done: 'border-emerald-400 bg-emerald-500 font-semibold text-neutral-950',
    partial: 'border-emerald-400 bg-emerald-500/10 font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400',
    skipped: 'border-rose-400 bg-rose-500/10 font-semibold text-rose-300 ring-1 ring-inset ring-rose-400',
};

interface CompletionStateSelectorProps {
    habitName: string;
    value: CheckInCompletionStatus | null;
    /** A write for this habit is in flight; taps are ignored until it settles. */
    busy?: boolean;
    onSelect: (status: CheckInCompletionStatus) => void;
}

/**
 * Done / Partial / Skip. Toggle buttons (aria-pressed) rather than a radio
 * group: Done and Partial/Skip write habit entries, so arrow-key focus moves
 * must never change the selection by accident. State is conveyed by fill,
 * outline and weight as well as color.
 */
export const CompletionStateSelector: React.FC<CompletionStateSelectorProps> = ({ habitName, value, busy, onSelect }) => (
    <div role="group" aria-label={`How did ${habitName} go?`} aria-busy={busy || undefined} className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value: option, label, Icon }) => {
            const selected = value === option;
            return (
                <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                        if (!busy) onSelect(option);
                    }}
                    className={cn(
                        'flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm motion-safe:transition-all motion-safe:duration-200',
                        FOCUS_RING,
                        selected
                            ? SELECTED_STYLES[option]
                            : 'border-white/10 bg-neutral-900/60 font-medium text-neutral-300 hover:border-white/25 hover:text-white',
                        busy && 'cursor-progress opacity-70',
                    )}
                >
                    <Icon size={18} aria-hidden="true" strokeWidth={selected ? 2.5 : 2} />
                    {label}
                </button>
            );
        })}
    </div>
);
