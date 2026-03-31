import { useState } from 'react';
import { X, Layers, Search, CheckSquare, ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';
import { useHabitStore } from '../store/HabitContext';
import { useToast } from './Toast';
import { createBundleMembership } from '../lib/persistenceClient';
import { format } from 'date-fns';

interface BundlePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    habitId: string;
    habitName: string;
}

export const BundlePickerModal = ({
    isOpen,
    onClose,
    habitId,
    habitName,
}: BundlePickerModalProps) => {
    const { habits, updateHabit } = useHabitStore();
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const [isMoving, setIsMoving] = useState(false);

    if (!isOpen) return null;

    const bundles = habits.filter(h =>
        h.type === 'bundle' &&
        !h.archived &&
        !h.subHabitIds?.includes(habitId) &&
        h.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = async (bundle: typeof bundles[0]) => {
        if (isMoving) return;
        setIsMoving(true);

        try {
            const todayDayKey = format(new Date(), 'yyyy-MM-dd');

            // 1. Set child's bundleParentId
            await updateHabit(habitId, { bundleParentId: bundle.id });

            // 2. Update parent's subHabitIds
            const existingIds = bundle.subHabitIds || [];
            await updateHabit(bundle.id, { subHabitIds: [...existingIds, habitId] });

            // 3. Create temporal membership
            try {
                await createBundleMembership({
                    parentHabitId: bundle.id,
                    childHabitId: habitId,
                    activeFromDayKey: todayDayKey,
                });
            } catch (_e) { /* best-effort — membership creation may fail for edge cases */ }

            showToast(
                `Added "${habitName}" to ${bundle.name}`,
                'success'
            );
            onClose();
        } catch {
            showToast('Failed to add habit to bundle. Please try again.', 'error');
        } finally {
            setIsMoving(false);
        }
    };

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className={cn(
                    "bg-neutral-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl",
                    "animate-in slide-in-from-bottom-4 fade-in duration-200",
                    "max-h-[80vh] flex flex-col"
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Layers size={18} className="text-indigo-400" />
                        <h3 className="text-base font-semibold text-white">Add to Bundle</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors -m-1"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Current habit */}
                <div className="px-4 pt-3 pb-2">
                    <p className="text-xs text-neutral-500">
                        Adding <span className="text-neutral-300 font-medium">{habitName}</span> to a bundle
                    </p>
                </div>

                {/* Search (show when >=4 bundles) */}
                {bundles.length >= 4 && (
                    <div className="px-4 pb-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <input
                                type="text"
                                placeholder="Search bundles..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-white/5 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {/* Bundle list */}
                <div className="flex-1 overflow-y-auto modal-scroll px-2 pb-4">
                    {bundles.length === 0 ? (
                        <p className="text-center text-sm text-neutral-500 py-6">
                            {search ? 'No matching bundles' : 'No bundles available'}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            {bundles.map(bundle => (
                                <button
                                    key={bundle.id}
                                    onClick={() => handleSelect(bundle)}
                                    disabled={isMoving}
                                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-white/5 text-neutral-200 active:bg-white/10 disabled:opacity-50"
                                >
                                    <div className={cn(
                                        "p-1.5 rounded-lg flex-shrink-0",
                                        bundle.bundleType === 'checklist'
                                            ? 'bg-indigo-500/20 text-indigo-400'
                                            : 'bg-amber-500/20 text-amber-400'
                                    )}>
                                        {bundle.bundleType === 'checklist'
                                            ? <CheckSquare size={14} />
                                            : <ChevronRight size={14} />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium truncate block">{bundle.name}</span>
                                        <span className="text-xs text-neutral-500">
                                            {bundle.bundleType === 'checklist' ? 'Checklist' : 'Choice'}
                                            {bundle.subHabitIds && bundle.subHabitIds.length > 0 && (
                                                <> &middot; {bundle.subHabitIds.length} item{bundle.subHabitIds.length !== 1 ? 's' : ''}</>
                                            )}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
