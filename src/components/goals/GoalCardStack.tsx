import React, { useState } from 'react';
import { GoalCard } from './GoalCard';
import type { GoalWithProgress } from '../../models/persistenceTypes';

interface GoalCardStackProps {
    goals: GoalWithProgress[];
}

export const GoalCardStack: React.FC<GoalCardStackProps> = ({ goals }) => {
    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

    const handleToggle = (goalId: string) => {
        setExpandedGoalId(prev => prev === goalId ? null : goalId);
    };

    return (
        <div className="space-y-3">
            {goals.map((goalWithProgress) => (
                <GoalCard
                    key={goalWithProgress.goal.id}
                    goalWithProgress={goalWithProgress}
                    isExpanded={expandedGoalId === goalWithProgress.goal.id}
                    onToggleExpand={() => handleToggle(goalWithProgress.goal.id)}
                />
            ))}
        </div>
    );
};
