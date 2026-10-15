import React from 'react';
import { ChevronLeft, Clock } from 'lucide-react';
import { cn } from '../../utils/cn';
import { FOCUS_RING } from './checkInStyles';

interface CheckInLayoutProps {
    step: number;
    totalSteps: number;
    minutesLeft: number;
    title: string;
    subtitle?: React.ReactNode;
    headingRef: React.Ref<HTMLHeadingElement>;
    backLabel: string;
    onBack: () => void;
    /** Primary action(s), kept reachable above the bottom tab bar. */
    footer: React.ReactNode;
    children: React.ReactNode;
}

/**
 * Shell for every Daily Check-in page: back control, segmented progress
 * ("Page X / 5", exposed to assistive tech as "Step X of 5"), time estimate,
 * heading, and a sticky primary action. Constrained to a phone-width column
 * on larger screens.
 */
export const CheckInLayout: React.FC<CheckInLayoutProps> = ({
    step,
    totalSteps,
    minutesLeft,
    title,
    subtitle,
    headingRef,
    backLabel,
    onBack,
    footer,
    children,
}) => (
    <div className="mx-auto flex w-full max-w-lg flex-col">
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={onBack}
                aria-label={backLabel}
                className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-800/60 text-neutral-300 hover:bg-neutral-700 hover:text-white motion-safe:transition-colors',
                    FOCUS_RING,
                )}
            >
                <ChevronLeft size={20} aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
                <div
                    role="progressbar"
                    aria-label="Daily check-in progress"
                    aria-valuemin={1}
                    aria-valuemax={totalSteps}
                    aria-valuenow={step}
                    aria-valuetext={`Step ${step} of ${totalSteps}`}
                    className="flex gap-1.5"
                >
                    {Array.from({ length: totalSteps }, (_, index) => (
                        <span
                            key={index}
                            className={cn(
                                'h-1.5 flex-1 rounded-full motion-safe:transition-colors motion-safe:duration-500',
                                index < step ? 'bg-emerald-400' : 'bg-neutral-700',
                            )}
                        />
                    ))}
                </div>
                <p className="mt-1.5 text-center text-xs font-medium text-neutral-400" aria-hidden="true">
                    Page {step} / {totalSteps}
                </p>
            </div>

            <p className="flex shrink-0 items-center gap-1 text-xs font-medium text-neutral-400">
                <Clock size={14} aria-hidden="true" />
                <span>
                    <span className="sr-only">About </span>~{minutesLeft} min<span className="sr-only"> left</span>
                </span>
            </p>
        </div>

        <header className="mt-6 text-center">
            <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-3xl font-bold tracking-tight text-white outline-none sm:text-4xl"
            >
                {title}
            </h2>
            {subtitle && <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-400 sm:text-base">{subtitle}</p>}
        </header>

        <div className="mt-6 flex flex-col gap-4">{children}</div>

        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-10 -mx-4 mt-8 bg-neutral-900 px-4 pb-3 pt-2">
            {/* Fade content out as it scrolls under the action bar. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-neutral-900 to-transparent"
            />
            {footer}
        </div>
    </div>
);
