import React, { useEffect, useState } from 'react';
import { ArrowLeft, LayoutDashboard, GitCompareArrows, Activity, Pill, TrendingUp, Sparkles } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { OverviewTab } from './insights/OverviewTab';
import { CorrelationsTab } from './insights/CorrelationsTab';
import { PredictionsTab } from './insights/PredictionsTab';
import { HabitInsightsTab } from './insights/HabitInsightsTab';
import { MedicationInsightsTab } from './insights/MedicationInsightsTab';
import { AIReviewTab } from './insights/AIReviewTab';
import { isBetaViewer } from '../lib/betaAccess';

type Props = {
  onBack: () => void;
};

export type InsightsTab = 'overview' | 'correlations' | 'habits' | 'medications' | 'predictions' | 'ai-review';
export type InsightsWindow = 30 | 90 | 180;

const TABS: Array<{ id: InsightsTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'correlations', label: 'Correlations', icon: GitCompareArrows },
  { id: 'habits', label: 'Habits', icon: Activity },
  { id: 'medications', label: 'Medications', icon: Pill },
  { id: 'predictions', label: 'Predictions', icon: TrendingUp },
  { id: 'ai-review', label: 'AI Review', icon: Sparkles },
];

export const WellbeingHistoryPage: React.FC<Props> = ({ onBack }) => {
  const { user } = useAuth();
  const isAuthorized = isBetaViewer(user);

  const [windowDays, setWindowDays] = useState<InsightsWindow>(90);
  const [tab, setTab] = useState<InsightsTab>('overview');

  useEffect(() => {
    if (!isAuthorized) onBack();
  }, [isAuthorized, onBack]);

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-white/5 text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex gap-3">
          {([30, 90, 180] as const).map((d) => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`pb-2 px-2 text-xs font-semibold transition-colors relative ${
                windowDays === d ? 'text-emerald-400' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {d}d
              {windowDays === d && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-white">Insights</h2>
          <div className="text-xs text-neutral-500 mt-1">
            Patterns, correlations, and predictions from your check-ins, habits, and health tracking.
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/5 mb-6 -mx-1 px-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 pb-3 px-3 text-xs font-semibold transition-colors relative ${
                tab === id ? 'text-emerald-400' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon size={14} />
                {label}
              </div>
              {tab === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />}
            </button>
          ))}
        </div>

        {tab === 'overview' ? (
          <OverviewTab days={windowDays} />
        ) : tab === 'correlations' ? (
          <CorrelationsTab days={windowDays} />
        ) : tab === 'habits' ? (
          <HabitInsightsTab days={windowDays} />
        ) : tab === 'medications' ? (
          <MedicationInsightsTab days={windowDays} />
        ) : tab === 'predictions' ? (
          <PredictionsTab days={windowDays} />
        ) : (
          <AIReviewTab days={windowDays} />
        )}
      </div>
    </div>
  );
};
