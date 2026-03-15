/**
 * VariantCard — Reusable card for displaying a variant's summary in selection contexts.
 */
import React from 'react';
import { Clock, ListChecks, Sparkles } from 'lucide-react';
import type { RoutineVariant } from '../models/persistenceTypes';

interface VariantCardProps {
    variant: RoutineVariant;
    isSelected: boolean;
    onClick: () => void;
}

export const VariantCard: React.FC<VariantCardProps> = ({ variant, isSelected, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-4 rounded-xl border transition-all ${
                isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'border-white/10 bg-neutral-800/50 hover:border-white/20 hover:bg-neutral-800'
            }`}
            role="option"
            aria-selected={isSelected}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className={`font-medium truncate ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                            {variant.name}
                        </h4>
                        {variant.isAiGenerated && (
                            <Sparkles size={12} className="text-purple-400 flex-shrink-0" />
                        )}
                    </div>
                    {variant.description && (
                        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{variant.description}</p>
                    )}
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                    isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-neutral-600'
                }`}>
                    {isSelected && (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3 mt-3 text-xs text-neutral-500">
                <span className="flex items-center gap-1">
                    <ListChecks size={12} />
                    {variant.steps.length} steps
                </span>
                <span className="flex items-center gap-1">
                    <Clock size={12} />
                    ~{variant.estimatedDurationMinutes} min
                </span>
            </div>
        </button>
    );
};
