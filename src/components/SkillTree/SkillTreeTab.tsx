import React, { useState, useEffect } from 'react';
import { useSkillTreeQuery } from '../../hooks/useSkillTreeQuery';
import { IdentityTabs } from './IdentityTabs';
import { TreeCanvas } from './TreeCanvas';
import { Loader2, Trees } from 'lucide-react';

interface SkillTreeTabProps {
    onCreateGoal: () => void;
}

export const SkillTreeTab: React.FC<SkillTreeTabProps> = ({ onCreateGoal }) => {
    const { data, isLoading, error } = useSkillTreeQuery();
    const [selectedIdentityId, setSelectedIdentityId] = useState<string | null>(null);

    // Auto-select first identity on load
    useEffect(() => {
        if (data?.identities.length && !selectedIdentityId) {
            setSelectedIdentityId(data.identities[0].id);
        }
    }, [data, selectedIdentityId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-emerald-500" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-12 text-red-400">
                <p>Failed to load Skill Tree: {error}</p>
            </div>
        );
    }

    if (!data || data.identities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-neutral-500">
                <Trees size={48} className="mb-4 opacity-50" />
                <h3 className="text-xl font-medium text-white mb-2">No Skills Found</h3>
                <p className="max-w-md text-center mb-6">
                    Categorize your goals to see them built into your skill tree.
                </p>
                <button
                    onClick={onCreateGoal}
                    className="px-6 py-2 bg-emerald-500 text-neutral-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                >
                    Create Categorized Goal
                </button>
            </div>
        );
    }

    const activeIdentity = data.identities.find(id => id.id === selectedIdentityId) || data.identities[0];

    return (
        <div className="flex flex-col h-full w-full min-h-[600px]">
            {/* 1. Identity Tabs (Top Navigation) */}
            <IdentityTabs
                identities={data.identities}
                selectedId={activeIdentity.id}
                onSelect={setSelectedIdentityId}
            />

            {/* 2. Main Tree Canvas (Spatial Layout) */}
            <div className="flex-1 bg-neutral-900/30 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5 pointer-events-none" />

                <TreeCanvas identity={activeIdentity} />

                {/* Fade overlays for scrolling */}
                <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-neutral-950 to-transparent pointer-events-none z-20" />
                <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-neutral-950 to-transparent pointer-events-none z-20" />
            </div>
        </div>
    );
};
