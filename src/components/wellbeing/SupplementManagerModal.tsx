import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Pencil, Leaf, Check } from 'lucide-react';
import { format } from 'date-fns';
import type { Supplement, SupplementLog } from '../../models/persistenceTypes';
import {
  fetchSupplements,
  createSupplement,
  updateSupplement,
  deleteSupplement,
  fetchSupplementLogs,
  setSupplementLog,
  type SupplementInput,
} from '../../lib/persistenceClient';

interface SupplementManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

const EMPTY_FORM: SupplementInput = { name: '', dosage: '', schedule: '', active: true };

/**
 * Supplement manager — CRUD over user-defined supplements plus today's "taken"
 * toggle. Near-clone of the medication manager.
 */
export const SupplementManagerModal: React.FC<SupplementManagerModalProps> = ({ isOpen, onClose, onChanged }) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<SupplementInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, logs] = await Promise.all([fetchSupplements(), fetchSupplementLogs(today)]);
      setSupplements(list);
      setTakenIds(new Set((logs as SupplementLog[]).filter((l) => l.taken).map((l) => l.supplementId)));
    } catch (error) {
      console.error('[SupplementManager] load failed:', error);
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

  const startEdit = (s: Supplement) => {
    setEditingId(s.id);
    setForm({ name: s.name, dosage: s.dosage ?? '', schedule: s.schedule ?? '', active: s.active });
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) return;
    setBusy(true);
    try {
      const payload: SupplementInput = {
        name: form.name.trim(),
        dosage: form.dosage?.trim() || null,
        schedule: form.schedule?.trim() || null,
        active: form.active ?? true,
      };
      if (editingId) await updateSupplement(editingId, payload);
      else await createSupplement(payload);
      await load();
      resetForm();
      onChanged?.();
    } catch (error) {
      console.error('[SupplementManager] save failed:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (s: Supplement) => {
    try {
      await deleteSupplement(s.id);
      await load();
      if (editingId === s.id) resetForm();
      onChanged?.();
    } catch (error) {
      console.error('[SupplementManager] delete failed:', error);
    }
  };

  const toggleTaken = async (s: Supplement) => {
    const nextTaken = !takenIds.has(s.id);
    setTakenIds((prev) => {
      const next = new Set(prev);
      if (nextTaken) next.add(s.id);
      else next.delete(s.id);
      return next;
    });
    try {
      await setSupplementLog({ supplementId: s.id, dayKey: today, taken: nextTaken });
    } catch (error) {
      console.error('[SupplementManager] toggle failed:', error);
      setTakenIds((prev) => {
        const next = new Set(prev);
        if (nextTaken) next.delete(s.id);
        else next.add(s.id);
        return next;
      });
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-white/5 bg-neutral-800/50 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Leaf size={18} className="text-green-400" /> Supplements
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
              {editingId ? 'Edit supplement' : 'Add supplement'}
            </div>
            <input
              value={form.name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name (e.g. Vitamin D)"
              className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.dosage ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
                placeholder="Dose (e.g. 2000 IU)"
                className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              />
              <input
                value={form.schedule ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                placeholder="Schedule (e.g. AM)"
                className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              />
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

          {/* Existing supplements + today's "taken" toggle */}
          <div className="space-y-2">
            {loading && <div className="text-sm text-neutral-500">Loading…</div>}
            {!loading && supplements.length === 0 && (
              <div className="text-sm text-neutral-500">No supplements yet. Add one above.</div>
            )}
            {supplements.map((s) => {
              const taken = takenIds.has(s.id);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 bg-neutral-800/40 border border-white/5 rounded-xl px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => toggleTaken(s)}
                    className="flex items-center gap-3 min-w-0 text-left flex-1"
                    title={taken ? 'Mark not taken today' : 'Mark taken today'}
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
                    <span className="min-w-0">
                      <span className="block text-sm text-white font-medium truncate">
                        {s.name}
                        {s.dosage ? <span className="text-neutral-400 font-normal"> · {s.dosage}</span> : null}
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        {s.active ? 'Active' : 'Inactive'}
                        {s.schedule ? ` · ${s.schedule}` : ''}
                      </span>
                    </span>
                  </button>
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
