import React from 'react';
import { BatteryLow, BicepsFlexed, Brain, CloudFog, Leaf, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { DAILY_CHECK_IN_MOOD_TAGS, type DailyCheckInMoodTag } from '../../shared/dailyCheckIn';
import { MOOD_TAG_LABELS } from './checkInModel';
import { FOCUS_RING } from './checkInStyles';

const TAG_ICONS: Record<DailyCheckInMoodTag, LucideIcon> = {
    calm: Leaf,
    energized: Zap,
    focused: Brain,
    distracted: CloudFog,
    proud: BicepsFlexed,
    tired: BatteryLow,
};

interface MoodTagSelectorProps {
    value: string[];
    onChange: (tags: string[]) => void;
    labelledBy: string;
}

/** Optional multi-select descriptors (toggle buttons). */
export const MoodTagSelector: React.FC<MoodTagSelectorProps> = ({ value, onChange, labelledBy }) => (
    <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-3 gap-2">
        {DAILY_CHECK_IN_MOOD_TAGS.map(tag => {
            const selected = value.includes(tag);
            const Icon = TAG_ICONS[tag];
            return (
                <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(selected ? value.filter(t => t !== tag) : [...value, tag])}
                    className={cn(
                        'flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border px-2 py-2 text-sm motion-safe:transition-colors',
                        FOCUS_RING,
                        selected
                            ? 'border-emerald-400 bg-emerald-500/15 font-semibold text-emerald-200'
                            : 'border-white/10 bg-neutral-900/60 text-neutral-300 hover:border-white/25 hover:text-white',
                    )}
                >
                    <Icon size={16} aria-hidden="true" className={selected ? 'text-emerald-300' : 'text-neutral-400'} />
                    {MOOD_TAG_LABELS[tag]}
                </button>
            );
        })}
    </div>
);
