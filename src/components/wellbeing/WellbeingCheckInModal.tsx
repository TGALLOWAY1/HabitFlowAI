import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, Sun, Moon, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useHabitStore } from '../../store/HabitContext';
import type { WellbeingSession } from '../../types';
import type { WellbeingMetricKey } from '../../models/persistenceTypes';

export type CheckInMode = 'morning' | 'evening';

interface WellbeingCheckInModalProps {
  isOpen: boolean;
  mode: CheckInMode;
  onClose: () => void;
  /** Morning-only: render the "Medications Taken Today" section. */
  medicationSection?: React.ReactNode;
}

type SliderConfig = {
  key: WellbeingMetricKey;
  label: string;
  min: number;
  max: number;
  lowLabel?: string;
  highLabel?: string;
};

const MORNING_REQUIRED: SliderConfig[] = [
  { key: 'mood', label: 'Mood', min: 1, max: 5, lowLabel: 'Low', highLabel: 'Great' },
  { key: 'energy', label: 'Energy', min: 1, max: 5, lowLabel: 'Drained', highLabel: 'Energized' },
  { key: 'anxiety', label: 'Anxiety', min: 1, max: 5, lowLabel: 'Calm', highLabel: 'Anxious' },
  { key: 'motivation', label: 'Motivation', min: 1, max: 5, lowLabel: 'Low', highLabel: 'High' },
  { key: 'focus', label: 'Focus', min: 0, max: 4, lowLabel: 'Scattered', highLabel: 'Sharp' },
];

const MORNING_OPTIONAL: SliderConfig[] = [
  { key: 'brainFog', label: 'Brain Fog', min: 1, max: 5, lowLabel: 'Clear', highLabel: 'Foggy' },
  { key: 'stress', label: 'Stress', min: 0, max: 4, lowLabel: 'Relaxed', highLabel: 'Stressed' },
  { key: 'confidence', label: 'Confidence', min: 1, max: 5, lowLabel: 'Low', highLabel: 'High' },
  { key: 'irritability', label: 'Irritability', min: 1, max: 5, lowLabel: 'Patient', highLabel: 'Irritable' },
  { key: 'socialBattery', label: 'Social Battery', min: 1, max: 5, lowLabel: 'Drained', highLabel: 'Charged' },
];

const EVENING_REQUIRED: SliderConfig[] = [
  { key: 'satisfaction', label: 'Satisfaction', min: 0, max: 4, lowLabel: 'Low', highLabel: 'High' },
  { key: 'productivity', label: 'Productivity', min: 1, max: 5, lowLabel: 'Low', highLabel: 'High' },
  { key: 'mood', label: 'Mood', min: 1, max: 5, lowLabel: 'Low', highLabel: 'Great' },
  { key: 'stress', label: 'Stress', min: 0, max: 4, lowLabel: 'Relaxed', highLabel: 'Stressed' },
  { key: 'enjoyment', label: 'Enjoyment', min: 1, max: 5, lowLabel: 'Low', highLabel: 'High' },
];

const EVENING_OPTIONAL: SliderConfig[] = [
  { key: 'socialConnection', label: 'Social Connection', min: 1, max: 5, lowLabel: 'Isolated', highLabel: 'Connected' },
  { key: 'gratitude', label: 'Gratitude', min: 1, max: 5, lowLabel: 'Low', highLabel: 'High' },
  { key: 'fulfillment', label: 'Fulfillment', min: 1, max: 5, lowLabel: 'Low', highLabel: 'High' },
];

// Quick day-impact tags (Phase 3). Stored as a comma-separated string in `dayTags`.
const DAY_TAGS: Array<{ id: string; label: string }> = [
  { id: 'poorSleep', label: 'Poor Sleep' },
  { id: 'workStress', label: 'Work Stress' },
  { id: 'familyStress', label: 'Family Stress' },
  { id: 'illness', label: 'Illness' },
  { id: 'travel', label: 'Travel' },
  { id: 'socialEvent', label: 'Social Event' },
  { id: 'medicationChange', label: 'Medication Change' },
];

function midpoint(cfg: SliderConfig): number {
  return Math.round((cfg.min + cfg.max) / 2);
}

const Slider: React.FC<{
  cfg: SliderConfig;
  value: number;
  onChange: (v: number) => void;
}> = ({ cfg, value, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-sm">
      <label className="text-neutral-300 font-medium">{cfg.label}</label>
      <span className="text-emerald-400 font-bold tabular-nums">{value}</span>
    </div>
    <input
      type="range"
      min={cfg.min}
      max={cfg.max}
      step={1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
    />
    <div className="flex justify-between text-xs text-neutral-500 px-0.5">
      <span>{cfg.lowLabel ?? 'Low'}</span>
      <span>{cfg.highLabel ?? 'High'}</span>
    </div>
  </div>
);

export const WellbeingCheckInModal: React.FC<WellbeingCheckInModalProps> = ({
  isOpen,
  mode,
  onClose,
  medicationSection,
}) => {
  const { logWellbeing, wellbeingLogs } = useHabitStore();
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const required = mode === 'morning' ? MORNING_REQUIRED : EVENING_REQUIRED;
  const optional = mode === 'morning' ? MORNING_OPTIONAL : EVENING_OPTIONAL;

  const [values, setValues] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [bestPart, setBestPart] = useState('');
  const [challenge, setChallenge] = useState('');
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Prefill from existing data for today (if any).
  useEffect(() => {
    if (!isOpen) return;
    const session = (wellbeingLogs[today]?.[mode] ?? {}) as Record<string, unknown>;

    const next: Record<string, number> = {};
    let hasOptional = false;
    for (const cfg of [...required, ...optional]) {
      const raw = session[cfg.key];
      next[cfg.key] = typeof raw === 'number' ? raw : midpoint(cfg);
    }
    for (const cfg of optional) {
      if (typeof session[cfg.key] === 'number') hasOptional = true;
    }
    setValues(next);
    setOptionalOpen(hasOptional);
    setNotes(typeof session.notes === 'string' ? session.notes : '');

    if (mode === 'evening') {
      setBestPart(typeof session.eveningBestPart === 'string' ? (session.eveningBestPart as string) : '');
      setChallenge(typeof session.eveningChallenge === 'string' ? (session.eveningChallenge as string) : '');
      const rawTags = typeof session.dayTags === 'string' ? (session.dayTags as string) : '';
      setTags(new Set(rawTags.split(',').map((t) => t.trim()).filter(Boolean)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, today]);

  if (!isOpen) return null;

  const HeaderIcon = mode === 'morning' ? Sun : Moon;
  const accent = mode === 'morning' ? 'text-amber-400' : 'text-indigo-400';
  const heading = mode === 'morning' ? 'Morning Check-in' : 'Evening Check-in';
  const question = mode === 'morning' ? 'How do I feel right now?' : 'How did today go?';

  const setValue = (key: string, v: number) => setValues((prev) => ({ ...prev, [key]: v }));

  const toggleTag = (id: string) =>
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSave = async () => {
    setSaving(true);
    const session: Partial<WellbeingSession> = {};
    // Required metrics are always recorded; optional only when the panel is open.
    for (const cfg of required) (session as Record<string, unknown>)[cfg.key] = values[cfg.key];
    if (optionalOpen) {
      for (const cfg of optional) (session as Record<string, unknown>)[cfg.key] = values[cfg.key];
    }
    if (notes.trim()) session.notes = notes.trim();

    if (mode === 'evening') {
      if (bestPart.trim()) (session as Record<string, unknown>).eveningBestPart = bestPart.trim();
      if (challenge.trim()) (session as Record<string, unknown>).eveningChallenge = challenge.trim();
      if (tags.size > 0) (session as Record<string, unknown>).dayTags = Array.from(tags).join(',');
    }

    try {
      await logWellbeing(today, { date: today, [mode]: session });
    } catch (error) {
      console.error('[WellbeingCheckInModal] Failed to save:', error);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="border-b border-white/5 bg-neutral-800/50 p-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <HeaderIcon size={20} className={accent} />
            <div>
              <h2 className="text-lg font-semibold text-white leading-tight">{heading}</h2>
              <p className="text-xs text-neutral-400">{question}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors -mr-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto modal-scroll p-6 space-y-6">
          {required.map((cfg) => (
            <Slider key={cfg.key} cfg={cfg} value={values[cfg.key] ?? midpoint(cfg)} onChange={(v) => setValue(cfg.key, v)} />
          ))}

          {/* Optional metrics */}
          <div className="border-t border-white/5 pt-4">
            <button
              onClick={() => setOptionalOpen((o) => !o)}
              className="flex items-center justify-between w-full text-sm font-medium text-neutral-300 hover:text-white transition-colors"
            >
              <span>More (optional)</span>
              {optionalOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {optionalOpen && (
              <div className="space-y-6 mt-4">
                {optional.map((cfg) => (
                  <Slider key={cfg.key} cfg={cfg} value={values[cfg.key] ?? midpoint(cfg)} onChange={(v) => setValue(cfg.key, v)} />
                ))}
              </div>
            )}
          </div>

          {/* Evening reflection + tags */}
          {mode === 'evening' && (
            <div className="border-t border-white/5 pt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-neutral-300 font-medium">Best part of today?</label>
                <textarea
                  value={bestPart}
                  onChange={(e) => setBestPart(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none resize-none h-16"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-neutral-300 font-medium">Biggest challenge today?</label>
                <textarea
                  value={challenge}
                  onChange={(e) => setChallenge(e.target.value)}
                  className="w-full bg-neutral-800 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none resize-none h-16"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-neutral-300 font-medium">What impacted your day?</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_TAGS.map((tag) => {
                    const selected = tags.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-neutral-800 border-white/10 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Morning medications */}
          {mode === 'morning' && medicationSection && (
            <div className="border-t border-white/5 pt-4">{medicationSection}</div>
          )}

          {/* Notes */}
          {mode === 'morning' && (
            <div className="border-t border-white/5 pt-4 space-y-2">
              <label className="text-sm text-neutral-300 font-medium">
                Anything affecting your morning today?
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-neutral-800 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none resize-none h-16"
                placeholder="Optional"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-neutral-800/50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg font-medium transition-colors"
          >
            <Save size={18} />
            Save {mode === 'morning' ? 'Morning' : 'Evening'} Check-in
          </button>
        </div>
      </div>
    </div>
  );
};
