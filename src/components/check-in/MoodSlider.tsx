import React, { useRef } from 'react';
import { cn } from '../../utils/cn';
import { MOOD_OPTIONS, getRadioKeyTarget } from './checkInModel';
import { FOCUS_RING } from './checkInStyles';

interface MoodSliderProps {
    value: number | null;
    onChange: (score: number) => void;
    /** id of the visible question labelling the scale. */
    labelledBy: string;
}

/**
 * Five-point emoji scale. The emojis are a radio group ("4 of 5, Good") with
 * arrow-key support, so the value is always available as text; the track
 * underneath mirrors the selection and can be tapped or dragged like a slider.
 */
export const MoodSlider: React.FC<MoodSliderProps> = ({ value, onChange, labelledBy }) => {
    const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
    const trackRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);

    const selectedIndex = MOOD_OPTIONS.findIndex(option => option.score === value);
    const selected = selectedIndex >= 0 ? MOOD_OPTIONS[selectedIndex] : undefined;
    // Roving tab stop: the selected emoji, else the neutral middle one.
    const tabStopIndex = selectedIndex >= 0 ? selectedIndex : Math.floor(MOOD_OPTIONS.length / 2);
    const lastIndex = MOOD_OPTIONS.length - 1;
    const position = selectedIndex >= 0 ? (selectedIndex / lastIndex) * 100 : null;

    const selectFromPointer = (clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        const score = MOOD_OPTIONS[Math.round(ratio * lastIndex)].score;
        if (score !== value) onChange(score);
    };

    return (
        <div>
            <div role="radiogroup" aria-labelledby={labelledBy} className="flex items-center justify-between">
                {MOOD_OPTIONS.map((option, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                        <button
                            key={option.score}
                            ref={element => { buttonsRef.current[index] = element; }}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={`${option.score} of 5, ${option.label}`}
                            tabIndex={index === tabStopIndex ? 0 : -1}
                            onClick={() => onChange(option.score)}
                            onKeyDown={event => {
                                const target = getRadioKeyTarget(event.key, index, MOOD_OPTIONS.length);
                                if (target === null) return;
                                event.preventDefault();
                                onChange(MOOD_OPTIONS[target].score);
                                buttonsRef.current[target]?.focus();
                            }}
                            className={cn(
                                'flex h-14 w-14 items-center justify-center rounded-full text-[2rem] leading-none motion-safe:transition-transform motion-safe:duration-200',
                                FOCUS_RING,
                                isSelected
                                    ? 'scale-110 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.45)] ring-[3px] ring-emerald-400'
                                    : 'opacity-70 hover:opacity-100 motion-safe:hover:scale-105',
                            )}
                        >
                            <span aria-hidden="true">{option.emoji}</span>
                        </button>
                    );
                })}
            </div>

            {/* Decorative, pointer-only mirror of the radio group (keyboard and
                screen-reader users use the emojis above). */}
            <div className="mt-3 px-7" aria-hidden="true">
                <div
                    ref={trackRef}
                    className="relative h-8 cursor-pointer touch-none"
                    onPointerDown={event => {
                        draggingRef.current = true;
                        event.currentTarget.setPointerCapture?.(event.pointerId);
                        selectFromPointer(event.clientX);
                    }}
                    onPointerMove={event => {
                        if (draggingRef.current) selectFromPointer(event.clientX);
                    }}
                    onPointerUp={() => { draggingRef.current = false; }}
                    onPointerCancel={() => { draggingRef.current = false; }}
                >
                    <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-700">
                        {position !== null && (
                            <div
                                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 motion-safe:transition-[width] motion-safe:duration-200"
                                style={{ width: `${position}%` }}
                            />
                        )}
                        {MOOD_OPTIONS.map((option, index) => (
                            <span
                                key={option.score}
                                className="absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50"
                                style={{ left: `${(index / lastIndex) * 100}%` }}
                            />
                        ))}
                    </div>
                    {position !== null && (
                        <span
                            className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-emerald-400 shadow-lg shadow-emerald-500/30 motion-safe:transition-[left] motion-safe:duration-200"
                            style={{ left: `${position}%` }}
                        />
                    )}
                </div>
            </div>

            <div className="mt-1 flex justify-between text-xs text-neutral-400" aria-hidden="true">
                <span>Really tough</span>
                <span>Felt great</span>
            </div>

            <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-center text-sm font-semibold text-emerald-300">
                {selected ? selected.label : <span className="font-normal text-neutral-500">Tap an emoji or slide to choose</span>}
            </p>
        </div>
    );
};
