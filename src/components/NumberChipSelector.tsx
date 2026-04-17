import React from 'react';

interface NumberChipSelectorProps {
    value: number;
    onChange: (n: number) => void;
    min: number;
    max: number;
    disabled?: boolean;
}

export const NumberChipSelector: React.FC<NumberChipSelectorProps> = ({
    value,
    onChange,
    min,
    max,
    disabled = false,
}) => {
    const effectiveMax = Math.max(max, min);
    const chips: number[] = [];
    for (let i = min; i <= effectiveMax; i++) {
        chips.push(i);
    }

    return (
        <div className="flex gap-1 flex-wrap">
            {chips.map((n) => (
                <button
                    key={n}
                    type="button"
                    onClick={() => !disabled && onChange(n)}
                    disabled={disabled}
                    className={`
                        w-9 h-9 rounded-lg text-xs font-bold transition-all
                        ${value === n
                            ? 'bg-accent text-content-on-accent shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'bg-surface-1 text-content-secondary hover:bg-surface-2 hover:text-content-primary'}
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    {n}
                </button>
            ))}
        </div>
    );
};
