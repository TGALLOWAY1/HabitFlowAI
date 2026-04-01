import React from 'react';
import { Calendar, BarChart3, Percent, Star, Sun, Moon, Layers } from 'lucide-react';
import type { BehaviorPatterns as BehaviorPatternsType } from '../../lib/analyticsClient';

interface BehaviorPatternsProps {
  data: BehaviorPatternsType | null;
  loading: boolean;
}

interface PatternCard {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}

export const BehaviorPatterns: React.FC<BehaviorPatternsProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Behavior Patterns</h3>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-neutral-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const cards: PatternCard[] = [
    {
      icon: Calendar,
      label: 'Most Consistent',
      value: `${data.mostConsistentDay.day} (${Math.round(data.mostConsistentDay.rate * 100)}%)`,
      color: 'text-emerald-400',
    },
    {
      icon: BarChart3,
      label: 'Avg Habits/Day',
      value: `${data.avgHabitsPerDay}`,
      color: 'text-teal-400',
    },
    {
      icon: BarChart3,
      label: 'Avg Habits/Week',
      value: `${data.avgHabitsPerWeek}`,
      color: 'text-teal-400',
    },
    {
      icon: Percent,
      label: 'Days With Activity',
      value: `${Math.round(data.percentDaysWithCompletion * 100)}%`,
      color: 'text-blue-400',
    },
    {
      icon: Star,
      label: 'Best Week',
      value: `${data.bestWeek.completions} (${data.bestWeek.label})`,
      color: 'text-emerald-400',
    },
    ...(data.weekdayRate !== data.weekendRate ? [{
      icon: data.weekdayRate > data.weekendRate ? Sun : Moon,
      label: 'Stronger On',
      value: data.weekdayRate > data.weekendRate
        ? `Weekdays (${Math.round(data.weekdayRate * 100)}%)`
        : `Weekends (${Math.round(data.weekendRate * 100)}%)`,
      color: 'text-blue-400' as const,
    }] : []),
  ];

  // Add category cards if available
  if (data.mostCompletedCategory) {
    cards.push({
      icon: Layers,
      label: 'Top Category',
      value: `${data.mostCompletedCategory.name} (${data.mostCompletedCategory.completions})`,
      color: 'text-emerald-400',
    });
  }

  return (
    <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-5 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-4">Behavior Patterns</h3>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-neutral-800/50 rounded-xl p-3 flex items-start gap-2.5">
              <Icon size={14} className={`${card.color} shrink-0 mt-0.5`} />
              <div className="min-w-0">
                <div className="text-[10px] text-neutral-500 font-medium">{card.label}</div>
                <div className="text-xs text-white font-medium mt-0.5 truncate">{card.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
