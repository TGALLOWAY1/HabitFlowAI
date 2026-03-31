import React from 'react';
import { Flame, CheckCircle2, Star, Award, Zap, Lock } from 'lucide-react';
import type { Achievement } from '../../lib/analyticsClient';

interface AchievementsSectionProps {
  data: Achievement[] | null;
  loading: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  streak: Flame,
  completions: CheckCircle2,
  week: Star,
  consistency: Award,
  first: Zap,
};

export const AchievementsSection: React.FC<AchievementsSectionProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Achievements</h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-24 h-28 bg-neutral-800 rounded-xl animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  // Sort: earned first, then by id
  const sorted = [...data].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  const earnedCount = sorted.filter(a => a.earned).length;

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-purple-500/10 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-400">Achievements</h3>
        <span className="text-xs text-purple-400 font-medium">{earnedCount}/{sorted.length}</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {sorted.map(achievement => {
          const Icon = iconMap[achievement.icon] ?? Star;
          return (
            <div
              key={achievement.id}
              className={`shrink-0 w-24 rounded-xl p-3 text-center transition-all ${
                achievement.earned
                  ? 'bg-gradient-to-b from-purple-500/20 to-emerald-500/10 border border-purple-500/25'
                  : 'bg-neutral-800/50 border border-white/5 opacity-40'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${
                achievement.earned
                  ? 'bg-purple-500/20'
                  : 'bg-neutral-700/50'
              }`}>
                {achievement.earned ? (
                  <Icon size={20} className="text-purple-300" />
                ) : (
                  <Lock size={16} className="text-neutral-500" />
                )}
              </div>
              <div className={`text-[10px] font-medium mt-2 leading-tight ${
                achievement.earned ? 'text-white' : 'text-neutral-500'
              }`}>
                {achievement.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
