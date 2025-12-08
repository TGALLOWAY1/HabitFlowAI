/**
 * Shared styled components for goal-related UI.
 * 
 * Provides consistent visual language across:
 * - GoalCard (card stack)
 * - GoalDetailPage
 * - WinArchivePage tiles
 * - ProgressPage goals section
 */

import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';

/**
 * Shared progress bar component.
 * 
 * Consistent styling:
 * - Height: 2 (8px) for compact views, 4 (16px) for detail views
 * - Border radius: rounded-full
 * - Background: bg-neutral-700
 * - Fill: bg-emerald-500
 */
interface ProgressBarProps {
    percent: number;
    height?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const GoalProgressBar: React.FC<ProgressBarProps> = ({ 
    percent, 
    height = 'sm',
    className = '' 
}) => {
    const heightClass = {
        sm: 'h-2',   // 8px - for compact cards
        md: 'h-3',   // 12px - for medium views
        lg: 'h-4',   // 16px - for detail pages
    }[height];

    const cappedPercent = Math.min(100, Math.max(0, percent));

    return (
        <div className={`w-full ${heightClass} bg-neutral-700 rounded-full overflow-hidden ${className}`}>
            <div
                className={`h-full bg-emerald-500 transition-all duration-300`}
                style={{ width: `${cappedPercent}%` }}
            />
        </div>
    );
};

/**
 * Shared status chip component.
 * 
 * Consistent styling for Active/Completed/Warning states.
 */
interface StatusChipProps {
    status: 'active' | 'completed' | 'warning';
    children: React.ReactNode;
    className?: string;
}

export const GoalStatusChip: React.FC<StatusChipProps> = ({ 
    status, 
    children,
    className = '' 
}) => {
    const baseClasses = 'px-2.5 py-1 rounded text-xs font-medium';
    
    const statusClasses = {
        active: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        completed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    }[status];

    return (
        <span className={`${baseClasses} ${statusClasses} ${className}`}>
            {children}
        </span>
    );
};

/**
 * Shared milestone dots row component.
 * 
 * Shows mini milestone indicators at 10% intervals (0%, 10%, 20%, ..., 100%).
 */
interface MilestoneDotsProps {
    percent: number;
    className?: string;
}

export const GoalMilestoneDots: React.FC<MilestoneDotsProps> = ({ 
    percent, 
    className = '' 
}) => {
    const milestoneThresholds = Array.from({ length: 11 }, (_, i) => i * 10);

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            {milestoneThresholds.map((threshold) => {
                const isFilled = percent >= threshold;
                return (
                    <div
                        key={threshold}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            isFilled
                                ? 'bg-emerald-500'
                                : 'bg-neutral-600'
                        }`}
                        title={`${threshold}%`}
                    />
                );
            })}
        </div>
    );
};

/**
 * Shared inactivity warning badge component.
 */
interface InactivityWarningBadgeProps {
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
}

export const GoalInactivityWarningBadge: React.FC<InactivityWarningBadgeProps> = ({ 
    onClick,
    className = '' 
}) => {
    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400 ${
                onClick ? 'cursor-pointer hover:bg-amber-500/20 transition-colors' : ''
            } ${className}`}
        >
            <AlertTriangle size={12} />
            <span>No progress 4 of last 7 days</span>
        </div>
    );
};

/**
 * Shared goal card container styling.
 * 
 * Consistent border radius, shadows, and spacing.
 */
export const goalCardBaseClasses = 'bg-neutral-800/50 border border-white/10 rounded-lg overflow-hidden transition-all';
export const goalCardPaddingClasses = 'p-4 sm:p-5';
export const goalCardHoverClasses = 'hover:bg-neutral-800/70';

/**
 * Shared goal title styling.
 */
export const goalTitleClasses = 'text-lg font-semibold text-white';
export const goalTitleCompactClasses = 'font-semibold text-white';

/**
 * Shared goal subtitle/metadata styling.
 */
export const goalSubtitleClasses = 'text-sm text-neutral-400';
export const goalMetadataClasses = 'text-xs text-neutral-500';
