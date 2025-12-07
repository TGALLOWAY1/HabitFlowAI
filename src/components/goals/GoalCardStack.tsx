import React, { useState } from 'react';
import { GoalCard } from './GoalCard';
import type { GoalWithProgress } from '../../models/persistenceTypes';

interface GoalCardStackProps {
    goals: GoalWithProgress[];
    onViewDetails?: (goalId: string) => void;
    onEdit?: (goalId: string) => void;
    onAddManualProgress?: (goalId: string) => void;
    onNavigateToCompleted?: (goalId: string) => void;
    onRefetch?: () => void;
}

export const GoalCardStack: React.FC<GoalCardStackProps> = ({
    goals,
    onViewDetails,
    onEdit,
    onAddManualProgress,
    onNavigateToCompleted,
    onRefetch,
}) => {
    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

    const handleToggle = (goalId: string) => {
        setExpandedGoalId(prev => prev === goalId ? null : goalId);
    };

    return (
        <div className="space-y-4">
            {goals.map((goalWithProgress) => (
                <GoalCard
                    key={goalWithProgress.goal.id}
                    goalWithProgress={goalWithProgress}
                    isExpanded={expandedGoalId === goalWithProgress.goal.id}
                    onToggleExpand={() => handleToggle(goalWithProgress.goal.id)}
                    onViewDetails={onViewDetails}
                    onEdit={onEdit}
                    onAddManualProgress={onAddManualProgress}
                    onNavigateToCompleted={onNavigateToCompleted}
                    onRefetch={onRefetch}
                />
            ))}
        </div>
    );
};
