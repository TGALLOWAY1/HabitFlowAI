import React, { useRef, useEffect } from 'react';
import type { SkillTreeIdentityNode } from '../../server/services/skillTreeService';

interface IdentityTabsProps {
    identities: SkillTreeIdentityNode[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const IdentityTabs: React.FC<IdentityTabsProps> = ({
    identities,
    selectedId,
    onSelect
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll active tab into view when selected changes
    useEffect(() => {
        if (!selectedId || !scrollContainerRef.current) return;

        const activeTab = scrollContainerRef.current.querySelector('[data-active="true"]');
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [selectedId]);

    if (identities.length === 0) return null;

    return (
        <div className="w-full relative z-10 mb-8">
            <div
                ref={scrollContainerRef}
                className="w-full flex items-center justify-center gap-4 overflow-x-auto no-scrollbar py-4 px-4 mask-fade-sides"
            >
                {identities.map((identity) => {
                    const isActive = identity.id === selectedId;

                    // Extract color or default to emerald
                    // Assume identity.color is something like "bg-emerald-500"
                    // We need a shadow color. If it's a tailwind class, we can map it or use a default glow.
                    const glowClass = isActive ? 'shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)] border-emerald-500/50 bg-neutral-900' : 'border-white/5 bg-neutral-900/50 hover:bg-neutral-800 text-neutral-400';
                    const textClass = isActive ? 'text-emerald-400' : 'text-neutral-400';

                    return (
                        <button
                            key={identity.id}
                            data-active={isActive}
                            onClick={() => onSelect(identity.id)}
                            className={`
                                flex-shrink-0 px-8 py-4 rounded-xl border transition-all duration-300
                                ${glowClass}
                            `}
                        >
                            <span className={`font-medium text-lg ${textClass}`}>
                                {identity.name}
                            </span>
                            {/* Line connecting to tree below (only if active) */}
                            {isActive && (
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-px h-8 bg-gradient-to-b from-emerald-500/50 to-emerald-500/0 pointer-events-none" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
