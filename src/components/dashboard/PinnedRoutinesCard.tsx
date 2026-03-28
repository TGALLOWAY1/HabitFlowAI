import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import {
    Play, CheckCircle2, Pin, ChevronRight, Palette, Layers, Check,
    Dumbbell, BookOpen, Music, Heart, Star, Zap, Sun, Moon,
    Coffee, Flame, Brain, TreePine, Waves, Target, Sparkles,
} from 'lucide-react';
import { useRoutineStore } from '../../store/RoutineContext';
import type { Routine } from '../../models/persistenceTypes';
import { isMultiVariant, resolveVariant } from '../../lib/routineVariantUtils';
import { fetchDashboardPrefs, updateDashboardPrefs } from '../../lib/persistenceClient';

export const PINNED_ROUTINES_STORAGE_KEY = 'hf_pinned_routines';

// Module-level cache so pinned IDs survive component unmounts
let _cachedPinnedIds: string[] | null = null;

const ICON_OPTIONS = [
    { key: 'play', icon: Play, label: 'Play' },
    { key: 'dumbbell', icon: Dumbbell, label: 'Fitness' },
    { key: 'book-open', icon: BookOpen, label: 'Reading' },
    { key: 'music', icon: Music, label: 'Music' },
    { key: 'heart', icon: Heart, label: 'Health' },
    { key: 'star', icon: Star, label: 'Star' },
    { key: 'zap', icon: Zap, label: 'Energy' },
    { key: 'sun', icon: Sun, label: 'Morning' },
    { key: 'moon', icon: Moon, label: 'Evening' },
    { key: 'coffee', icon: Coffee, label: 'Coffee' },
    { key: 'flame', icon: Flame, label: 'Fire' },
    { key: 'brain', icon: Brain, label: 'Mind' },
    { key: 'tree-pine', icon: TreePine, label: 'Nature' },
    { key: 'waves', icon: Waves, label: 'Calm' },
    { key: 'target', icon: Target, label: 'Focus' },
    { key: 'sparkles', icon: Sparkles, label: 'Magic' },
] as const;

const COLOR_OPTIONS = [
    { key: 'neutral', class: 'bg-neutral-500', text: 'text-neutral-500' },
    { key: 'emerald', class: 'bg-emerald-500', text: 'text-emerald-400' },
    { key: 'blue', class: 'bg-blue-500', text: 'text-blue-400' },
    { key: 'purple', class: 'bg-purple-500', text: 'text-purple-400' },
    { key: 'amber', class: 'bg-amber-500', text: 'text-amber-400' },
    { key: 'rose', class: 'bg-rose-500', text: 'text-rose-400' },
    { key: 'cyan', class: 'bg-cyan-500', text: 'text-cyan-400' },
    { key: 'orange', class: 'bg-orange-500', text: 'text-orange-400' },
] as const;

function getIconComponent(key?: string) {
    const match = ICON_OPTIONS.find(o => o.key === key);
    return match?.icon ?? Play;
}

function getColorTextClass(key?: string) {
    const match = COLOR_OPTIONS.find(o => o.key === key);
    return match?.text ?? 'text-neutral-500';
}

function readLocalStorageIds(): string[] {
    try {
        const stored = localStorage.getItem(PINNED_ROUTINES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function __resetPinnedRoutinesCacheForTests() {
    _cachedPinnedIds = null;
}

export function usePinnedRoutines() {
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        // Use module-level cache first (survives unmount), then localStorage
        if (_cachedPinnedIds !== null) return _cachedPinnedIds;
        const fromStorage = readLocalStorageIds();
        _cachedPinnedIds = fromStorage;
        return fromStorage;
    });

    // Keep module cache in sync with state
    useEffect(() => {
        _cachedPinnedIds = pinnedIds;
    }, [pinnedIds]);

    // Hydrate from backend on mount — but don't clobber local data with empty backend
    useEffect(() => {
        let cancelled = false;
        fetchDashboardPrefs()
            .then(prefs => {
                if (cancelled) return;
                const backendIds = prefs.pinnedRoutineIds ?? [];
                // Only overwrite local state if backend actually has data,
                // or if local cache is empty (first load)
                if (backendIds.length > 0 || _cachedPinnedIds === null || _cachedPinnedIds.length === 0) {
                    setPinnedIds(backendIds);
                    _cachedPinnedIds = backendIds;
                    localStorage.setItem(PINNED_ROUTINES_STORAGE_KEY, JSON.stringify(backendIds));
                }
            })
            .catch(() => {
                // Keep localStorage/cache fallback on network failure
            });
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const togglePin = useCallback((id: string) => {
        setPinnedIds(prev => {
            const next = prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id];
            // Update all caches immediately for responsiveness
            _cachedPinnedIds = next;
            localStorage.setItem(PINNED_ROUTINES_STORAGE_KEY, JSON.stringify(next));
            // Persist to backend (fire-and-forget; localStorage is fallback)
            updateDashboardPrefs({ pinnedRoutineIds: next }).catch(() => {});
            return next;
        });
    }, []);

    const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

    return { pinnedIds, togglePin, isPinned };
}

/* ─── Icon/Color Picker Popover ─── */
const CustomizePopover: React.FC<{
    routine: Routine;
    onUpdate: (id: string, patch: { icon?: string; color?: string }) => Promise<void> | void;
    onClose: () => void;
}> = ({ routine, onUpdate, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [selectedColor, setSelectedColor] = useState<string | undefined>(routine.color);
    const [selectedIcon, setSelectedIcon] = useState<string | undefined>(routine.icon);
    const [saving, setSaving] = useState(false);

    const hasChanges = selectedColor !== routine.color || selectedIcon !== routine.icon;

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    const handleApply = async () => {
        const patch: { icon?: string; color?: string } = {};
        if (selectedColor !== routine.color) patch.color = selectedColor;
        if (selectedIcon !== routine.icon) patch.icon = selectedIcon;
        if (Object.keys(patch).length === 0) { onClose(); return; }
        setSaving(true);
        await onUpdate(routine.id, patch);
        setSaving(false);
        onClose();
    };

    return (
        <div
            ref={ref}
            className="absolute right-0 top-full mt-1 z-50 bg-neutral-800 border border-white/10 rounded-xl p-3 shadow-xl w-64"
        >
            {/* Colors */}
            <div className="mb-3">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Color</span>
                <div className="flex flex-wrap gap-2 mt-1.5">
                    {COLOR_OPTIONS.map(c => (
                        <button
                            key={c.key}
                            onClick={() => setSelectedColor(c.key)}
                            className={`w-6 h-6 rounded-full ${c.class} transition-all ${
                                selectedColor === c.key ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-800' : 'hover:scale-110'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Icons */}
            <div className="mb-3">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Icon</span>
                <div className="grid grid-cols-8 gap-1.5 mt-1.5">
                    {ICON_OPTIONS.map(({ key, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setSelectedIcon(key)}
                            className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${
                                selectedIcon === key
                                    ? 'bg-neutral-600 text-white'
                                    : 'text-neutral-400 hover:bg-neutral-700 hover:text-white'
                            }`}
                            title={key}
                        >
                            <Icon size={14} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Apply button */}
            <button
                onClick={handleApply}
                disabled={!hasChanges || saving}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    hasChanges && !saving
                        ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                        : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                }`}
            >
                <Check size={12} />
                {saving ? 'Saving…' : 'Apply'}
            </button>
        </div>
    );
};

interface PinnedRoutinesCardProps {
    onStartRoutine: (routine: Routine) => void;
    onPreviewRoutine?: (routine: Routine) => void;
    onViewAllRoutines?: () => void;
}

export const PinnedRoutinesCard: React.FC<PinnedRoutinesCardProps> = ({
    onStartRoutine,
    onPreviewRoutine,
    onViewAllRoutines,
}) => {
    const { routines, routineLogs, updateRoutine } = useRoutineStore();
    const { pinnedIds, togglePin, isPinned } = usePinnedRoutines();
    const [showManage, setShowManage] = useState(false);
    const [customizingId, setCustomizingId] = useState<string | null>(null);

    const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    const pinnedRoutines = useMemo(
        () => routines.filter(r => pinnedIds.includes(r.id)),
        [routines, pinnedIds]
    );

    const getCompletionInfo = useCallback(
        (routineId: string): { completed: boolean; variantName?: string } => {
            // Check legacy key first
            if (routineLogs[`${routineId}-${today}`]) {
                return { completed: true, variantName: undefined };
            }
            // Check variant-aware keys
            for (const [, log] of Object.entries(routineLogs)) {
                if (log.routineId === routineId && log.date === today) {
                    // Find variant name from the routine
                    const routine = routines.find(r => r.id === routineId);
                    const variant = routine?.variants?.find(v => v.id === log.variantId);
                    return { completed: true, variantName: variant?.name };
                }
            }
            return { completed: false };
        },
        [routineLogs, routines, today]
    );

    const handleCustomize = useCallback(async (id: string, patch: { icon?: string; color?: string }) => {
        try {
            await updateRoutine(id, patch);
        } catch {
            // Silently fail — the UI will still reflect the old value
        }
    }, [updateRoutine]);

    if (pinnedRoutines.length === 0 && !showManage) {
        return (
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Pinned Routines</h3>
                    <button
                        onClick={() => setShowManage(true)}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                        Manage
                    </button>
                </div>
                <p className="text-xs text-neutral-500">
                    Pin routines to see them here.
                    {onViewAllRoutines && (
                        <>
                            {' '}
                            <button
                                onClick={onViewAllRoutines}
                                className="text-emerald-500 hover:text-emerald-400 transition-colors"
                            >
                                View routines
                            </button>
                        </>
                    )}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Pinned Routines</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setShowManage(s => !s);
                            setCustomizingId(null);
                        }}
                        className={`text-[11px] transition-colors ${showManage ? 'text-white' : 'text-emerald-400 hover:text-emerald-300'}`}
                    >
                        {showManage ? 'Done' : 'Manage'}
                    </button>
                    {onViewAllRoutines && (
                        <button
                            onClick={onViewAllRoutines}
                            className="text-[11px] text-neutral-500 hover:text-white transition-colors"
                        >
                            View all
                        </button>
                    )}
                </div>
            </div>

            {showManage ? (
                <div className="space-y-1">
                    {routines.map(routine => (
                        <div key={routine.id} className="relative flex items-center gap-2">
                            <button
                                onClick={() => togglePin(routine.id)}
                                className="flex items-center gap-3 flex-1 px-3 py-2.5 rounded-lg hover:bg-neutral-800/50 transition-colors text-left min-h-[44px]"
                            >
                                <Pin
                                    size={14}
                                    className={isPinned(routine.id) ? 'text-emerald-400' : 'text-neutral-600'}
                                    fill={isPinned(routine.id) ? 'currentColor' : 'none'}
                                />
                                <span className={`text-sm ${isPinned(routine.id) ? 'text-white' : 'text-neutral-400'}`}>
                                    {routine.title}
                                </span>
                            </button>
                            <button
                                onClick={() => setCustomizingId(customizingId === routine.id ? null : routine.id)}
                                className="p-2 rounded-md hover:bg-neutral-700 transition-colors text-neutral-500 hover:text-white flex-shrink-0"
                                title="Customize icon & color"
                            >
                                <Palette size={14} />
                            </button>
                            {customizingId === routine.id && (
                                <CustomizePopover
                                    routine={routine}
                                    onUpdate={handleCustomize}
                                    onClose={() => setCustomizingId(null)}
                                />
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-1">
                    {pinnedRoutines.map(routine => {
                        const completionInfo = getCompletionInfo(routine.id);
                        const done = completionInfo.completed;
                        const IconComp = getIconComponent(routine.icon);
                        const colorClass = routine.color
                            ? getColorTextClass(routine.color)
                            : (done ? 'text-emerald-400' : 'text-neutral-500');
                        const hasMultiple = isMultiVariant(routine);
                        const defaultVariant = resolveVariant(routine);
                        const resolvedSteps = defaultVariant?.steps || routine.steps || [];

                        const handleClick = () => {
                            if (done) return;
                            // Multi-variant routines open preview for variant selection
                            if (hasMultiple && onPreviewRoutine) {
                                onPreviewRoutine(routine);
                            } else {
                                onStartRoutine(routine);
                            }
                        };

                        return (
                            <button
                                key={routine.id}
                                onClick={handleClick}
                                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-neutral-800/50 transition-colors min-h-[44px]"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {done ? (
                                        <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                                    ) : (
                                        <IconComp size={14} className={`${colorClass} flex-shrink-0`} />
                                    )}
                                    <span className={`text-sm truncate ${done ? 'text-neutral-500' : 'text-white'}`}>
                                        {routine.title}
                                        {done && completionInfo.variantName && (
                                            <span className="text-emerald-500/60 ml-1">({completionInfo.variantName})</span>
                                        )}
                                    </span>
                                    <span className="text-[11px] text-neutral-600 flex-shrink-0">
                                        {resolvedSteps.length} steps
                                    </span>
                                    {hasMultiple && !done && (
                                        <span className="flex items-center gap-1 text-[10px] text-purple-400/80 bg-purple-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                            <Layers size={10} />
                                            {routine.variants!.length}
                                        </span>
                                    )}
                                </div>
                                {done ? (
                                    <span className="text-[11px] text-emerald-400 font-medium flex-shrink-0">Done</span>
                                ) : (
                                    <ChevronRight size={14} className="text-neutral-600 flex-shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
