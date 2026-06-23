import React, { useEffect, useState } from 'react';
import { X, Check, type LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { WellbeingMetricKey } from '../../models/persistenceTypes';
import { fetchWellbeingEntries, upsertWellbeingEntries } from '../../lib/persistenceClient';

interface HealthFactorPreset {
  label: string;
  /** Amount added to the running value when tapped. */
  amount: number;
}

interface HealthFactorLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Locked wellbeingEntries metric key (weight | caffeineMg | alcoholDrinks). */
  metricKey: Extract<WellbeingMetricKey, 'weight' | 'caffeineMg' | 'alcoholDrinks'>;
  title: string;
  Icon: LucideIcon;
  iconColor: string;
  /** Display unit, e.g. "lbs", "mg", "drinks". */
  unit: string;
  step?: number;
  /** Optional additive quick-add buttons (caffeine/alcohol). */
  presets?: HealthFactorPreset[];
  helpText?: string;
}

/**
 * HealthFactorLogModal — generic once-per-day numeric logger for Health Hub factors.
 * Reads today's value from wellbeingEntries (timeOfDay:null) and upserts on save.
 */
export const HealthFactorLogModal: React.FC<HealthFactorLogModalProps> = ({
  isOpen,
  onClose,
  metricKey,
  title,
  Icon,
  iconColor,
  unit,
  step = 1,
  presets,
  helpText,
}) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [value, setValue] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSaved(false);
    setLoading(true);
    void (async () => {
      try {
        const entries = await fetchWellbeingEntries({ startDayKey: today, endDayKey: today });
        const existing = entries.find((e) => e.metricKey === metricKey && e.timeOfDay == null);
        setValue(typeof existing?.value === 'number' ? existing.value : '');
      } catch (error) {
        console.error('[HealthFactorLog] load failed:', error);
        setValue('');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, metricKey]);

  if (!isOpen) return null;

  const addPreset = (amount: number) => {
    setSaved(false);
    setValue((v) => Math.max(0, Math.round(((typeof v === 'number' ? v : 0) + amount) * 100) / 100));
  };

  const handleSave = async () => {
    if (value === '' || Number.isNaN(Number(value))) return;
    setBusy(true);
    try {
      await upsertWellbeingEntries({
        entries: [
          {
            dayKey: today,
            timeOfDay: null,
            metricKey,
            value: Number(value),
            source: 'checkin',
          },
        ],
        defaultTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      setSaved(true);
    } catch (error) {
      console.error('[HealthFactorLog] save failed:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-white/5 bg-neutral-800/50 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Icon size={18} className={iconColor} /> {title}
          </h2>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors -mr-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto modal-scroll p-5 space-y-5">
          {helpText && <p className="text-[12px] text-neutral-500">{helpText}</p>}

          <label className="block">
            <span className="text-xs font-semibold text-neutral-400">Today's {title.toLowerCase()}</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={step}
                value={value}
                onChange={(e) => {
                  setSaved(false);
                  setValue(e.target.value === '' ? '' : Number(e.target.value));
                }}
                placeholder="0"
                className="flex-1 bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              />
              <span className="text-sm text-neutral-400 w-14">{unit}</span>
            </div>
          </label>

          {presets && presets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => addPreset(p.amount)}
                  className="px-3 py-1.5 rounded-full bg-neutral-800/60 border border-white/10 text-xs text-neutral-300 hover:border-white/25 transition-colors"
                >
                  + {p.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setSaved(false);
                  setValue(0);
                }}
                className="px-3 py-1.5 rounded-full border border-white/5 text-xs text-neutral-500 hover:text-white transition-colors"
              >
                Reset
              </button>
            </div>
          )}

          {loading && <div className="text-sm text-neutral-500">Loading…</div>}
        </div>

        <div className="p-4 border-t border-white/5 bg-neutral-800/50 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={busy || value === ''}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Check size={15} /> Save
          </button>
          {saved && <span className="text-xs text-emerald-400">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
};
