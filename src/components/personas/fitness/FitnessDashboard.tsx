import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import type { Routine } from '../../../models/persistenceTypes';
import { ReadinessSnapshot } from './ReadinessSnapshot';
import { SleepEnergyTrends } from './SleepEnergyTrends';
import { QuickLog } from './QuickLog';
import { ActionCards } from './ActionCards';
import { RoutinePreviewModal } from '../../RoutinePreviewModal';
import { PersonaSwitcher } from '../PersonaSwitcher';

type Props = {
  onOpenCheckIn: () => void;
  onNavigateWellbeingHistory?: () => void;
  onStartRoutine?: (routine: Routine) => void;
};

export const FitnessDashboard: React.FC<Props> = ({ onOpenCheckIn, onNavigateWellbeingHistory, onStartRoutine }) => {
  const [previewRoutine, setPreviewRoutine] = useState<Routine | undefined>(undefined);

  const handleViewRoutine = (routine: Routine) => {
    setPreviewRoutine(routine);
  };

  const handleStartFromPreview = (routine: Routine) => {
    setPreviewRoutine(undefined);
    if (onStartRoutine) {
      onStartRoutine(routine);
    }
  };

  return (
    <>
      <div className="space-y-6 overflow-y-auto pb-20">
        {/* Persona Header actions */}
        <div className="flex justify-end gap-2">
          <PersonaSwitcher />
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
            {/* Quick Log - utility affordance, aligned with Daily Context */}
            <QuickLog />
            {/* Sleep Quality Trend + Energy Level Trend - stacked vertically, half-width card */}
            <SleepEnergyTrends />
          </div>
        </div>

        {/* Action Cards - 2×2 grid, spans left + center columns per layout contract */}
        <ActionCards onStartRoutine={onStartRoutine} onViewRoutine={handleViewRoutine} />

        {/* Activity Map + Goals will go here per layout contract */}
      </div>

      {/* Routine Preview Modal */}
      <RoutinePreviewModal
        isOpen={!!previewRoutine}
        routine={previewRoutine}
        onClose={() => setPreviewRoutine(undefined)}
        onStart={handleStartFromPreview}
      />
    </>
  );
};

