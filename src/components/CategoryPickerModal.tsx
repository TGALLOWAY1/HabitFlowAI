import { useState } from 'react';
import { X, FolderInput, Search, Check } from 'lucide-react';
import { cn } from '../utils/cn';
import { useHabitStore } from '../store/HabitContext';
import { useToast } from './Toast';

interface CategoryPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    habitId: string;
    currentCategoryId: string;
}

export const CategoryPickerModal = ({
    isOpen,
    onClose,
    habitId,
    currentCategoryId,
}: CategoryPickerModalProps) => {
    const { categories, habits, moveHabitToCategory } = useHabitStore();
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const [isMoving, setIsMoving] = useState(false);

    if (!isOpen) return null;

    const habit = habits.find(h => h.id === habitId);
    if (!habit) return null;

    const currentCategory = categories.find(c => c.id === currentCategoryId);
    const filtered = categories.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = async (targetCategoryId: string) => {
        if (targetCategoryId === currentCategoryId || isMoving) return;

        setIsMoving(true);
        const targetCategory = categories.find(c => c.id === targetCategoryId);

        try {
            await moveHabitToCategory(habitId, targetCategoryId);
            showToast(
                `Moved "${habit.name}" to ${targetCategory?.name ?? 'category'}`,
                'success'
            );
            onClose();
        } catch {
            showToast('Failed to move habit. Please try again.', 'error');
        } finally {
            setIsMoving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
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
                        <FolderInput size={18} className="text-emerald-400" />
                        <h3 className="text-base font-semibold text-white">Move to Category</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Current location */}
                <div className="px-4 pt-3 pb-2">
                    <p className="text-xs text-neutral-500">
                        Moving <span className="text-neutral-300 font-medium">{habit.name}</span>
                        {currentCategory && (
                            <> from <span className="text-neutral-300 font-medium">{currentCategory.name}</span></>
                        )}
                    </p>
                </div>

                {/* Search (only show when >=6 categories) */}
                {categories.length >= 6 && (
                    <div className="px-4 pb-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <input
                                type="text"
                                placeholder="Search categories..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-white/5 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {/* Category list */}
                <div className="flex-1 overflow-y-auto px-2 pb-4">
                    {filtered.length === 0 ? (
                        <p className="text-center text-sm text-neutral-500 py-6">No categories found</p>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            {filtered.map(category => {
                                const isCurrent = category.id === currentCategoryId;
                                const isTailwindClass = category.color.startsWith('bg-');
                                const dotColor = isTailwindClass
                                    ? category.color
                                    : undefined;
                                const dotStyle = !isTailwindClass
                                    ? { backgroundColor: category.color }
                                    : undefined;

                                return (
                                    <button
                                        key={category.id}
                                        onClick={() => handleSelect(category.id)}
                                        disabled={isCurrent || isMoving}
                                        className={cn(
                                            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors",
                                            isCurrent
                                                ? "bg-white/5 text-neutral-500 cursor-default"
                                                : "hover:bg-white/5 text-neutral-200 active:bg-white/10"
                                        )}
                                    >
                                        <div
                                            className={cn("w-3 h-3 rounded-full flex-shrink-0", dotColor)}
                                            style={dotStyle}
                                        />
                                        <span className="text-sm font-medium flex-1 truncate">
                                            {category.name}
                                        </span>
                                        {isCurrent && (
                                            <span className="flex items-center gap-1 text-xs text-neutral-500">
                                                <Check size={12} /> Current
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
