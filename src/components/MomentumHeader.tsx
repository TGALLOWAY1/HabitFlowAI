import React from 'react';
import { Sparkles, Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MomentumState } from '../types';

interface MomentumHeaderProps {
    globalMomentum: {
        state: MomentumState;
        copy: string;
        activeDays: number;
        trend: 'up' | 'down' | 'neutral';
    };
}

export const MomentumHeader: React.FC<MomentumHeaderProps> = ({ globalMomentum }) => {
    const { state, copy, activeDays, trend } = globalMomentum;

    // Visual configurations for each state
    const stateConfig: Record<string, { color: string; icon: React.ReactNode; bgGradient: string }> = {
        'Strong': {
            color: 'text-emerald-400',
            icon: <Flame className="text-emerald-400 animate-pulse" size={24} />,
            bgGradient: 'from-emerald-500/20 to-transparent'
        },
        'Steady': {
            color: 'text-blue-400',
            icon: <TrendingUp className="text-blue-400" size={24} />,
            bgGradient: 'from-blue-500/20 to-transparent'
        },
        'Building': {
            color: 'text-amber-400',
            icon: <Sparkles className="text-amber-400" size={24} />,
            bgGradient: 'from-amber-500/20 to-transparent'
        },
        'Gentle Restart': {
            color: 'text-violet-400',
            icon: <Sparkles className="text-violet-400" size={24} />,
            bgGradient: 'from-violet-500/20 to-transparent'
        },
        'Ready': {
            color: 'text-neutral-400',
            icon: <Sparkles className="text-neutral-400" size={24} />,
            bgGradient: 'from-white/10 to-transparent'
        }
    };

    const config = stateConfig[state] || stateConfig['Ready'];

    return (
        <div className={`relative overflow-hidden rounded-2xl border border-white/5 bg-neutral-900/50 p-6 backdrop-blur-sm mb-6 group`}>
            {/* Ambient Gradient Background */}
            <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${config.bgGradient} opacity-30 pointer-events-none transition-opacity duration-1000`} />

            <div className="relative z-10 flex flex-col items-center text-center space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    {config.icon}
                    <h2 className={`text-3xl font-bold tracking-tight ${config.color} drop-shadow-sm`}>
                        {state}
                    </h2>
                </div>

                <p className="text-neutral-300 text-base max-w-lg leading-relaxed font-medium">
                    {copy}
                </p>

                {activeDays > 0 && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 text-xs text-neutral-400">
                        <span>{activeDays} Active Days (Last 7)</span>
                        {trend === 'up' && <TrendingUp size={12} className="text-emerald-500" />}
                        {trend === 'down' && <TrendingDown size={12} className="text-rose-500" />}
                        {trend === 'neutral' && <Minus size={12} className="text-neutral-500" />}
                    </div>
                )}
            </div>
        </div>
    );
};
