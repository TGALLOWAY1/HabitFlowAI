import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Pencil, Activity, Check } from 'lucide-react';
import { format } from 'date-fns';
import type { Symptom, SymptomLog } from '../../models/persistenceTypes';
import {
  fetchSymptoms,
  createSymptom,
  updateSymptom,
  deleteSymptom,
  fetchSymptomLogs,
  setSymptomLog,
  type SymptomInput,
} from '../../lib/persistenceClient';

interface SymptomManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

const EMPTY_FORM: SymptomInput = { name: '', notes: '', active: true };
const SEVERITY_LEVELS = [1, 2, 3, 4, 5];

/**
 * Symptom manager — CRUD over user-defined symptoms plus today's severity logging
 * (1-5). Mirrors the medication manager pattern.
 */
export const SymptomManagerModal: React.FC<SymptomManagerModalProps> = ({ isOpen, onClose, onChanged }) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [logs, setLogs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<SymptomInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, dayLogs] = await Promise.all([fetchSymptoms(), fetchSymptomLogs(today)]);
      setSymptoms(list);
      const map: Record<string, number> = {};
      for (const l of dayLogs as SymptomLog[]) map[l.symptomId] = l.severity;
      setLogs(map);
    } catch (error) {
      console.error('[SymptomManager] load failed:', error);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (s: Symptom) => {
    setEditingId(s.id);
    setForm({ name: s.name, notes: s.notes ?? '', active: s.active });
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) return;
    setBusy(true);
    try {
      const payload: SymptomInput = {
        name: form.name.trim(),
        notes: form.notes?.trim() || null,
        active: form.active ?? true,
      };
      if (editingId) await updateSymptom(editingId, payload);
      else await createSymptom(payload);
      await load();
      resetForm();
      onChanged?.();
    } catch (error) {
      console.error('[SymptomManager] save failed:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (s: Symptom) => {
    try {
      await deleteSymptom(s.id);
      await load();
      if (editingId === s.id) resetForm();
      onChanged?.();
    } catch (error) {
      console.error('[SymptomManager] delete failed:', error);
    }
  };

  const handleSetSeverity = async (s: Symptom, severity: number) => {
    setLogs((prev) => ({ ...prev, [s.id]: severity }));
    try {
      await setSymptomLog({ symptomId: s.id, dayKey: today, severity });
    } catch (error) {
      console.error('[SymptomManager] severity save failed:', error);
      await load();
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-white/5 bg-neutral-800/50 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity size={18} className="text-orange-400" /> Symptoms
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
              {editingId ? 'Edit symptom' : 'Add symptom'}
            </div>
            <input
              value={form.name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name (e.g. Headache)"
              className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
            />
            <input
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
            />
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

          {/* Existing symptoms + today's severity */}
          <div className="space-y-2">
            {loading && <div className="text-sm text-neutral-500">Loading…</div>}
            {!loading && symptoms.length === 0 && (
              <div className="text-sm text-neutral-500">No symptoms yet. Add one above.</div>
            )}
            {symptoms.map((s) => (
              <div
                key={s.id}
                className="bg-neutral-800/40 border border-white/5 rounded-xl px-3 py-2.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">{s.name}</div>
                    {s.notes ? <div className="text-[11px] text-neutral-500 truncate">{s.notes}</div> : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(s)}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/10"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-rose-400 hover:bg-white/10"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-500 mr-1">Today</span>
                  {SEVERITY_LEVELS.map((level) => {
                    const active = logs[s.id] === level;
                    return (
                      <button
                        key={level}
                        onClick={() => handleSetSeverity(s, level)}
                        className={`w-7 h-7 rounded-md text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'border-white/10 text-neutral-400 hover:text-white hover:border-white/25'
                        }`}
                        title={`Severity ${level}`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
