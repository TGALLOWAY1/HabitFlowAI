import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

interface NumericInputPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: number) => void;
    initialValue?: number;
    unit?: string;
    position: { top: number; left: number };
}

export const NumericInputPopover: React.FC<NumericInputPopoverProps> = ({
    isOpen,
    onClose,
    onSubmit,
    initialValue = 0,
    unit,
    position,
}) => {
    const [value, setValue] = useState(initialValue.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue.toString());
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            onSubmit(numValue);
        }
        onClose();
    };

    return (
        <div
            className="fixed z-50"
            style={{ top: position.top, left: position.left }}
        >
            <div className="fixed inset-0" onClick={onClose} />
            <form
                onSubmit={handleSubmit}
                className="relative bg-neutral-800 border border-white/10 rounded-xl p-3 shadow-xl flex items-center gap-2 w-48 animate-in fade-in zoom-in-95 duration-200"
            >
                <input
                    ref={inputRef}
                    type="number"
                    step="any"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="0"
                />
                {unit && <span className="text-xs text-neutral-500 font-medium">{unit}</span>}
                <button
                    type="submit"
                    className="p-1.5 bg-emerald-500 text-neutral-900 rounded-lg hover:bg-emerald-400 transition-colors"
                >
                    <Check size={14} strokeWidth={3} />
                </button>
            </form>
        </div>
    );
};
