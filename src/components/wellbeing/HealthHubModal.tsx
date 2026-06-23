import React, { useState } from 'react';
import { X, Moon, Pill, ChevronRight, Activity, Scale, Coffee, Wine, Leaf } from 'lucide-react';
import { SleepEntryForm } from '../SleepEntryForm';
import { MedicationManagerModal } from './MedicationManagerModal';
import { HealthFactorLogModal } from './HealthFactorLogModal';
import { SymptomManagerModal } from './SymptomManagerModal';

interface HealthHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Health Hub — entry point for health tracking. Sleep, Medications, Weight, Caffeine
 * and Alcohol are live; symptoms and supplements are surfaced as "coming soon".
 */
export const HealthHubModal: React.FC<HealthHubModalProps> = ({ isOpen, onClose }) => {
  const [sleepOpen, setSleepOpen] = useState(false);
  const [medsOpen, setMedsOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [caffeineOpen, setCaffeineOpen] = useState(false);
  const [alcoholOpen, setAlcoholOpen] = useState(false);
  const [symptomsOpen, setSymptomsOpen] = useState(false);

  if (!isOpen) return null;

  const liveSections = [
    { icon: Moon, color: 'text-indigo-400', label: 'Sleep', desc: 'Apple Watch score & schedule', onClick: () => setSleepOpen(true) },
    { icon: Pill, color: 'text-rose-400', label: 'Medications', desc: 'Manage medications & dosages', onClick: () => setMedsOpen(true) },
    { icon: Activity, color: 'text-orange-400', label: 'Symptoms', desc: "Track symptoms & today's severity", onClick: () => setSymptomsOpen(true) },
    { icon: Scale, color: 'text-sky-400', label: 'Weight', desc: "Log today's weight", onClick: () => setWeightOpen(true) },
    { icon: Coffee, color: 'text-amber-400', label: 'Caffeine', desc: "Log today's caffeine intake", onClick: () => setCaffeineOpen(true) },
    { icon: Wine, color: 'text-fuchsia-400', label: 'Alcohol', desc: "Log today's drinks", onClick: () => setAlcoholOpen(true) },
  ];

  const comingSoon = [
    { icon: Leaf, label: 'Supplements' },
  ];

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-white/5 bg-neutral-800/50 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Health</h2>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors -mr-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto modal-scroll p-5 space-y-5">
          <div className="space-y-2">
            {liveSections.map(({ icon: Icon, color, label, desc, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-800/40 border border-white/5 rounded-xl hover:border-white/15 transition-colors text-left"
              >
                <Icon size={20} className={color} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-white font-medium">{label}</span>
                  <span className="block text-[11px] text-neutral-500">{desc}</span>
                </span>
                <ChevronRight size={16} className="text-neutral-600 shrink-0" />
              </button>
            ))}
          </div>

          <div>
            <div className="text-xs font-semibold text-neutral-400 mb-2">Coming soon</div>
            <div className="flex flex-wrap gap-2">
              {comingSoon.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/40 border border-white/5 text-xs text-neutral-500"
                >
                  <Icon size={13} /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SleepEntryForm isOpen={sleepOpen} onClose={() => setSleepOpen(false)} />
      <MedicationManagerModal isOpen={medsOpen} onClose={() => setMedsOpen(false)} />
      <SymptomManagerModal isOpen={symptomsOpen} onClose={() => setSymptomsOpen(false)} />
      <HealthFactorLogModal
        isOpen={weightOpen}
        onClose={() => setWeightOpen(false)}
        metricKey="weight"
        title="Weight"
        Icon={Scale}
        iconColor="text-sky-400"
        unit="lbs"
        step={0.1}
        helpText="Record one weight reading per day (in pounds)."
      />
      <HealthFactorLogModal
        isOpen={caffeineOpen}
        onClose={() => setCaffeineOpen(false)}
        metricKey="caffeineMg"
        title="Caffeine"
        Icon={Coffee}
        iconColor="text-amber-400"
        unit="mg"
        step={5}
        presets={[
          { label: 'Coffee (95mg)', amount: 95 },
          { label: 'Espresso (63mg)', amount: 63 },
          { label: 'Tea (47mg)', amount: 47 },
          { label: 'Soda (40mg)', amount: 40 },
          { label: 'Energy drink (80mg)', amount: 80 },
        ]}
        helpText="Tap a drink to add it up, or type the total milligrams for today."
      />
      <HealthFactorLogModal
        isOpen={alcoholOpen}
        onClose={() => setAlcoholOpen(false)}
        metricKey="alcoholDrinks"
        title="Alcohol"
        Icon={Wine}
        iconColor="text-fuchsia-400"
        unit="drinks"
        step={1}
        presets={[{ label: '1 drink', amount: 1 }]}
        helpText="Count standard drinks consumed today."
      />
    </div>
  );
};
