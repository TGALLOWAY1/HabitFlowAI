import React, { useState, useEffect } from 'react';
import { useRoutineStore } from '../store/RoutineContext';
import { useHabitStore } from '../store/HabitContext';
import type { Routine, Category } from '../models/persistenceTypes';
import { Plus, ChevronRight, ChevronDown, ClipboardList, Edit, Trash2, Layers, Clock, ListChecks, Play, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';
import { resolveSteps, isMultiVariant } from '../lib/routineVariantUtils';

interface RoutineListProps {
    onCreate: () => void;
    onEdit: (routine: Routine) => void;
    onStart: (routine: Routine) => void;
    onPreview: (routine: Routine) => void;
}

// Expandable Routine Card Component
const RoutineCard: React.FC<{
    routine: Routine;
    isExpanded: boolean;
    onExpand: () => void;
    onPreview: (routine: Routine) => void;
    onEdit: (routine: Routine) => void;
    onDelete: (routine: Routine) => void;
}> = ({ routine, isExpanded, onExpand, onPreview, onEdit, onDelete }) => {
    const steps = resolveSteps(routine);
    const totalSteps = steps.length;
    const hasMultipleVariants = isMultiVariant(routine);
    const variantCount = routine.variants?.length || 0;

    return (
        <div
            className={cn(
                "relative flex flex-col rounded-lg border transition-all duration-300 overflow-hidden",
                isExpanded
                    ? "bg-neutral-800 border-white/10 shadow-lg scale-[1.02] z-10"
                    : "bg-neutral-900/40 border-white/5 hover:bg-neutral-800/60 hover:border-white/10"
            )}
        >
            {/* Routine Image (if available) */}
            {routine.imageUrl && !isExpanded && (
                <div className="absolute inset-0 opacity-20 transition-opacity rounded-lg overflow-hidden">
                    <img
                        src={routine.imageUrl}
                        alt={routine.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* COLLAPSED ROW (Always Visible) */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer relative z-10"
                onClick={onExpand}
            >
                {/* Title */}
                <span className="flex-1 text-sm font-medium truncate select-none text-neutral-300">
                    {routine.title}
                </span>

                {/* Metadata */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-neutral-600">
                        {totalSteps} steps
                    </span>
                    {hasMultipleVariants && (
                        <span className="flex items-center gap-1 text-[10px] text-purple-400/80 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                            <Layers size={10} />
                            {variantCount}
                        </span>
                    )}
                    <ChevronRight size={14} className={cn(
                        "text-neutral-600 transition-transform duration-200",
                        isExpanded && "rotate-90"
                    )} />
                </div>
            </div>

            {/* EXPANDED CONTENT */}
            {isExpanded && (
                <div className="px-4 pb-3 pt-0 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200 cursor-default" onClick={e => e.stopPropagation()}>
                    <div className="h-px w-full bg-white/5 mb-1" />

                    {/* Variants (if multi-variant) */}
                    {hasMultipleVariants && routine.variants && (
                        <div className="flex flex-col gap-2">
                            {routine.variants.map(variant => (
                                <button
                                    key={variant.id}
                                    onClick={() => onPreview(routine)}
                                    className="w-full text-left p-3 rounded-lg border border-white/5 bg-neutral-800/50 hover:border-white/15 hover:bg-neutral-800 transition-all"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-medium text-white truncate">{variant.name}</span>
                                            {variant.isAiGenerated && (
                                                <Sparkles size={10} className="text-purple-400 flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-neutral-500 flex-shrink-0">
                                            <span className="flex items-center gap-1">
                                                <ListChecks size={10} />
                                                {variant.steps.length}
                                            </span>
                                            {variant.estimatedDurationMinutes > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {variant.estimatedDurationMinutes}m
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {variant.description && (
                                        <p className="text-[10px] text-neutral-500 mt-1 line-clamp-1">{variant.description}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Single-variant: show a Start button */}
                    {!hasMultipleVariants && (
                        <button
                            onClick={() => onPreview(routine)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-xs text-emerald-400 hover:bg-emerald-500/10 w-fit"
                        >
                            <Play size={12} />
                            <span>Start Routine</span>
                        </button>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                        <button
                            onClick={() => onEdit(routine)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                        >
                            <Edit size={12} />
                            <span>Edit</span>
                        </button>
                        <button
                            onClick={() => onDelete(routine)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                            <Trash2 size={12} />
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
            )}
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
    const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);

    // Determine color application strategy (match Today view style)
    const isTailwindClass = category.color?.startsWith('bg-');
    const textColorClass = isTailwindClass ? category.color.replace('bg-', 'text-') : undefined;
    const styleColor = !isTailwindClass && category.color ? { color: category.color } : undefined;

    return (
        <div className="space-y-3">
            {/* Header */}
            <button
                onClick={onToggle}
                className="flex items-center gap-2 px-1 w-full text-left group transition-opacity hover:opacity-80"
            >
                <div className={`flex-shrink-0 ${textColorClass || 'text-neutral-500'}`} style={styleColor}>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
                <h3
                    className={`text-lg font-bold transition-colors ${textColorClass || 'text-neutral-300'}`}
                    style={styleColor}
                >
                    {category.name}
                </h3>
                <span className="text-xs text-neutral-500 font-medium ml-1">
                    {routines.length}
                </span>
            </button>

            {/* Body */}
            {isExpanded && (
                <div
                    className="flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-200"
                >
                    {routines.map(routine => (
                        <RoutineCard
                            key={routine.id}
                            routine={routine}
                            isExpanded={expandedRoutineId === routine.id}
                            onExpand={() => setExpandedRoutineId(prev => prev === routine.id ? null : routine.id)}
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
            <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-neutral-900/50 rounded-2xl border border-white/5">
                <div className="w-14 h-14 bg-neutral-800 rounded-full flex items-center justify-center mb-5">
                    <ClipboardList size={28} className="text-neutral-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                    Routines group actions into repeatable flows that reduce friction.
                </h3>
                <p className="text-sm text-neutral-400 mb-4 max-w-sm leading-relaxed">
                    Use routines for things like a morning reset, gym prep, or an evening shutdown.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-sm">
                    {['Morning reset', 'Workout prep', 'Evening shutdown'].map((ex) => (
                        <span key={ex} className="px-3 py-1 text-xs text-neutral-400 bg-neutral-800/80 rounded-full border border-white/5">
                            {ex}
                        </span>
                    ))}
                </div>
                <button
                    onClick={onCreate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors text-sm"
                >
                    <Plus size={18} />
                    Create Your First Routine
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
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
