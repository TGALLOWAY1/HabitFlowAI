import React, { useEffect, useState } from 'react';
import { useHabitStore } from '../store/HabitContext';
import type { HabitEntry } from '../models/persistenceTypes';
import {
    fetchHabitEntries,
    updateHabitEntry,
    deleteHabitEntry
} from '../lib/persistenceClient';

interface HabitHistoryModalProps {
    habitId: string;
    onClose: () => void;
}

export const HabitHistoryModal: React.FC<HabitHistoryModalProps> = ({ habitId, onClose }) => {
    const { habits, refreshDayLogs } = useHabitStore();
    const habit = habits.find(h => h.id === habitId);

    const [entries, setEntries] = useState<HabitEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);

    useEffect(() => {
        const loadEntries = async () => {
            setLoading(true);
            try {
                const data = await fetchHabitEntries(habitId);
                setEntries(data);
            } catch (error) {
                console.error('Failed to load history', error);
            } finally {
                setLoading(false);
            }
        };

        loadEntries();
    }, [habitId]);

    const handleDelete = async (entryId: string) => {
        if (!confirm('Are you sure you want to delete this entry? This will recalculate the daily total.')) {
            return;
        }

        try {
            await deleteHabitEntry(entryId);
            // Refresh local list
            setEntries(prev => prev.filter(e => e.id !== entryId));
            // Refresh global context to update streaks/grids
            await refreshDayLogs();
        } catch (error) {
            console.error('Failed to delete entry', error);
            alert('Failed to delete entry');
        }
    };

    const handleStartEdit = (entry: HabitEntry) => {
        // Guardrail: Past edits
        const today = new Date().toISOString().split('T')[0];
        if (entry.date < today) {
            if (!confirm(`You are editing a past entry (${entry.date}). This will change historical data. Continue?`)) {
                return;
            }
        }
        setEditingId(entry.id);
        setEditValue(entry.value || 0);
    };

    const handleSaveEdit = async (entry: HabitEntry) => {
        try {
            await updateHabitEntry(entry.id, { value: editValue });

            // Update local list
            setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, value: editValue } : e));
            setEditingId(null);

            // Update global context
            await refreshDayLogs();
        } catch (error) {
            console.error('Failed to update entry', error);
            alert('Failed to update entry');
        }
    };

    if (!habit) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        History for {habit.name}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading history...</div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No entries found.</div>
                    ) : (
                        <div className="space-y-4">
                            {entries.map(entry => (
                                <div key={entry.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {entry.date}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {(() => {
                                                const d = new Date(entry.timestamp);
                                                return isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
                                            })()}
                                            {entry.source && ` • ${entry.source}`}
                                            {entry.bundleOptionLabel && (
                                                <span className="block mt-1 font-medium text-emerald-600 dark:text-emerald-400">
                                                    Selected: {entry.bundleOptionLabel}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {editingId === entry.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(Number(e.target.value))}
                                                    className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                                />
                                                <button
                                                    onClick={() => handleSaveEdit(entry)}
                                                    className="text-green-600 hover:text-green-700 text-sm font-medium"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="text-gray-500 hover:text-gray-600 text-sm"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4">
                                                <span className="font-mono font-bold text-gray-700 dark:text-gray-200">
                                                    {entry.value}
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleStartEdit(entry)}
                                                        className="text-blue-500 hover:text-blue-600 text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-900/30 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(entry.id)}
                                                        className="text-red-500 hover:text-red-600 text-xs px-2 py-1 rounded border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
