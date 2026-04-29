import React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';

interface AchievementSectionHeaderProps {
    icon: LucideIcon;
    title: string;
    description: string;
    /** Tailwind text color class for the icon (e.g. 'text-emerald-400'). */
    iconColor?: string;
    /** Tailwind background tint class for the icon tile (e.g. 'bg-emerald-500/10'). */
    iconBg?: string;
    showViewAll?: boolean;
    onViewAll?: () => void;
    viewAllLabel?: string;
}

export const AchievementSectionHeader: React.FC<AchievementSectionHeaderProps> = ({
    icon: Icon,
    title,
    description,
    iconColor = 'text-emerald-400',
    iconBg = 'bg-emerald-500/10',
    showViewAll,
    onViewAll,
    viewAllLabel = 'View all',
}) => {
    return (
        <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
            <div className="flex items-start gap-3 min-w-0">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${iconBg} flex items-center justify-center border border-white/[0.06]`}>
                    <Icon size={18} className={iconColor} />
                </div>
                <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-white leading-tight">{title}</h2>
                    <p className="text-xs sm:text-sm text-neutral-400 leading-tight mt-0.5">{description}</p>
                </div>
            </div>
            {showViewAll && (
                <button
                    onClick={onViewAll}
                    className="flex-shrink-0 flex items-center gap-1 text-xs sm:text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded px-1"
                >
                    {viewAllLabel}
                    <ChevronRight size={14} />
                </button>
            )}
        </div>
    );
};
