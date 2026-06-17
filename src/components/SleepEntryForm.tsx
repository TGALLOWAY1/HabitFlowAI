import React, { useEffect, useState } from 'react';
import { X, Save, Watch, Clock, Sunrise, Moon, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  fetchWellbeingEntries,
  upsertWellbeingEntries,
  fetchDashboardPrefs,
  updateDashboardPrefs,
  getLocalTimeZone,
} from '../lib/persistenceClient';
import type { WellbeingMetricKey } from '../models/persistenceTypes';
import {
  timeStringToMinutesAfterNoon,
  minutesAfterNoonToTimeString,
} from './analytics/sleep/sleepFormat';

interface SleepEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const DEFAULT_TARGETS = { bedtimeMinutes: 600, wakeMinutes: 1080, durationMinutes: 480 };

/** numeric field state stored as string for controlled inputs */
type NumStr = string;

export const SleepEntryForm: React.FC<SleepEntryFormProps> = ({ isOpen, onClose, onSaved }) => {
  const today = format(new Date(), 'yyyy-MM-dd');

  // Sleep results
  const [bedtime, setBedtime] = useState('');     // "HH:MM" 24h
  const [wake, setWake] = useState('');
  const [appleScore, setAppleScore] = useState<NumStr>('');
  const [bedtimeScore, setBedtimeScore] = useState<NumStr>('');
  const [durationScore, setDurationScore] = useState<NumStr>('');
  const [interruptionScore, setInterruptionScore] = useState<NumStr>('');
  const [durationH, setDurationH] = useState<NumStr>('');
  const [durationM, setDurationM] = useState<NumStr>('');
  const [quality, setQuality] = useState<number>(2);

  // Last night's habits
  const [aidUsed, setAidUsed] = useState(false);
  const [phoneInBed, setPhoneInBed] = useState(false);
  const [windDown, setWindDown] = useState(false);
  const [lateEating, setLateEating] = useState(false);
  const [blueLight, setBlueLight] = useState<NumStr>('');
  const [caffeine, setCaffeine] = useState<NumStr>('');

  // Targets
  const [showTargets, setShowTargets] = useState(false);
  const [targetBedtime, setTargetBedtime] = useState(minutesAfterNoonToTimeString(DEFAULT_TARGETS.bedtimeMinutes));
  const [targetWake, setTargetWake] = useState(minutesAfterNoonToTimeString(DEFAULT_TARGETS.wakeMinutes));
  const [targetDurationH, setTargetDurationH] = useState('8');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [entries, prefs] = await Promise.all([
          fetchWellbeingEntries({ startDayKey: today, endDayKey: today }),
          fetchDashboardPrefs(),
        ]);
        if (cancelled) return;
        const byKey = new Map<string, number>();
        for (const e of entries) {
          if (e.timeOfDay === 'morning' && typeof e.value === 'number') byKey.set(e.metricKey, e.value);
        }
        const num = (k: string) => (byKey.has(k) ? String(byKey.get(k)) : '');
        if (byKey.has('sleepBedtimeMinutes')) setBedtime(minutesAfterNoonToTimeString(byKey.get('sleepBedtimeMinutes')!));
        if (byKey.has('sleepWakeMinutes')) setWake(minutesAfterNoonToTimeString(byKey.get('sleepWakeMinutes')!));
        setAppleScore(num('appleSleepScore'));
        setBedtimeScore(num('appleSleepBedtimeScore'));
        setDurationScore(num('appleSleepDurationScore'));
        setInterruptionScore(num('appleSleepInterruptionScore'));
        if (byKey.has('sleepDurationMinutes')) {
          const d = byKey.get('sleepDurationMinutes')!;
          setDurationH(String(Math.floor(d / 60)));
          setDurationM(String(d % 60));
        }
        if (byKey.has('sleepQuality')) setQuality(byKey.get('sleepQuality')!);
        setAidUsed((byKey.get('sleepAidUsed') ?? 0) >= 1);
        setPhoneInBed((byKey.get('factorPhoneInBed') ?? 0) >= 1);
        setWindDown((byKey.get('factorWindDown') ?? 0) >= 1);
        setLateEating((byKey.get('factorLateNightEating') ?? 0) >= 1);
        setBlueLight(num('factorBlueLightMinutes'));
        setCaffeine(num('factorCaffeineAfter12'));

        const t = prefs.sleepTargets ?? DEFAULT_TARGETS;
        setTargetBedtime(minutesAfterNoonToTimeString(t.bedtimeMinutes));
        setTargetWake(minutesAfterNoonToTimeString(t.wakeMinutes));
        setTargetDurationH(String(Math.round((t.durationMinutes / 60) * 10) / 10));
      } catch {
        // best-effort prefill
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, today]);

  if (!isOpen) return null;

  const parseIntOrNull = (s: string): number | null => {
    if (s.trim() === '') return null;
    const n = Math.round(Number(s));
    return Number.isFinite(n) ? n : null;
  };

  /**
   * Apple's sleep score = duration (0-50) + bedtime (0-25) + interruption (0-25).
   * When the user enters any sub-score, auto-fill the overall as their sum so the
   * primary signal stays consistent (still manually overridable afterward).
   */
  const setSubScore = (which: 'bedtime' | 'duration' | 'interruption', raw: string) => {
    const next = { bedtime: bedtimeScore, duration: durationScore, interruption: interruptionScore };
    next[which] = raw;
    if (which === 'bedtime') setBedtimeScore(raw);
    if (which === 'duration') setDurationScore(raw);
    if (which === 'interruption') setInterruptionScore(raw);
    const anyPresent = [next.bedtime, next.duration, next.interruption].some((v) => v.trim() !== '');
    if (anyPresent) {
      const sum = (parseIntOrNull(next.bedtime) ?? 0) + (parseIntOrNull(next.duration) ?? 0) + (parseIntOrNull(next.interruption) ?? 0);
      setAppleScore(String(sum));
    }
  };

  const computedDuration = (): number | null => {
    const h = parseIntOrNull(durationH);
    const m = parseIntOrNull(durationM);
    if (h === null && m === null) {
      // derive from bedtime/wake if available
      const b = timeStringToMinutesAfterNoon(bedtime);
      const w = timeStringToMinutesAfterNoon(wake);
      if (b !== null && w !== null) {
        const diff = (w - b + 1440) % 1440;
        return diff;
      }
      return null;
    }
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const handleSave = async () => {
    setSaving(true);
    const entries: Array<{ dayKey: string; timeOfDay: 'morning'; metricKey: WellbeingMetricKey; value: number; source: 'checkin' }> = [];
    const push = (metricKey: WellbeingMetricKey, value: number | null) => {
      if (value === null) return;
      entries.push({ dayKey: today, timeOfDay: 'morning', metricKey, value, source: 'checkin' });
    };

    const bedMin = timeStringToMinutesAfterNoon(bedtime);
    const wakeMin = timeStringToMinutesAfterNoon(wake);
    push('sleepBedtimeMinutes', bedMin);
    push('sleepWakeMinutes', wakeMin);
    push('sleepDurationMinutes', computedDuration());
    push('appleSleepScore', parseIntOrNull(appleScore));
    push('appleSleepBedtimeScore', parseIntOrNull(bedtimeScore));
    push('appleSleepDurationScore', parseIntOrNull(durationScore));
    push('appleSleepInterruptionScore', parseIntOrNull(interruptionScore));
    push('sleepQuality', quality);
    // factors (toggles always represent the night)
    push('sleepAidUsed', aidUsed ? 1 : 0);
    push('factorPhoneInBed', phoneInBed ? 1 : 0);
    push('factorWindDown', windDown ? 1 : 0);
    push('factorLateNightEating', lateEating ? 1 : 0);
    push('factorBlueLightMinutes', parseIntOrNull(blueLight));
    push('factorCaffeineAfter12', parseIntOrNull(caffeine));

    try {
      if (entries.length > 0) {
        await upsertWellbeingEntries({ entries, defaultTimeZone: getLocalTimeZone() });
      }
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('[SleepEntryForm] Failed to save sleep entry:', error);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const saveTargets = async () => {
    const b = timeStringToMinutesAfterNoon(targetBedtime) ?? DEFAULT_TARGETS.bedtimeMinutes;
    const w = timeStringToMinutesAfterNoon(targetWake) ?? DEFAULT_TARGETS.wakeMinutes;
    const durH = Number(targetDurationH);
    const durationMinutes = Number.isFinite(durH) ? Math.round(durH * 60) : DEFAULT_TARGETS.durationMinutes;
    try {
      await updateDashboardPrefs({ sleepTargets: { bedtimeMinutes: b, wakeMinutes: w, durationMinutes } });
      setShowTargets(false);
    } catch (error) {
      console.error('[SleepEntryForm] Failed to save targets:', error);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-neutral-800/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Moon size={18} className="text-indigo-400" /> Log Sleep
          </h2>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto modal-scroll p-5 space-y-6">
          {/* Apple Watch Sleep Score */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-2">
              <Watch size={14} className="text-indigo-400" /> Apple Watch Sleep Score
            </h3>
            <NumberField label="Overall (0-100, auto-sums from components)" value={appleScore} onChange={setAppleScore} max={100} />
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="Duration /50" value={durationScore} onChange={(v) => setSubScore('duration', v)} max={50} small />
              <NumberField label="Bedtime /25" value={bedtimeScore} onChange={(v) => setSubScore('bedtime', v)} max={25} small />
              <NumberField label="Interrupt. /25" value={interruptionScore} onChange={(v) => setSubScore('interruption', v)} max={25} small />
            </div>
          </section>

          {/* Sleep results */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Sleep results</h3>
            <div className="grid grid-cols-2 gap-3">
              <TimeField label="Bedtime" icon={<Clock size={14} className="text-sky-400" />} value={bedtime} onChange={setBedtime} />
              <TimeField label="Wake time" icon={<Sunrise size={14} className="text-orange-400" />} value={wake} onChange={setWake} />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Duration (auto from times if blank)</label>
              <div className="flex items-center gap-2">
                <NumberField value={durationH} onChange={setDurationH} placeholder="h" inline />
                <span className="text-neutral-500 text-sm">h</span>
                <NumberField value={durationM} onChange={setDurationM} placeholder="m" max={59} inline />
                <span className="text-neutral-500 text-sm">m</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <label className="text-neutral-300 font-medium">Sleep quality</label>
                <span className="text-fuchsia-300 font-bold">{quality}/4</span>
              </div>
              <input type="range" min={0} max={4} step={1} value={quality} onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
            </div>
          </section>

          {/* Last night's habits */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Last night's habits</h3>
            <Toggle label="Used a sleep aid" value={aidUsed} onChange={setAidUsed} />
            <Toggle label="Phone in bed" value={phoneInBed} onChange={setPhoneInBed} />
            <Toggle label="Wind-down routine" value={windDown} onChange={setWindDown} />
            <Toggle label="Late-night eating (within ~3h)" value={lateEating} onChange={setLateEating} />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <NumberField label="Blue light (min)" value={blueLight} onChange={setBlueLight} />
              <NumberField label="Caffeine after 12 (count)" value={caffeine} onChange={setCaffeine} />
            </div>
          </section>

          {/* Targets */}
          <section>
            <button onClick={() => setShowTargets((s) => !s)} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5">
              <Settings2 size={13} /> Sleep goal (targets)
            </button>
            {showTargets && (
              <div className="mt-3 space-y-3 bg-neutral-800/40 rounded-xl p-3">
                <div className="grid grid-cols-2 gap-3">
                  <TimeField label="Target bedtime" value={targetBedtime} onChange={setTargetBedtime} />
                  <TimeField label="Target wake" value={targetWake} onChange={setTargetWake} />
                </div>
                <NumberField label="Target duration (h)" value={targetDurationH} onChange={setTargetDurationH} />
                <button onClick={saveTargets} className="text-xs px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg">
                  Save targets
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="p-4 border-t border-white/5 bg-neutral-800/50 flex justify-end">
          <button onClick={handleSave} disabled={saving} type="button"
            className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg font-medium transition-colors">
            <Save size={18} /> {saving ? 'Saving…' : 'Save Sleep'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Small inputs ──────────────────────────────────────────────────────────────

function NumberField({ label, value, onChange, max, small, inline, placeholder }: {
  label?: string; value: string; onChange: (v: string) => void; max?: number; small?: boolean; inline?: boolean; placeholder?: string;
}) {
  return (
    <div className={inline ? '' : 'space-y-1'}>
      {label && <label className={`text-xs text-neutral-400 block ${small ? 'text-[10px]' : ''}`}>{label}</label>}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none ${inline ? 'w-16' : 'w-full'}`}
      />
    </div>
  );
}

function TimeField({ label, value, onChange, icon }: { label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-neutral-400 flex items-center gap-1.5">{icon}{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="w-full flex items-center justify-between py-2">
      <span className="text-sm text-neutral-300">{label}</span>
      <span className={`relative w-10 h-6 rounded-full transition-colors ${value ? 'bg-emerald-500' : 'bg-neutral-700'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}
