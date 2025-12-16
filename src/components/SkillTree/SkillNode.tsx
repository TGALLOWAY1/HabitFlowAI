import React, { forwardRef } from 'react';
import { Target, Trophy } from 'lucide-react';
import type { SkillTreeSkillNode } from '../../server/services/skillTreeService';

interface SkillNodeProps {
    skill: SkillTreeSkillNode;
    color?: string; // e.g. "text-emerald-400"
}

export const SkillNode = forwardRef<HTMLDivElement, SkillNodeProps>(({ skill, color = 'text-emerald-400' }, ref) => {
    // Extract base color name for border/shadow logic if needed, or use simpler static for MVP
    // Assuming color is a text class like "text-emerald-400"

    return (
        <div
            ref={ref}
            className="flex-shrink-0 relative group"
        >
            <div className="w-64 bg-neutral-900 border border-white/10 rounded-xl p-4 shadow-lg hover:border-emerald-500/30 hover:shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)] transition-all duration-300">

                {/* Header: Label + Icon */}
                <div className="flex items-center gap-2 mb-2 opacity-70">
                    <Trophy size={14} className={color} />
                    <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                        Skill
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-white font-medium text-lg leading-tight mb-4">
                    {skill.title}
                </h3>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${skill.progress.percent}%` }}
                    />
                </div>

                {/* Stats Text */}
                <div className="flex justify-between mt-2 text-xs text-neutral-500">
                    <span>Level {Math.floor(skill.progress.percent / 20) + 1}</span>
                    <span>{Math.round(skill.progress.percent)}%</span>
                </div>
            </div>

            {/* Connection Point (Bottom Center) - for layout ref logic */}
            <div className="absolute bottom-0 left-1/2 w-px h-px translate-y-full" />
        </div>
    );
});

SkillNode.displayName = 'SkillNode';
