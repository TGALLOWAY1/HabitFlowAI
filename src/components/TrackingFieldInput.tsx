import React from 'react';
import type { TrackingFieldDef } from '../models/persistenceTypes';

interface TrackingFieldInputProps {
    field: TrackingFieldDef;
    value: string | number | undefined;
    onChange: (value: string | number) => void;
}

export const TrackingFieldInput: React.FC<TrackingFieldInputProps> = ({ field, value, onChange }) => {
    return (
        <div className="flex items-center gap-3">
            <label className="text-sm text-neutral-400 min-w-[80px] shrink-0">
                {field.label}
            </label>
            <div className="flex-1 flex items-center gap-2">
                {field.type === 'number' ? (
                    <input
                        type="number"
                        inputMode="decimal"
                        value={value ?? ''}
                        onChange={e => {
                            const raw = e.target.value;
                            if (raw === '') {
                                onChange('');
                                return;
                            }
                            const num = parseFloat(raw);
                            onChange(isNaN(num) ? raw : num);
                        }}
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-neutral-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : '0'}
                    />
                ) : (
                    <input
                        type="text"
                        value={value ?? ''}
                        onChange={e => onChange(e.target.value)}
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                        placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : ''}
                    />
                )}
                {field.unit && (
                    <span className="text-xs text-neutral-500 shrink-0">{field.unit}</span>
                )}
            </div>
        </div>
    );
};
