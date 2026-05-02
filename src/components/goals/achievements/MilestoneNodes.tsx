import React from 'react';

interface MilestoneNodesProps {
    /** Each entry is one node label (e.g. [25, 50, 100]). */
    targets: number[];
    /**
     * Optional parallel array of completion flags. When omitted, every node is
     * rendered as completed (used by iteration-chain history). When provided,
     * incomplete nodes are rendered as outlined placeholders.
     */
    completed?: boolean[];
}

export const MilestoneNodes: React.FC<MilestoneNodesProps> = ({ targets, completed }) => {
    if (targets.length === 0) return null;

    return (
        <div className="flex items-center w-full" role="list" aria-label="Milestone targets">
            {targets.map((value, idx) => {
                const isLast = idx === targets.length - 1;
                const isCompleted = completed ? completed[idx] !== false : true;
                const nodeClass = isCompleted
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                    : 'bg-transparent border-emerald-500/30 text-emerald-500/50';
                const connectorClass = isCompleted
                    ? 'bg-emerald-500/40'
                    : 'bg-emerald-500/15';
                return (
                    <React.Fragment key={`${idx}-${value}`}>
                        <div
                            role="listitem"
                            aria-label={`Milestone ${value}${isCompleted ? ' (completed)' : ''}`}
                            className={`flex-shrink-0 w-7 h-7 rounded-full border-2 text-[10px] font-semibold flex items-center justify-center transition-colors ${nodeClass}`}
                        >
                            {value}
                        </div>
                        {!isLast && <div className={`flex-1 h-px mx-1 ${connectorClass}`} aria-hidden />}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
