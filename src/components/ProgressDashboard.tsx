import React, { useState, useEffect } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { useProgressOverview } from '../lib/useProgressOverview';
import { Heatmap } from './Heatmap';
import { ProgressRings } from './ProgressRings';
import { DailyCheckInModal } from './DailyCheckInModal';
import { Sun, Loader2 } from 'lucide-react';
import { GoalPulseCard } from './goals/GoalPulseCard';
import { CategoryCompletionRow } from './CategoryCompletionRow';
import { EmotionalWellbeingDashboard } from './personas/emotionalWellbeing/EmotionalWellbeingDashboard';
import { FitnessDashboard } from './personas/fitness/FitnessDashboard';
import { getActivePersonaId, resolvePersona } from '../shared/personas/activePersona';
import type { Routine } from '../models/persistenceTypes';
import { DEFAULT_PERSONA_ID, EMOTIONAL_PERSONA_ID, FITNESS_PERSONA_ID } from '../shared/personas/personaConstants';

interface ProgressDashboardProps {
    onCreateGoal?: () => void;
    onViewGoal?: (goalId: string) => void;
    onSelectCategory?: (categoryId: string) => void;
    onNavigateWellbeingHistory?: () => void;
    onStartRoutine?: (routine: Routine) => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ onCreateGoal, onViewGoal, onSelectCategory, onNavigateWellbeingHistory, onStartRoutine }) => {
    const { habits, categories } = useHabitStore();
    const { data: progressData, loading: progressLoading } = useProgressOverview();
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    
    // ============================================================================
    // DASHBOARD ROUTING / PERSONA RESOLUTION AUDIT
    // ============================================================================
    // WHERE PERSONA IS READ FROM:
    // - getActivePersonaId() in src/shared/personas/activePersona.ts (line 33)
    //   - Reads from localStorage: ACTIVE_USER_MODE_STORAGE_KEY ('habitflow_active_user_mode')
    //   - Demo mode → EMOTIONAL_PERSONA_ID
    //   - Real mode → DEFAULT_PERSONA_ID
    //   - Note: Currently no userId-based persona resolution in getActivePersonaId()
    // - resolvePersona() normalizes/validates the persona ID (line 13 in activePersona.ts)
    //   - Maps string personaId to valid PersonaId type
    //   - Unknown personas fall back to DEFAULT_PERSONA_ID
    //
    // WHERE DASHBOARD COMPONENT IS CHOSEN:
    // - ProgressDashboard.tsx (this file, lines 79-108)
    //   - Conditional rendering based on activePersonaId
    //   - EMOTIONAL_PERSONA_ID → EmotionalWellbeingDashboard (lines 79-93)
    //   - FITNESS_PERSONA_ID → FitnessDashboard (lines 94-108)
    //   - DEFAULT_PERSONA_ID (or unknown) → Legacy default dashboard (lines 114-265)
    //
    // CURRENTLY SUPPORTED PERSONAS:
    // 1. DEFAULT_PERSONA_ID ('default') - Legacy dashboard with Progress Rings, Goals, Activity Heatmap
    // 2. EMOTIONAL_PERSONA_ID ('emotional_wellbeing') - Emotional Wellbeing Dashboard
    // 3. FITNESS_PERSONA_ID ('fitness_focused') - Fitness Dashboard
    //
    // NOTE: dashboardComposer.ts does NOT yet support FITNESS_PERSONA_ID
    // (it only handles EMOTIONAL_PERSONA_ID and defaults everything else to emotionalWellbeingPersona)
    // Fitness persona dashboard not yet wired here.
    // ============================================================================
    // DEV ONLY: Sync persona query param to localStorage for persistence and trigger re-render
    const [personaQueryParam, setPersonaQueryParam] = useState<string | null>(() => {
        if (!import.meta.env.DEV || typeof window === 'undefined') return null;
        return new URLSearchParams(window.location.search).get('persona');
    });
    
    useEffect(() => {
        if (!import.meta.env.DEV || typeof window === 'undefined') return;
        
        const params = new URLSearchParams(window.location.search);
        const personaParam = params.get('persona');
        
        // Update state to trigger re-render if param changed
        if (personaParam !== personaQueryParam) {
            setPersonaQueryParam(personaParam);
        }
        
        if (!personaParam) return;
        
        // Map query param to user mode for localStorage
        let mode: 'real' | 'demo' | null = null;
        switch (personaParam.toLowerCase()) {
            case 'fitness':
            case 'emotional':
                // Both fitness and emotional personas use demo mode
                mode = 'demo';
                break;
            case 'default':
                mode = 'real';
                break;
        }
        
        if (mode !== null) {
            const currentMode = localStorage.getItem('habitflow_active_user_mode');
            if (currentMode !== mode) {
                localStorage.setItem('habitflow_active_user_mode', mode);
            }
        }
    }, [personaQueryParam]); // Re-run when query param changes
    
    // Listen for URL changes (browser back/forward, manual URL changes)
    useEffect(() => {
        if (!import.meta.env.DEV || typeof window === 'undefined') return;
        
        const handleLocationChange = () => {
            const params = new URLSearchParams(window.location.search);
            const personaParam = params.get('persona');
            setPersonaQueryParam(personaParam);
        };
        
        // Listen for popstate (browser back/forward)
        window.addEventListener('popstate', handleLocationChange);
        
        // Also check on mount and periodically (for manual URL changes)
        const interval = setInterval(() => {
            const params = new URLSearchParams(window.location.search);
            const currentParam = params.get('persona');
            if (currentParam !== personaQueryParam) {
                handleLocationChange();
            }
        }, 100); // Check every 100ms
        
        return () => {
            window.removeEventListener('popstate', handleLocationChange);
            clearInterval(interval);
        };
    }, [personaQueryParam]);

    const activePersonaId = resolvePersona(getActivePersonaId());
    // Initialize state from URL params
    const [activityTab, setActivityTab] = useState<'overall' | 'category'>(() => {
        const params = new URLSearchParams(window.location.search);
        return (params.get('activityTab') as 'overall' | 'category') || 'overall';
    });

    const [heatmapRange, setHeatmapRange] = useState<'year' | '90d' | '30d'>(() => {
        const params = new URLSearchParams(window.location.search);
        return (params.get('heatmapRange') as 'year' | '90d' | '30d') || '30d';
    });

    const [categoryRange, setCategoryRange] = useState<'7d' | '14d'>(() => {
        const params = new URLSearchParams(window.location.search);
        return (params.get('categoryRange') as '7d' | '14d') || '14d';
    });

    // Helper to update URL without page reload
    const updateUrlParams = (updates: Record<string, string>, method: 'push' | 'replace' = 'replace') => {
        const url = new URL(window.location.href);
        Object.entries(updates).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
        if (method === 'push') {
            window.history.pushState(null, '', url.toString());
        } else {
            window.history.replaceState(null, '', url.toString());
        }
    };

    const handleTabChange = (tab: 'overall' | 'category') => {
        setActivityTab(tab);
        updateUrlParams({ activityTab: tab }, 'push');
    };

    const handleHeatmapRangeChange = (range: 'year' | '90d' | '30d') => {
        setHeatmapRange(range);
        updateUrlParams({ heatmapRange: range }, 'replace');
    };

    const handleCategoryRangeChange = (range: '7d' | '14d') => {
        setCategoryRange(range);
        updateUrlParams({ categoryRange: range }, 'replace');
    };





    // Persona-controlled dashboard composition (view-only).
    // Persona must NEVER affect persistence or user identity.
    if (activePersonaId === EMOTIONAL_PERSONA_ID) {
        return (
            <>
                <EmotionalWellbeingDashboard
                    onOpenCheckIn={() => setIsCheckInOpen(true)}
                    onNavigateWellbeingHistory={onNavigateWellbeingHistory}
                    onStartRoutine={onStartRoutine}
                />
                <DailyCheckInModal
                    isOpen={isCheckInOpen}
                    onClose={() => setIsCheckInOpen(false)}
                />
            </>
        );
    }
    if (activePersonaId === FITNESS_PERSONA_ID) {
        return (
            <>
                <FitnessDashboard
                    onOpenCheckIn={() => setIsCheckInOpen(true)}
                    onNavigateWellbeingHistory={onNavigateWellbeingHistory}
                    onStartRoutine={onStartRoutine}
                />
                <DailyCheckInModal
                    isOpen={isCheckInOpen}
                    onClose={() => setIsCheckInOpen(false)}
                />
            </>
        );
    }
    // Strict default persona gate: restore legacy dashboard as-is.
    // Do NOT rebuild default dashboard via composer.
    // DEFAULT_PERSONA_ID (or any unknown) -> legacy tree below.
    void DEFAULT_PERSONA_ID;

    return (
        <div className="space-y-6 overflow-y-auto pb-20">
            {/* Header with Check-in Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setIsCheckInOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/5"
                >
                    <Sun size={16} className="text-amber-400" />
                    Daily Check-in
                </button>
            </div>


            {/* Progress Rings */}
            <ProgressRings />

            {/* Goals at a glance */}
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Goals at a glance</h3>
                    <button
                        onClick={() => onViewGoal && onViewGoal('all')} // Use a safe fallback if 'all' isn't standard, but typically routing handles it. Or just rely on sidebar. 
                        className="text-xs text-neutral-500 hover:text-white transition-colors"
                    >
                        View all
                    </button>
                </div>

                {progressLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="text-emerald-500 animate-spin" size={20} />
                    </div>
                ) : !progressData || progressData.goalsWithProgress.length === 0 ? (
                    <div className="text-center py-6">
                        <h4 className="text-neutral-400 text-sm mb-2">No active goals</h4>
                        {onCreateGoal && (
                            <button
                                onClick={onCreateGoal}
                                className="text-emerald-500 hover:text-emerald-400 text-xs font-medium transition-colors"
                            >
                                + Add a goal
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {progressData.goalsWithProgress
                            .filter(({ goal }) => !goal.completedAt) // active only
                            .slice(0, 4) // max 4
                            .map((goalWithProgress) => (
                                <GoalPulseCard
                                    key={goalWithProgress.goal.id}
                                    goalWithProgress={goalWithProgress}
                                    onClick={() => {
                                        if (onViewGoal) {
                                            onViewGoal(goalWithProgress.goal.id);
                                        }
                                    }}
                                />
                            ))}
                    </div>
                )}
            </div>

            {/* Activity Heatmap Section */}
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold text-white">Activity</h3>
                        {activityTab === 'overall' ? (
                            <select
                                value={heatmapRange}
                                onChange={(e) => handleHeatmapRangeChange(e.target.value as 'year' | '90d' | '30d')}
                                className="bg-neutral-800 text-xs text-neutral-300 border border-white/5 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                                <option value="year">Last Year</option>
                                <option value="90d">Last 90 Days</option>
                                <option value="30d">Last 30 Days</option>
                            </select>
                        ) : (
                            <div className="flex bg-neutral-800 rounded-md p-0.5 border border-white/5">
                                {(['7d', '14d'] as const).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => handleCategoryRangeChange(r)}
                                        className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${categoryRange === r
                                            ? 'bg-neutral-700 text-white shadow-sm'
                                            : 'text-neutral-400 hover:text-white'
                                            }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex p-1 bg-neutral-800 rounded-lg self-start lg:self-auto">
                        <button
                            onClick={() => handleTabChange('overall')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activityTab === 'overall'
                                ? 'bg-neutral-700 text-white shadow-sm'
                                : 'text-neutral-400 hover:text-white'
                                }`}
                        >
                            Overall
                        </button>
                        <button
                            onClick={() => handleTabChange('category')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activityTab === 'category'
                                ? 'bg-neutral-700 text-white shadow-sm'
                                : 'text-neutral-400 hover:text-white'
                                }`}
                        >
                            By Category
                        </button>
                    </div>
                </div>

                <div className="animate-in fade-in duration-300">
                    {activityTab === 'overall' ? (
                        <Heatmap range={heatmapRange} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {categories.map(category => {
                                const catHabits = habits.filter(h => h.categoryId === category.id && !h.archived);
                                if (catHabits.length === 0) return null;

                                return (
                                    <CategoryCompletionRow
                                        key={category.id}
                                        category={category}
                                        habits={catHabits}
                                        range={categoryRange}
                                        onClick={() => onSelectCategory && onSelectCategory(category.id)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>




            <DailyCheckInModal
                isOpen={isCheckInOpen}
                onClose={() => setIsCheckInOpen(false)}
            />
        </div>
    );
};




