import React, { useRef } from 'react';
import { cn } from '../../utils/cn';
import { EFFORT_OPTIONS, getEffortOption, getRadioKeyTarget } from './checkInModel';
import { FOCUS_RING } from './checkInStyles';

interface EffortSelectorProps {
    value: number | null;
    onChange: (score: number) => void;
    labelledBy: string;
}

/** 1–5 perceived effort as large radio targets, with the active score shown prominently. */
export const EffortSelector: React.FC<EffortSelectorProps> = ({ value, onChange, labelledBy }) => {
    const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
    const selected = getEffortOption(value);
    const selectedIndex = EFFORT_OPTIONS.findIndex(option => option.score === value);
    const tabStopIndex = selectedIndex >= 0 ? selectedIndex : 0;

    return (
        <div>
            <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-5 gap-2 sm:gap-3">
                {EFFORT_OPTIONS.map((option, index) => {
                    const isSelected = option.score === value;
                    return (
                        <button
                            key={option.score}
                            ref={element => { buttonsRef.current[index] = element; }}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={`${option.score}, ${option.label}`}
                            tabIndex={index === tabStopIndex ? 0 : -1}
                            onClick={() => onChange(option.score)}
                            onKeyDown={event => {
                                const target = getRadioKeyTarget(event.key, index, EFFORT_OPTIONS.length);
                                if (target === null) return;
                                event.preventDefault();
                                onChange(EFFORT_OPTIONS[target].score);
                                buttonsRef.current[target]?.focus();
                            }}
                            className={cn(
                                'flex aspect-square min-h-[48px] items-center justify-center rounded-full border text-xl font-bold motion-safe:transition-all motion-safe:duration-200',
                                FOCUS_RING,
                                isSelected
                                    ? 'scale-105 border-emerald-300 bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/30'
                                    : 'border-white/15 bg-neutral-900/60 text-neutral-300 hover:border-white/30 hover:text-white',
                            )}
                        >
                            {option.score}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-neutral-400" aria-hidden="true">
                <span>Very easy</span>
                <span>Very hard</span>
            </div>

            <div aria-live="polite" className="mt-4 flex min-h-[3.5rem] items-center justify-center gap-4 text-center">
                {selected ? (
                    <>
                        <p className="text-4xl font-bold text-white">
                            {selected.score}
                            <span className="text-lg font-semibold text-neutral-500">/5</span>
                        </p>
                        <div className="text-left">
                            <p className="text-base font-semibold text-emerald-300">{selected.label}</p>
                            <p className="text-sm text-neutral-400">{selected.hint}</p>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-neutral-500">Tap a number — one tap is enough.</p>
                )}
            </div>
        </div>
    );
};
