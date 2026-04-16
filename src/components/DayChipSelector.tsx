import React from 'react';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DayChipSelectorProps {
    selectedDays: number[];
    onChange: (days: number[]) => void;
    minSelected?: number;
    disabled?: boolean;
}

export const DayChipSelector: React.FC<DayChipSelectorProps> = ({
    selectedDays,
    onChange,
    minSelected = 1,
    disabled = false,
}) => {
    const toggleDay = (index: number) => {
        if (disabled) return;
        const next = selectedDays.includes(index)
            ? selectedDays.filter(d => d !== index)
            : [...selectedDays, index];
        if (next.length >= minSelected) {
            onChange(next);
        }
    };

    return (
        <div className="flex justify-between gap-1">
            {DAY_LABELS.map((label, i) => (
                <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    disabled={disabled}
                    className={`
                        w-9 h-9 rounded-lg text-xs font-bold transition-all
                        ${selectedDays.includes(i)
                            ? 'bg-accent text-content-on-accent shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'bg-surface-1 text-content-secondary hover:bg-surface-2 hover:text-content-primary'}
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    {label}
                </button>
            ))}
        </div>
    );
};
