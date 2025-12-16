import React, { forwardRef } from 'react';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SkillTreeHabitNode } from '../../server/services/skillTreeService';

interface HabitNodeProps {
    habit: SkillTreeHabitNode;
}

export const HabitNode = forwardRef<HTMLDivElement, HabitNodeProps>(({ habit }, ref) => {
    return (
        <div
            ref={ref}
            className="flex-shrink-0 w-64"
        >
            <div className={`
                bg-neutral-800/50 border rounded-xl p-4 transition-all duration-300
                ${habit.atRisk ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5 hover:border-white/10'}
            `}>
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="text-xs text-neutral-500 font-medium mb-1">HABIT</div>
                        <h4 className="text-white font-medium truncate" title={habit.name}>
                            {habit.name}
                        </h4>
                    </div>
                    {habit.atRisk ? (
                        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                    ) : (
                        <Activity size={18} className="text-emerald-500 flex-shrink-0 opacity-50" />
                    )}
                </div>

                {/* Progress / Status */}
                <div className="flex items-center justify-between text-sm">
                    <span className={`font-mono ${habit.atRisk ? 'text-amber-200' : 'text-neutral-400'}`}>
                        {habit.progressText}
                    </span>

                    {habit.percent >= 100 ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : (
                        <div className="w-16 h-1 bg-neutral-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${habit.atRisk ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${habit.percent}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
            {/* Connection Point (Top Center) - for layout ref logic */}
            <div className="absolute top-0 left-1/2 w-px h-px -translate-y-full" />
        </div>
    );
});

HabitNode.displayName = 'HabitNode';
