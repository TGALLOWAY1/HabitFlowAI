import React from 'react';
import { BarChart3, Calendar, Target, ClipboardList, TrendingUp } from 'lucide-react';

type TabRoute = 'dashboard' | 'tracker' | 'journal' | 'goals' | 'routines' | 'tasks' | 'analytics';

interface BottomTabBarProps {
  activeView: string;
  onNavigate: (route: TabRoute) => void;
}

const tabs: { route: TabRoute; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { route: 'tracker', label: 'Habits', icon: Calendar },
  { route: 'routines', label: 'Routines', icon: ClipboardList },
  { route: 'goals', label: 'Goals', icon: Target },
  { route: 'analytics', label: 'Analytics', icon: TrendingUp },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeView, onNavigate }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-900 border-t border-white/10 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center justify-around max-w-lg mx-auto h-14">
        {tabs.map(({ route, label, icon: Icon }) => {
          const isActive = activeView === route;
          return (
            <button
              key={route}
              onClick={() => onNavigate(route)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[3rem] py-1 px-1 transition-colors ${
                isActive
                  ? 'text-emerald-400'
                  : 'text-neutral-500 active:text-neutral-300'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} className={isActive ? 'text-emerald-400' : ''} />
              <span className={`text-[10px] font-medium leading-tight ${isActive ? 'text-emerald-400' : ''}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
