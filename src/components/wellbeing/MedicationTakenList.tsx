import React, { useEffect, useState } from 'react';
import { Pill, Plus, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Medication } from '../../models/persistenceTypes';
import { fetchMedications, fetchMedicationLogs, setMedicationLog } from '../../lib/persistenceClient';
import { MedicationManagerModal } from './MedicationManagerModal';

/**
 * "Medications Taken Today" — rendered inside the morning check-in.
 * Lists active medications with a toggle that upserts a daily MedicationLog.
 */
export const MedicationTakenList: React.FC = () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [managerOpen, setManagerOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [meds, logs] = await Promise.all([fetchMedications(), fetchMedicationLogs(today)]);
      setMedications(meds.filter((m) => m.active));
      setTakenIds(new Set(logs.filter((l) => l.taken).map((l) => l.medicationId)));
    } catch (error) {
      console.error('[MedicationTakenList] load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (med: Medication) => {
    const nextTaken = !takenIds.has(med.id);
    setTakenIds((prev) => {
      const next = new Set(prev);
      if (nextTaken) next.add(med.id);
      else next.delete(med.id);
      return next;
    });
    try {
      await setMedicationLog({ medicationId: med.id, dayKey: today, taken: nextTaken });
    } catch (error) {
      console.error('[MedicationTakenList] toggle failed:', error);
      // revert on failure
      setTakenIds((prev) => {
        const next = new Set(prev);
        if (nextTaken) next.delete(med.id);
        else next.add(med.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-300 font-medium flex items-center gap-2">
          <Pill size={16} className="text-rose-400" /> Medications Taken Today
        </span>
        <button
          onClick={() => setManagerOpen(true)}
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
        >
          <Settings2 size={13} /> Manage
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : medications.length === 0 ? (
        <button
          onClick={() => setManagerOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/10 text-sm text-neutral-400 hover:text-white hover:border-white/20 transition-colors"
        >
          <Plus size={15} /> Add a medication
        </button>
      ) : (
        <div className="space-y-2">
          {medications.map((med) => {
            const taken = takenIds.has(med.id);
            return (
              <button
                key={med.id}
                type="button"
                onClick={() => toggle(med)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  taken
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-neutral-800/40 border-white/5 hover:border-white/15'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    taken ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'
                  }`}
                >
                  {taken && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-white truncate">
                  {med.name}
                  {med.dosage ? <span className="text-neutral-400"> {med.dosage}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <MedicationManagerModal
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
        onChanged={load}
      />
    </div>
  );
};
