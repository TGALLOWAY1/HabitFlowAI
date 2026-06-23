import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Pencil, Pill, Check } from 'lucide-react';
import type { Medication } from '../../models/persistenceTypes';
import {
  fetchMedications,
  createMedication,
  updateMedication,
  deleteMedication,
  type MedicationInput,
} from '../../lib/persistenceClient';

interface MedicationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after any change so callers can refresh their medication list. */
  onChanged?: () => void;
}

const EMPTY_FORM: MedicationInput = {
  name: '',
  dosage: '',
  schedule: '',
  startDate: '',
  endDate: '',
  active: true,
};

export const MedicationManagerModal: React.FC<MedicationManagerModalProps> = ({ isOpen, onClose, onChanged }) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<MedicationInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setMedications(await fetchMedications());
    } catch (error) {
      console.error('[MedicationManager] load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void load();
      setForm(EMPTY_FORM);
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (med: Medication) => {
    setEditingId(med.id);
    setForm({
      name: med.name,
      dosage: med.dosage ?? '',
      schedule: med.schedule ?? '',
      startDate: med.startDate ?? '',
      endDate: med.endDate ?? '',
      active: med.active,
    });
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) return;
    setBusy(true);
    try {
      const payload: MedicationInput = {
        name: form.name.trim(),
        dosage: form.dosage?.trim() || null,
        schedule: form.schedule?.trim() || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        active: form.active ?? true,
      };
      if (editingId) await updateMedication(editingId, payload);
      else await createMedication(payload);
      await load();
      resetForm();
      onChanged?.();
    } catch (error) {
      console.error('[MedicationManager] save failed:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (med: Medication) => {
    try {
      await updateMedication(med.id, { active: !med.active });
      await load();
      onChanged?.();
    } catch (error) {
      console.error('[MedicationManager] toggle failed:', error);
    }
  };

  const handleDelete = async (med: Medication) => {
    try {
      await deleteMedication(med.id);
      await load();
      if (editingId === med.id) resetForm();
      onChanged?.();
    } catch (error) {
      console.error('[MedicationManager] delete failed:', error);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-white/5 bg-neutral-800/50 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Pill size={18} className="text-rose-400" /> Medications
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
          {/* Add / edit form */}
          <div className="space-y-3 bg-neutral-800/40 border border-white/5 rounded-xl p-4">
            <div className="text-xs font-semibold text-neutral-400">
              {editingId ? 'Edit medication' : 'Add medication'}
            </div>
            <input
              value={form.name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name (e.g. Lamotrigine)"
              className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.dosage ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
                placeholder="Dose (e.g. 200mg)"
                className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              />
              <input
                value={form.schedule ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                placeholder="Schedule (e.g. AM)"
                className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                Start date
                <input
                  type="date"
                  value={form.startDate ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </label>
              <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                End date (optional)
                <input
                  type="date"
                  value={form.endDate ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={busy || !form.name?.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {editingId ? <Check size={15} /> : <Plus size={15} />}
                {editingId ? 'Save' : 'Add'}
              </button>
              {editingId && (
                <button onClick={resetForm} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Existing medications */}
          <div className="space-y-2">
            {loading && <div className="text-sm text-neutral-500">Loading…</div>}
            {!loading && medications.length === 0 && (
              <div className="text-sm text-neutral-500">No medications yet. Add one above.</div>
            )}
            {medications.map((med) => (
              <div
                key={med.id}
                className="flex items-center justify-between gap-3 bg-neutral-800/40 border border-white/5 rounded-xl px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium truncate">
                    {med.name}
                    {med.dosage ? <span className="text-neutral-400 font-normal"> · {med.dosage}</span> : null}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {med.active ? 'Active' : 'Inactive'}
                    {med.schedule ? ` · ${med.schedule}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleActive(med)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      med.active
                        ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                        : 'border-white/10 text-neutral-400 hover:text-white'
                    }`}
                    title={med.active ? 'Mark inactive' : 'Mark active'}
                  >
                    {med.active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => startEdit(med)}
                    className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/10"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(med)}
                    className="p-1.5 rounded-md text-neutral-400 hover:text-rose-400 hover:bg-white/10"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
