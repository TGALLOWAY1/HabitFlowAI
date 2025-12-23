import React from 'react';
import { Activity } from 'lucide-react';
import type { Routine } from '../../../models/persistenceTypes';
import { ReadinessSnapshot } from './ReadinessSnapshot';
import { SleepEnergyTrends } from './SleepEnergyTrends';

type Props = {
  onOpenCheckIn: () => void;
  onNavigateWellbeingHistory?: () => void;
  onStartRoutine?: (routine: Routine) => void;
};

export const FitnessDashboard: React.FC<Props> = ({ onOpenCheckIn, onNavigateWellbeingHistory, onStartRoutine }) => {
  return (
    <div className="space-y-6 overflow-y-auto pb-20">
      {/* Persona Header actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onOpenCheckIn}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/5"
        >
          <Activity size={16} className="text-emerald-400" />
          Daily Check-in
        </button>
        {onNavigateWellbeingHistory && (
          <button
            onClick={onNavigateWellbeingHistory}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/5"
          >
            <Activity size={16} className="text-emerald-400" />
            Wellbeing History
          </button>
        )}
      </div>

      {/* Daily Context Card - spans left + center columns per layout contract */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <ReadinessSnapshot />
        </div>
        {/* Right column: Quick Log (top) + Sleep/Energy Trends (below) */}
        <div className="md:col-span-1 space-y-4">
          {/* Placeholder for Quick Log */}
          <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6">
            <div className="text-sm text-neutral-400">Quick Log (coming soon)</div>
          </div>
          {/* Sleep Quality Trend + Energy Level Trend - stacked vertically, half-width card */}
          <SleepEnergyTrends />
        </div>
      </div>

      {/* Action Cards, Activity Map, Goals will go here per layout contract */}
    </div>
  );
};

