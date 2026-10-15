/**
 * Daily Check-in class tokens — built from the app's existing palette
 * (neutral surfaces, emerald accent) so the flow matches the rest of HabitFlow.
 */

export const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900';

export const CARD = 'rounded-2xl border border-white/[0.06] bg-neutral-800/30';

export const PRIMARY_BUTTON =
    `flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-bold text-neutral-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors ${FOCUS_RING}`;

export const SECONDARY_TEXT_BUTTON =
    `mx-auto block min-h-[44px] rounded-lg px-4 text-sm font-medium text-neutral-400 hover:text-white motion-safe:transition-colors ${FOCUS_RING}`;
