import React, { useState, useEffect, useRef } from 'react';
import { useRoutineStore } from '../store/RoutineContext';
import { useHabitStore } from '../store/HabitContext';
import type { Routine, Category } from '../models/persistenceTypes';
import { Plus, MoreVertical, ChevronRight, ClipboardList, Edit, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface RoutineListProps {
    onCreate: () => void;
    onEdit: (routine: Routine) => void;
    onStart: (routine: Routine) => void;
    onPreview: (routine: Routine) => void;
}

// Compact Routine Card Component (Grid)
const RoutineCard: React.FC<{
    routine: Routine;
    onPreview: (routine: Routine) => void;
    onEdit: (routine: Routine) => void;
    onDelete: (routine: Routine) => void;
}> = ({ routine, onPreview, onEdit, onDelete }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const totalSteps = routine.steps?.length ?? 0;

    // Estimate duration: sum of timerSeconds + arbitrary 60s buffer per step
    const estimatedSeconds = routine.steps.reduce((acc, step) => acc + (step.timerSeconds || 60), 0);
    const estimatedMinutes = Math.max(1, Math.ceil(estimatedSeconds / 60));

    return (
        <div
            onClick={() => onPreview(routine)}
            className="group relative bg-neutral-800/40 border border-white/5 rounded-xl p-4 hover:bg-neutral-800/80 hover:border-white/10 transition-all cursor-pointer flex flex-col h-32 justify-between overflow-hidden"
        >
            {/* Routine Image (if available) */}
            {routine.imageUrl && (
                <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                    <img
                        src={routine.imageUrl}
                        alt={routine.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Top Row: Title & Menu */}
            <div className="flex justify-between items-start gap-2 relative z-10">
                <h3 className="text-white font-medium text-sm line-clamp-2 leading-relaxed">
                    {routine.title}
                </h3>

                {/* Menu Action (Kebab) */}
                <div className="relative -mr-2 -mt-2" ref={menuRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(!menuOpen);
                        }}
                        className={cn(
                            "p-1.5 text-neutral-500 hover:text-white hover:bg-white/10 rounded-md transition-colors",
                            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                        )}
                        title="Options"
                    >
                        <MoreVertical size={16} />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-neutral-900 border border-white/10 rounded-lg shadow-xl z-20 py-1 flex flex-col">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onEdit(routine);
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-white/5 hover:text-white w-full text-left"
                            >
                                <Edit size={14} /> Edit Routine
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onDelete(routine);
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full text-left"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Row: Metadata */}
            <div className="flex items-center text-xs text-neutral-500 font-medium relative z-10">
                <span>{totalSteps} steps</span>
                <span className="mx-1.5 opacity-50">·</span>
                <span>~{estimatedMinutes} min</span>
            </div>
        </div>
    );
};

// Collapsible Category Section Component
const CategorySection: React.FC<{
    category: Category | { id: string; name: string; color: string; isUncategorized?: boolean };
    routines: Routine[];
    isExpanded: boolean;
    onToggle: () => void;
    onPreview: (routine: Routine) => void;
    onEdit: (routine: Routine) => void;
    onDelete: (routine: Routine) => void;
}> = ({ category, routines, isExpanded, onToggle, onPreview, onEdit, onDelete }) => {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div
                onClick={onToggle}
                className="flex items-center gap-2 cursor-pointer py-1 hover:opacity-80 transition-opacity select-none group"
            >
                <div className="text-neutral-500 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <ChevronRight size={16} />
                </div>
                <div className={`w-2 h-2 rounded-full ${(category as any).isUncategorized ? 'bg-neutral-600' : category.color}`} />
                <h3 className="text-sm font-semibold text-neutral-300 group-hover:text-white transition-colors">{category.name}</h3>
                <span className="text-xs text-neutral-600 font-medium ml-1">
                    {routines.length}
                </span>
            </div>

            {/* Body (Grid) */}
            {isExpanded && (
                <div
                    className="grid gap-3 pl-6 animate-in slide-in-from-top-1 duration-200"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
                >
                    {routines.map(routine => (
                        <RoutineCard
                            key={routine.id}
                            routine={routine}
                            onPreview={onPreview}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const RoutineList: React.FC<RoutineListProps> = ({ onCreate, onEdit, onPreview }) => {
    const { routines, loading, error, deleteRoutine } = useRoutineStore();
    const { categories } = useHabitStore();

    // Persistence for expanded state
    const STORAGE_KEY = 'habitflow_routine_categories_expanded';
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setExpandedCategories(JSON.parse(stored));
            } else {
                // Default all to expanded
                const defaults: Record<string, boolean> = {};
                categories.forEach(c => defaults[c.id] = true);
                defaults['uncategorized'] = true;
                setExpandedCategories(defaults);
            }
        } catch (e) {
            console.error('Failed to load expanded state', e);
        }
    }, [categories]);

    const toggleCategory = (id: string) => {
        const newState = { ...expandedCategories, [id]: !expandedCategories[id] };
        setExpandedCategories(newState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    };

    const handleDelete = async (routine: Routine) => {
        if (confirm(`Are you sure you want to delete "${routine.title}"?`)) {
            try {
                await deleteRoutine(routine.id);
            } catch (error) {
                console.error('Failed to delete routine:', error);
            }
        }
    };

    // Group routines
    const groupedRoutines = React.useMemo(() => {
        const groups: Record<string, Routine[]> = {};

        // Initialize groups
        categories.forEach(c => groups[c.id] = []);
        groups['uncategorized'] = [];

        routines.forEach(routine => {
            if (routine.categoryId && groups[routine.categoryId]) {
                groups[routine.categoryId].push(routine);
            } else {
                groups['uncategorized'].push(routine);
            }
        });

        return groups;
    }, [routines, categories]);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-neutral-500">
                Loading routines...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-red-400">
                Error: {error}
            </div>
        );
    }

    if (routines.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-neutral-900/50 rounded-2xl border border-white/5">
                <ClipboardList size={48} className="text-neutral-600 mb-4" />
                <h3 className="text-lg font-medium text-neutral-300 mb-2">No routines yet</h3>
                <p className="text-neutral-500 mb-6">Create routines to structure your habits.</p>
                <button
                    onClick={onCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors"
                >
                    <Plus size={18} />
                    Create Routine
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-neutral-900/50 rounded-2xl border border-white/5 backdrop-blur-sm shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h2 className="text-lg font-bold text-white">Routines</h2>
                <button
                    onClick={onCreate}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                >
                    <Plus size={16} />
                    New Routine
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {categories.map(category => {
                    const categoryRoutines = groupedRoutines[category.id];
                    if (categoryRoutines.length === 0) return null;

                    return (
                        <CategorySection
                            key={category.id}
                            category={category}
                            routines={categoryRoutines}
                            isExpanded={!!expandedCategories[category.id]}
                            onToggle={() => toggleCategory(category.id)}
                            onPreview={onPreview}
                            onEdit={onEdit}
                            onDelete={handleDelete}
                        />
                    );
                })}

                {/* Uncategorized Section */}
                {groupedRoutines['uncategorized']?.length > 0 && (
                    <CategorySection
                        category={{ id: 'uncategorized', name: 'Uncategorized', color: 'bg-neutral-600', isUncategorized: true }}
                        routines={groupedRoutines['uncategorized']}
                        isExpanded={!!expandedCategories['uncategorized']}
                        onToggle={() => toggleCategory('uncategorized')}
                        onPreview={onPreview}
                        onEdit={onEdit}
                        onDelete={handleDelete}
                    />
                )}
            </div>
        </div>
    );
};
