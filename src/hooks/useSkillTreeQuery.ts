import { useState, useEffect, useCallback } from 'react';
import type { SkillTreeData } from '../server/services/skillTreeService';

/**
 * Hook to fetch Skill Tree data.
 * Replaces the previous context-based approach for the new UI architecture.
 */
export function useSkillTreeQuery() {
    const [data, setData] = useState<SkillTreeData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSkillTree = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/skill-tree');
            if (!response.ok) {
                throw new Error('Failed to fetch skill tree data');
            }
            const jsonData = await response.json();
            setData(jsonData);
            setError(null);
        } catch (err) {
            console.error('Error fetching skill tree:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSkillTree();
    }, [fetchSkillTree]);

    return {
        data,
        isLoading,
        error,
        refetch: fetchSkillTree
    };
}
