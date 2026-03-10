import { useMemo, useCallback, useState } from 'react';
import { format } from 'date-fns';
import { Play, CheckCircle2, Pin, ChevronRight } from 'lucide-react';
import { useRoutineStore } from '../../store/RoutineContext';
import type { Routine } from '../../models/persistenceTypes';

const STORAGE_KEY = 'hf_pinned_routines';

function usePinnedRoutines() {
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const togglePin = useCallback((id: string) => {
        setPinnedIds(prev => {
            const next = prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

    return { pinnedIds, togglePin, isPinned };
}

interface PinnedRoutinesCardProps {
    onStartRoutine: (routine: Routine) => void;
    onViewAllRoutines?: () => void;
}

export const PinnedRoutinesCard: React.FC<PinnedRoutinesCardProps> = ({
    onStartRoutine,
    onViewAllRoutines,
}) => {
    const { routines, routineLogs } = useRoutineStore();
    const { pinnedIds, togglePin, isPinned } = usePinnedRoutines();
    const [showManage, setShowManage] = useState(false);

    const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

    const pinnedRoutines = useMemo(
        () => routines.filter(r => pinnedIds.includes(r.id)),
        [routines, pinnedIds]
    );

    const isCompleted = useCallback(
        (routineId: string) => !!routineLogs[`${routineId}-${today}`],
        [routineLogs, today]
    );

    if (pinnedRoutines.length === 0 && !showManage) {
        return (
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Pinned Routines</h3>
                    <button
                        onClick={() => setShowManage(true)}
                        className="text-[11px] text-neutral-500 hover:text-white transition-colors"
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
                        onClick={() => setShowManage(s => !s)}
                        className={`text-[11px] transition-colors ${showManage ? 'text-emerald-400' : 'text-neutral-500 hover:text-white'}`}
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
                        <button
                            key={routine.id}
                            onClick={() => togglePin(routine.id)}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-neutral-800/50 transition-colors text-left min-h-[44px]"
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
                    ))}
                </div>
            ) : (
                <div className="space-y-1">
                    {pinnedRoutines.map(routine => {
                        const done = isCompleted(routine.id);
                        return (
                            <button
                                key={routine.id}
                                onClick={() => !done && onStartRoutine(routine)}
                                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-neutral-800/50 transition-colors min-h-[44px]"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {done ? (
                                        <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                                    ) : (
                                        <Play size={14} className="text-neutral-500 flex-shrink-0" />
                                    )}
                                    <span className={`text-sm truncate ${done ? 'text-neutral-500' : 'text-white'}`}>
                                        {routine.title}
                                    </span>
                                    <span className="text-[11px] text-neutral-600 flex-shrink-0">
                                        {routine.steps.length} steps
                                    </span>
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
