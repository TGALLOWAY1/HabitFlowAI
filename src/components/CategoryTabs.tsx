import React from 'react';
import { useHabitStore } from '../store/HabitContext';
import type { Category } from '../types';
import { Plus, X, Check } from 'lucide-react';
import { nextCategoryColor } from '../utils/categoryColors';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CategoryTabsProps {
    categories: Category[];
    activeCategoryId: string;
    onSelectCategory: (id: string) => void;
    uncategorized?: Category | null;
}

interface SortableCategoryPillProps {
    category: Category;
    isActive: boolean;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onRename: (newName: string) => Promise<void>;
    deleteConfirmId: string | null;
    reorderMode: boolean;
    onEnterReorderMode: () => void;
}

const SortableCategoryPill: React.FC<SortableCategoryPillProps> = ({
    category,
    isActive,
    onSelect,
    onDelete,
    onRename,
    deleteConfirmId,
    reorderMode,
    onEnterReorderMode,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: category.id });

    const [isEditing, setIsEditing] = React.useState(false);
    const [editName, setEditName] = React.useState(category.name);
    const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Update local state if prop changes
    React.useEffect(() => {
        setEditName(category.name);
    }, [category.name]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    const handleSubmit = async () => {
        const trimmed = editName.trim();
        if (trimmed && trimmed !== category.name) {
            try {
                await onRename(trimmed);
            } catch (error) {
                console.error('Failed to rename category:', error);
                setEditName(category.name);
            }
        } else {
            setEditName(category.name);
        }
        setIsEditing(false);
    };

    const handleLongPressStart = () => {
        if (reorderMode) return;
        longPressRef.current = setTimeout(() => {
            longPressRef.current = null;
            onEnterReorderMode();
        }, 500);
    };

    const handleLongPressCancel = () => {
        if (longPressRef.current) {
            clearTimeout(longPressRef.current);
            longPressRef.current = null;
        }
    };

    if (isEditing) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                className="relative group"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit();
                    }}
                    className="flex items-center"
                >
                    <input
                        autoFocus
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setEditName(category.name);
                                setIsEditing(false);
                                e.stopPropagation();
                            }
                            e.stopPropagation();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="px-4 py-2 rounded-full bg-surface-1 text-content-primary text-sm font-medium border border-emerald-500 outline-none w-auto min-w-[100px]"
                    />
                </form>
            </div>
        );
    }

    // Only spread drag listeners when in reorder mode
    const dragProps = reorderMode ? listeners : {};

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={`relative group ${reorderMode ? 'animate-wiggle' : ''}`}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (!reorderMode) setIsEditing(true);
            }}
            onPointerDown={!reorderMode ? handleLongPressStart : undefined}
            onPointerUp={handleLongPressCancel}
            onPointerLeave={handleLongPressCancel}
            onPointerCancel={handleLongPressCancel}
            {...dragProps}
        >
            <button
                onClick={reorderMode ? undefined : onSelect}
                className={`
          px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all select-none
          ${isActive
                        ? `${category.color} text-content-primary shadow-lg shadow-white/10 pr-8`
                        : 'bg-surface-1 text-content-secondary hover:bg-surface-2 hover:text-content-primary'
                    }
          ${reorderMode ? 'ring-1 ring-emerald-500/40 cursor-grab' : ''}
        `}
            >
                {category.name}
            </button>

            {isActive && !reorderMode && (
                <button
                    onClick={onDelete}
                    className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors z-10 ${deleteConfirmId === category.id
                        ? 'bg-red-500 text-content-primary hover:bg-red-600 shadow-sm'
                        : 'hover:bg-black/20 text-content-primary/70 hover:text-content-primary'
                        }`}
                    title={deleteConfirmId === category.id ? "Click again to confirm delete" : "Delete Category"}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
};

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
    categories,
    activeCategoryId,
    onSelectCategory,
    uncategorized,
}) => {
    const { addCategory, deleteCategory, reorderCategories, updateCategory } = useHabitStore();
    const [isAdding, setIsAdding] = React.useState(false);
    const [newCategoryName, setNewCategoryName] = React.useState('');
    const [addCategoryError, setAddCategoryError] = React.useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
    const [reorderMode, setReorderMode] = React.useState(false);

    const normalizeCategoryName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = categories.findIndex((c) => c.id === active.id);
            const newIndex = categories.findIndex((c) => c.id === over.id);
            try {
                await reorderCategories(arrayMove(categories, oldIndex, newIndex));
            } catch (error) {
                console.error('Failed to reorder categories:', error);
            }
        }
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddCategoryError(null);
        const trimmed = newCategoryName.trim();
        if (!trimmed) return;
        const normalized = normalizeCategoryName(trimmed);
        const duplicate = categories.some((c) => normalizeCategoryName(c.name) === normalized);
        if (duplicate) {
            setAddCategoryError('Category already exists. Choose a different name.');
            return;
        }
        try {
            // Close form immediately — optimistic UI shows the tab right away
            setNewCategoryName('');
            setIsAdding(false);
            await addCategory({ name: trimmed, color: nextCategoryColor(categories) });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to add category';
            setAddCategoryError(msg.includes('already exists') ? 'Category already exists. Choose a different name.' : msg);
            console.error('Failed to add category:', error);
        }
    };

    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [showRightFade, setShowRightFade] = React.useState(false);

    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const check = () => setShowRightFade(el.scrollWidth > el.clientWidth + el.scrollLeft + 8);
        check();
        el.addEventListener('scroll', check, { passive: true });
        window.addEventListener('resize', check);
        return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
    }, [categories]);

    return (
        <div className="relative">
        <div ref={scrollRef} className="flex items-center gap-2 overflow-x-auto p-2 no-scrollbar scroll-smooth">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={categories.map(c => c.id)}
                    strategy={horizontalListSortingStrategy}
                >
                    {categories.map((category) => (
                        <SortableCategoryPill
                            key={category.id}
                            category={category}
                            isActive={activeCategoryId === category.id}
                            onSelect={() => onSelectCategory(category.id)}
                            onRename={async (newName) => {
                                await updateCategory(category.id, { name: newName });
                            }}
                            deleteConfirmId={deleteConfirmId}
                            reorderMode={reorderMode}
                            onEnterReorderMode={() => setReorderMode(true)}
                            onDelete={async (e) => {
                                e.stopPropagation();
                                if (deleteConfirmId === category.id) {
                                    try {
                                        await deleteCategory(category.id);
                                        const remaining = categories.filter(c => c.id !== category.id);
                                        if (remaining.length > 0) onSelectCategory(remaining[0].id);
                                        setDeleteConfirmId(null);
                                    } catch (error) {
                                        console.error('Failed to delete category:', error);
                                    }
                                } else {
                                    setDeleteConfirmId(category.id);
                                    setTimeout(() => setDeleteConfirmId(null), 3000);
                                }
                            }}
                        />
                    ))}
                </SortableContext>
            </DndContext>

            {uncategorized && (
                <button
                    onClick={() => onSelectCategory(uncategorized.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                        activeCategoryId === uncategorized.id
                            ? 'bg-amber-500 text-neutral-900 shadow-lg shadow-amber-500/20'
                            : 'bg-surface-1 text-amber-400 hover:bg-surface-2 border border-amber-500/30'
                    }`}
                >
                    Uncategorized
                </button>
            )}

            {reorderMode ? (
                <button
                    onClick={() => setReorderMode(false)}
                    className="px-3 py-2 rounded-full bg-emerald-500 text-neutral-900 text-sm font-medium hover:bg-accent-strong transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                >
                    <Check size={14} strokeWidth={3} /> Done
                </button>
            ) : isAdding ? (
                <form onSubmit={handleAddCategory} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                        <input
                            autoFocus
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => { setNewCategoryName(e.target.value); setAddCategoryError(null); }}
                            placeholder="Category name..."
                            className="px-3 py-2 rounded-full bg-surface-1 text-content-primary text-sm border border-line-strong focus:border-emerald-500 outline-none w-32"
                            onBlur={() => !newCategoryName && !addCategoryError && setIsAdding(false)}
                            aria-invalid={!!addCategoryError}
                            aria-describedby={addCategoryError ? 'add-category-error' : undefined}
                        />
                        <button type="submit" className="p-2 rounded-full bg-emerald-500 text-content-primary hover:bg-emerald-600">
                            <Plus size={14} />
                        </button>
                    </div>
                    {addCategoryError && (
                        <p id="add-category-error" className="text-xs text-amber-400 px-2">
                            {addCategoryError}
                        </p>
                    )}
                </form>
            ) : (
                <button
                    onClick={() => setIsAdding(true)}
                    className="px-3 py-2 rounded-full bg-surface-1 text-content-secondary hover:bg-surface-2 hover:text-content-primary transition-colors"
                    title="Add Category"
                >
                    <Plus size={18} />
                </button>
            )}

        </div>
        {showRightFade && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-neutral-900 pointer-events-none" />
        )}
        </div>
    );
};
