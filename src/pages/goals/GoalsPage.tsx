import React, { useState, useEffect } from 'react';
import { fetchGoals } from '../../lib/persistenceClient';
import type { Goal } from '../../models/persistenceTypes';
import { Loader2 } from 'lucide-react';

export const GoalsPage: React.FC = () => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadGoals = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedGoals = await fetchGoals();
                setGoals(fetchedGoals);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load goals';
                setError(errorMessage);
                console.error('Error loading goals:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadGoals();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400">Loading goals...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
                <div className="text-red-400 font-medium mb-1">Error</div>
                <div className="text-red-300 text-sm">{error}</div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Goals</h1>
                <p className="text-neutral-400">Your goals</p>
            </div>

            {goals.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                    No goals yet. Create your first goal to get started.
                </div>
            ) : (
                <div className="space-y-2">
                    {goals.map((goal) => (
                        <div
                            key={goal.id}
                            className="p-4 bg-neutral-800/50 border border-white/10 rounded-lg"
                        >
                            <div className="text-white font-medium">{goal.title}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
