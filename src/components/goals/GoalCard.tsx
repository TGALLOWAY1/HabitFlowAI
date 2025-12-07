import React from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import type { GoalWithProgress } from '../../models/persistenceTypes';

interface GoalCardProps {
    goalWithProgress: GoalWithProgress;
    isExpanded: boolean;
    onToggle: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
    goalWithProgress,
    isExpanded,
    onToggle,
}) => {
    const { goal, progress } = goalWithProgress;

    return (
        <div className="bg-neutral-800/50 border border-white/10 rounded-lg overflow-hidden transition-all">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-800/70 transition-colors text-left"
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isExpanded ? (
                        <ChevronDown className="text-neutral-400 flex-shrink-0" size={20} />
                    ) : (
                        <ChevronRight className="text-neutral-400 flex-shrink-0" size={20} />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-white truncate">
                                {goal.title}
                            </h3>
                            {progress.inactivityWarning && (
                                <AlertTriangle className="text-amber-400 flex-shrink-0" size={16} title="Inactivity warning" />
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-neutral-400">
                            <span>
                                {progress.currentValue} / {goal.targetValue} {goal.unit || ''}
                            </span>
                            <span className="text-emerald-400 font-medium">
                                {progress.percent}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-24 h-1.5 bg-neutral-700 rounded-full overflow-hidden ml-4 flex-shrink-0">
                    <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(100, progress.percent)}%` }}
                    />
                </div>
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-4">
                        {/* Goal Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-neutral-400 mb-1">Type</div>
                                <div className="text-white capitalize">{goal.type}</div>
                            </div>
                            {goal.deadline && (
                                <div>
                                    <div className="text-neutral-400 mb-1">Deadline</div>
                                    <div className="text-white">{goal.deadline}</div>
                                </div>
                            )}
                        </div>

                        {/* Progress Details */}
                        <div>
                            <div className="text-neutral-400 text-sm mb-2">Last 7 Days</div>
                            <div className="flex gap-1">
                                {progress.lastSevenDays.map((day, index) => (
                                    <div
                                        key={day.date}
                                        className={`flex-1 h-8 rounded flex items-center justify-center text-xs transition-colors ${
                                            day.hasProgress
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-neutral-700/50 text-neutral-500 border border-neutral-600/30'
                                        }`}
                                        title={`${day.date}: ${day.value} ${goal.unit || ''}`}
                                    >
                                        {day.hasProgress ? '✓' : '—'}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        {goal.notes && (
                            <div>
                                <div className="text-neutral-400 text-sm mb-1">Notes</div>
                                <div className="text-white text-sm">{goal.notes}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
