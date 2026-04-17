import React, { useState, useEffect, useRef } from 'react';
import { Check, Trash2 } from 'lucide-react';

interface NumericInputPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: number) => void;
    onClear?: () => void;
    initialValue?: number;
    unit?: string;
    position: { top: number; left: number };
}

export const NumericInputPopover: React.FC<NumericInputPopoverProps> = ({
    isOpen,
    onClose,
    onSubmit,
    onClear,
    initialValue = 0,
    unit,
    position,
}) => {
    const [value, setValue] = useState(initialValue.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue.toString());
            // Double-rAF ensures DOM is painted before focus (more reliable than setTimeout on iOS)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    inputRef.current?.focus();
                    inputRef.current?.select();
                });
            });
        }
    }, [isOpen, initialValue]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            onSubmit(numValue);
        }
        onClose();
    };

    const showClear = initialValue > 0 && onClear;

    return (
        <div
            className="fixed z-50"
            style={{ top: position.top, left: position.left }}
        >
            <div className="fixed inset-0" onClick={onClose} />
            <form
                onSubmit={handleSubmit}
                className="relative bg-surface-1 border border-line-subtle rounded-xl p-3 shadow-xl flex items-center gap-2 w-48 animate-in fade-in zoom-in-95 duration-200"
            >
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full bg-surface-0 border border-line-subtle rounded-lg px-3 py-1.5 text-content-primary text-sm focus:outline-none focus:border-focus"
                    placeholder="0"
                />
                {unit && <span className="text-xs text-content-muted font-medium">{unit}</span>}
                <button
                    type="submit"
                    className="p-1.5 bg-accent text-content-on-accent rounded-lg hover:bg-accent-strong transition-colors"
                >
                    <Check size={14} strokeWidth={3} />
                </button>
                {showClear && (
                    <button
                        type="button"
                        onClick={() => {
                            onClear();
                            onClose();
                        }}
                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Clear entry"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </form>
        </div>
    );
};
