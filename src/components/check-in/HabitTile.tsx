import React from 'react';
import { resolveColorHex } from '../../utils/categoryColors';
import { cn } from '../../utils/cn';

interface HabitTileProps {
    name: string;
    /** Category color (Tailwind bg-* class or CSS color). */
    color?: string;
    size?: 'sm' | 'md';
}

/**
 * Decorative habit glyph tinted with the habit's category color. Habits have
 * no icon field, so the tile shows the name's first character (an emoji, when
 * the name starts with one).
 */
export const HabitTile: React.FC<HabitTileProps> = ({ name, color, size = 'md' }) => {
    const hex = resolveColorHex(color ?? 'bg-neutral-500');
    const glyph = Array.from(name.trim())[0]?.toUpperCase() ?? '•';
    return (
        <span
            aria-hidden="true"
            className={cn(
                'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-bold',
                size === 'sm' ? 'h-9 w-9 text-sm' : 'h-12 w-12 text-lg',
            )}
            style={{ color: hex }}
        >
            <span className="absolute inset-0 opacity-15" style={{ backgroundColor: hex }} />
            <span className="relative">{glyph}</span>
        </span>
    );
};
