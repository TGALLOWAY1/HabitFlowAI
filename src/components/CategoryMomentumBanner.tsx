import React, { useMemo } from 'react';
import { calculateCategoryMomentum } from '../utils/momentum';
import type { DayLog } from '../types';

interface CategoryMomentumBannerProps {
    categoryId: string;
    habits: { id: string }[];
    logs: Record<string, DayLog> | DayLog[];
}

export const CategoryMomentumBanner: React.FC<CategoryMomentumBannerProps> = ({ categoryId, habits, logs }) => {
    const { state, phrase } = useMemo(() => {
        if (!habits.length) return { state: 'Paused', phrase: '' };
        return calculateCategoryMomentum(logs, habits.map(h => h.id), categoryId);
    }, [logs, habits, categoryId]);

    if (!phrase) return null;

    // Determine color based on state for visual flair, or keep simple text
    const stateColors: Record<string, string> = {
        'Strong': 'text-emerald-400',
        'Steady': 'text-blue-400',
        'Building': 'text-orange-400',
        'Paused': 'text-neutral-400'
    };

    const colorClass = stateColors[state] || 'text-neutral-400';

    return (
        <div className="flex items-center gap-3 px-1 animate-in slide-in-from-top-1 duration-300">
            <div className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>
                Momentum: {state}
            </div>
            <div className="hidden sm:block w-px h-3 bg-white/10" />
            <div className="text-sm text-neutral-400 italic font-medium">
                "{phrase}"
            </div>
        </div>
    );
};
