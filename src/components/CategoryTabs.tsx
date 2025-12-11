import React from 'react';
import { useHabitStore } from '../store/HabitContext';
import type { Category } from '../types';
import { Plus, Download, X } from 'lucide-react';
import { PREDEFINED_CATEGORIES, PREDEFINED_HABITS } from '../data/predefinedHabits';
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
}

interface SortableCategoryPillProps {
    category: Category;
    isActive: boolean;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onRename: (newName: string) => Promise<void>;
    deleteConfirmId: string | null;
}

const SortableCategoryPill: React.FC<SortableCategoryPillProps> = ({
    category,
    isActive,
    onSelect,
    onDelete,
    onRename,
    deleteConfirmId,
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
                setEditName(category.name); // Revert on failure
            }
        } else {
            setEditName(category.name); // Revert if empty or unchanged
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className="relative group touch-none"
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
                            // Stop event propagation to prevent dnd conflicts
                            e.stopPropagation();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="px-4 py-2 rounded-full bg-neutral-800 text-white text-sm font-medium border border-emerald-500 outline-none w-auto min-w-[100px]"
                    />
                </form>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="relative group touch-none"
            onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
            <button
                onClick={onSelect}
                className={`
          px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all select-none
          ${isActive
                        ? `${category.color} text-white shadow-lg shadow-white/10 pr-8`
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                    }
        `}
            >
                {category.name}
            </button>

            {isActive && (
                <button
                    onClick={onDelete}
                    className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors z-10 ${deleteConfirmId === category.id
                        ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                        : 'hover:bg-black/20 text-white/70 hover:text-white'
                        }`}
                    title={deleteConfirmId === category.id ? "Click again to confirm delete" : "Delete Category"}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag start on delete button
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
}) => {
    const { addCategory, importHabits, deleteCategory, reorderCategories, updateCategory } = useHabitStore();
    const [isAdding, setIsAdding] = React.useState(false);
    const [newCategoryName, setNewCategoryName] = React.useState('');
    const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
    const [importStatus, setImportStatus] = React.useState<'idle' | 'success'>('idle');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px movement before drag starts to allow clicking
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

    const handleImport = async () => {
        try {
            await importHabits(PREDEFINED_CATEGORIES, PREDEFINED_HABITS);
            setImportStatus('success');
            setTimeout(() => setImportStatus('idle'), 3000);
        } catch (error) {
            console.error('Failed to import habits:', error);
        }
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newCategoryName.trim()) {
            try {
                await addCategory({ name: newCategoryName.trim(), color: 'bg-neutral-600' });
                setNewCategoryName('');
                setIsAdding(false);
            } catch (error) {
                console.error('Failed to add category:', error);
            }
        }
    };

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
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

            {isAdding ? (
                <form onSubmit={handleAddCategory} className="flex items-center gap-1">
                    <input
                        autoFocus
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Category name..."
                        className="px-3 py-2 rounded-full bg-neutral-800 text-white text-sm border border-neutral-700 focus:border-emerald-500 outline-none w-32"
                        onBlur={() => !newCategoryName && setIsAdding(false)}
                    />
                    <button type="submit" className="p-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600">
                        <Plus size={14} />
                    </button>
                </form>
            ) : (
                <button
                    onClick={() => setIsAdding(true)}
                    className="px-3 py-2 rounded-full bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                    title="Add Category"
                >
                    <Plus size={18} />
                </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
                {importStatus === 'success' && (
                    <span className="text-xs text-emerald-400 font-medium animate-fade-in">Imported!</span>
                )}
                <button
                    onClick={handleImport}
                    className="px-3 py-2 rounded-full bg-neutral-800 text-neutral-400 hover:bg-emerald-900/50 hover:text-emerald-400 transition-colors"
                    title="Import Default Habits"
                >
                    <Download size={18} />
                </button>
            </div>
        </div>
    );
};
