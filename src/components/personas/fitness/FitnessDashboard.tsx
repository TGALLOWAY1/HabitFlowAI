import React from 'react';
import { Activity } from 'lucide-react';
import type { Routine } from '../../../models/persistenceTypes';
import { ReadinessSnapshot } from './ReadinessSnapshot';

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
        {/* Right column will be Quick Log (to be implemented) */}
        <div className="md:col-span-1">
          {/* Placeholder for Quick Log */}
        </div>
      </div>

      {/* Action Cards, Activity Map, Goals will go here per layout contract */}
    </div>
  );
};

