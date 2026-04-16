/**
 * VariantCard — Reusable card for displaying a variant's summary in selection contexts.
 */
import React from 'react';
import { Clock, ListChecks, Pencil, Sparkles } from 'lucide-react';
import type { RoutineVariant } from '../models/persistenceTypes';

interface VariantCardProps {
    variant: RoutineVariant;
    isSelected: boolean;
    onClick: () => void;
    onEdit?: () => void;
}

export const VariantCard: React.FC<VariantCardProps> = ({ variant, isSelected, onClick, onEdit }) => {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-4 rounded-xl border transition-all ${
                isSelected
                    ? 'border-emerald-500 bg-accent-soft ring-1 ring-focus/30'
                    : 'border-line-subtle bg-surface-1/50 hover:border-line-strong hover:bg-surface-1'
            }`}
            role="option"
            aria-selected={isSelected}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className={`font-medium truncate ${isSelected ? 'text-accent-contrast' : 'text-content-primary'}`}>
                            {variant.name}
                        </h4>
                        {variant.isAiGenerated && (
                            <Sparkles size={12} className="text-purple-400 flex-shrink-0" />
                        )}
                    </div>
                    {variant.description && (
                        <p className="text-xs text-content-muted mt-1 line-clamp-2">{variant.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    {onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="p-1 rounded text-content-muted hover:text-content-primary hover:bg-surface-2 transition-colors"
                            aria-label={`Edit ${variant.name}`}
                            title="Edit variant"
                        >
                            <Pencil size={14} />
                        </button>
                    )}
                    <div className={`w-4 h-4 rounded-full border-2 ${
                        isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-line-strong'
                    }`}>
                        {isSelected && (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3 mt-3 text-xs text-content-muted">
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
