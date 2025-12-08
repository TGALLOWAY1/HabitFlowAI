import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import type { ActivityStep } from '../types';

interface CreateActivityFromHabitsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (prefillSteps: ActivityStep[]) => void;
}

export const CreateActivityFromHabitsModal: React.FC<CreateActivityFromHabitsModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
}) => {
    const { habits, categories } = useHabitStore();
    const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());

    // Create category lookup for validation
    const categoryLookup = useMemo(() => {
        return new Map(categories.map(cat => [cat.id, cat]));
    }, [categories]);

    // Filter out archived habits, deduplicate by name, and apply search
    // Prioritize habits with valid categoryIds over those with invalid ones
    const availableHabits = useMemo(() => {
        // First, filter out archived habits
        const nonArchived = habits.filter(h => !h.archived);

        // Deduplicate by name (case-insensitive), keeping the one with a valid categoryId
        // This handles cases where duplicates exist with different categoryIds (some invalid)
        const seenNames = new Map<string, typeof habits[0]>();
        
        nonArchived.forEach(habit => {
            const nameKey = habit.name.toLowerCase();
            const existing = seenNames.get(nameKey);
            const hasValidCategory = categoryLookup.has(habit.categoryId);
            
            if (!existing) {
                // First occurrence of this name
                seenNames.set(nameKey, habit);
            } else {
                // Duplicate name found - keep the one with valid categoryId
                const existingHasValidCategory = categoryLookup.has(existing.categoryId);
                
                if (hasValidCategory && !existingHasValidCategory) {
                    // Current habit has valid category, existing doesn't - replace
                    seenNames.set(nameKey, habit);
                } else if (!hasValidCategory && existingHasValidCategory) {
                    // Existing has valid category, current doesn't - keep existing
                    // (do nothing)
                } else if (hasValidCategory && existingHasValidCategory) {
                    // Both have valid categories - keep first occurrence
                    // (do nothing)
                } else {
                    // Neither has valid category - keep first occurrence
                    // (do nothing)
                }
            }
        });

        const uniqueHabits = Array.from(seenNames.values());

        // Apply search filter
        return uniqueHabits.filter(h => 
            searchQuery === '' || 
            h.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [habits, searchQuery, categoryLookup]);

    // Group habits by category
    const habitsByCategory = useMemo(() => {
        const categoryMap = new Map<string, typeof availableHabits>();
        
        // Separate habits with valid vs invalid categoryIds
        const validCategoryHabits: typeof availableHabits = [];
        const invalidCategoryHabits: typeof availableHabits = [];
        
        availableHabits.forEach(habit => {
            if (categoryLookup.has(habit.categoryId)) {
                validCategoryHabits.push(habit);
            } else {
                invalidCategoryHabits.push(habit);
            }
        });
        
        // Group valid category habits by categoryId
        validCategoryHabits.forEach(habit => {
            if (!categoryMap.has(habit.categoryId)) {
                categoryMap.set(habit.categoryId, []);
            }
            categoryMap.get(habit.categoryId)!.push(habit);
        });

        // Convert to array of [category, habits] tuples, sorted by category name
        const validCategories = Array.from(categoryMap.entries())
            .map(([categoryId, categoryHabits]) => {
                const category = categoryLookup.get(categoryId)!;
                return {
                    category,
                    habits: categoryHabits,
                };
            })
            .sort((a, b) => a.category.name.localeCompare(b.category.name));

        // Add "Unknown Category" section only if there are habits with invalid categoryIds
        if (invalidCategoryHabits.length > 0) {
            validCategories.push({
                category: { id: 'unknown', name: 'Unknown Category', color: 'bg-neutral-500' },
                habits: invalidCategoryHabits,
            });
        }

        return validCategories;
    }, [availableHabits, categoryLookup]);

    // Auto-expand categories that have matching habits when searching
    useEffect(() => {
        if (searchQuery) {
            const matchingCategoryIds = new Set<string>();
            habitsByCategory.forEach(({ category, habits }) => {
                if (habits.length > 0) {
                    matchingCategoryIds.add(category.id);
                }
            });
            setExpandedCategoryIds(matchingCategoryIds);
        } else {
            // When search is cleared, collapse all
            setExpandedCategoryIds(new Set());
        }
    }, [searchQuery, habitsByCategory]);

    const toggleCategory = (categoryId: string) => {
        const newExpanded = new Set(expandedCategoryIds);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategoryIds(newExpanded);
    };

    if (!isOpen) return null;

    const toggleHabit = (habitId: string) => {
        const newSelected = new Set(selectedHabitIds);
        if (newSelected.has(habitId)) {
            newSelected.delete(habitId);
        } else {
            newSelected.add(habitId);
        }
        setSelectedHabitIds(newSelected);
    };

    const handleConfirm = () => {
        const selectedHabits = habits.filter(h => selectedHabitIds.has(h.id));
        const prefillSteps: ActivityStep[] = selectedHabits.map(habit => ({
            id: crypto.randomUUID(),
            type: 'habit',
            title: habit.name,
            habitId: habit.id,
            instruction: '',
            imageUrl: undefined,
            timeEstimateMinutes: undefined,
        }));
        onConfirm(prefillSteps);
        onClose();
        // Reset state
        setSelectedHabitIds(new Set());
        setSearchQuery('');
    };

    const handleCancel = () => {
        onClose();
        // Reset state
        setSelectedHabitIds(new Set());
        setSearchQuery('');
        setExpandedCategoryIds(new Set());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[80vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white">Create Activity from Habits</h3>
                    <button onClick={handleCancel} className="text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-6 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                            placeholder="Search habits..."
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {habitsByCategory.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500">
                            {searchQuery ? 'No habits found matching your search.' : 'No habits available.'}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {habitsByCategory.map(({ category, habits: categoryHabits }) => {
                                const isExpanded = expandedCategoryIds.has(category.id);
                                
                                return (
                                    <div key={category.id} className="border border-white/5 rounded-lg overflow-hidden">
                                        {/* Category Header */}
                                        <button
                                            type="button"
                                            onClick={() => toggleCategory(category.id)}
                                            className="w-full flex items-center justify-between p-3 bg-neutral-800/50 hover:bg-neutral-800/70 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                {isExpanded ? (
                                                    <ChevronDown size={18} className="text-neutral-400 flex-shrink-0" />
                                                ) : (
                                                    <ChevronRight size={18} className="text-neutral-400 flex-shrink-0" />
                                                )}
                                                <div 
                                                    className={`w-3 h-3 rounded-full flex-shrink-0 ${category.color}`}
                                                    style={{ backgroundColor: category.color.startsWith('#') ? category.color : undefined }}
                                                />
                                                <span className="text-white font-medium truncate">{category.name}</span>
                                                <span className="text-xs text-neutral-400 bg-neutral-700/50 px-2 py-0.5 rounded-full">
                                                    {categoryHabits.length}
                                                </span>
                                            </div>
                                        </button>

                                        {/* Category Habits */}
                                        {isExpanded && (
                                            <div className="p-2 space-y-1 bg-neutral-900/50">
                                                {categoryHabits.map((habit) => (
                                                    <label
                                                        key={habit.id}
                                                        className="flex items-center gap-3 p-2.5 bg-neutral-800/30 border border-white/5 rounded-lg hover:bg-neutral-800/50 transition-colors cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedHabitIds.has(habit.id)}
                                                            onChange={() => toggleHabit(habit.id)}
                                                            className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-white font-medium truncate">{habit.name}</div>
                                                            {habit.description && (
                                                                <div className="text-sm text-neutral-400 mt-0.5 truncate">{habit.description}</div>
                                                            )}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex items-center justify-between">
                    <div className="text-sm text-neutral-400">
                        {selectedHabitIds.size > 0 ? (
                            <span>{selectedHabitIds.size} {selectedHabitIds.size === 1 ? 'habit' : 'habits'} selected</span>
                        ) : (
                            <span>Select habits to add as steps</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={selectedHabitIds.size === 0}
                            className="px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
