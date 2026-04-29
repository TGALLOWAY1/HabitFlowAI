import React from 'react';

interface MilestoneNodesProps {
    /** Each entry is one node label (e.g. [25, 50, 100]). All nodes are rendered as completed. */
    targets: number[];
}

export const MilestoneNodes: React.FC<MilestoneNodesProps> = ({ targets }) => {
    if (targets.length === 0) return null;

    return (
        <div className="flex items-center w-full" role="list" aria-label="Milestone targets">
            {targets.map((value, idx) => {
                const isLast = idx === targets.length - 1;
                return (
                    <React.Fragment key={`${idx}-${value}`}>
                        <div
                            role="listitem"
                            className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/15 border-2 border-emerald-500 text-emerald-400 text-[10px] font-semibold flex items-center justify-center"
                        >
                            {value}
                        </div>
                        {!isLast && <div className="flex-1 h-px bg-emerald-500/40 mx-1" aria-hidden />}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
