import React, { useEffect, useState, useMemo } from 'react';
import { useHabitStore } from '../store/HabitContext';
import type { HabitEntry } from '../models/persistenceTypes';
import {
    fetchHabitEntries,
    updateHabitEntry,
    deleteHabitEntry,
    createHabitEntry
} from '../lib/persistenceClient';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    isAfter,
    startOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, X } from 'lucide-react';
import { cn } from '../utils/cn';

interface HabitHistoryModalProps {
    habitId: string;
    onClose: () => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const HabitHistoryModal: React.FC<HabitHistoryModalProps> = ({ habitId, onClose }) => {
    const { habits, refreshDayLogs } = useHabitStore();
    const habit = habits.find(h => h.id === habitId);

    const [entries, setEntries] = useState<HabitEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);
    const [newEntryValue, setNewEntryValue] = useState<number>(1);
    const [showNewEntry, setShowNewEntry] = useState(false);
    const [saving, setSaving] = useState(false);

    const today = useMemo(() => startOfDay(new Date()), []);

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

    // Build a map of dayKey -> entries for calendar dots and list
    const entriesByDay = useMemo(() => {
        const map = new Map<string, HabitEntry[]>();
        for (const entry of entries) {
            const key = entry.dayKey || entry.date || '';
            if (!key) continue;
            const existing = map.get(key) || [];
            existing.push(entry);
            map.set(key, existing);
        }
        return map;
    }, [entries]);

    // Sorted list of dates that have entries (most recent first)
    const entryDates = useMemo(() => {
        return Array.from(entriesByDay.keys()).sort((a, b) => b.localeCompare(a));
    }, [entriesByDay]);

    // Calendar grid days for current month
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const calStart = startOfWeek(monthStart);
        const calEnd = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: calStart, end: calEnd });
    }, [currentMonth]);

    const isFutureDate = (date: Date) => isAfter(startOfDay(date), today);

    const handleDateClick = (date: Date) => {
        if (isFutureDate(date)) return;
        const dayKey = format(date, 'yyyy-MM-dd');
        setSelectedDate(prev => prev === dayKey ? null : dayKey);
        setEditingId(null);
        setShowNewEntry(false);
    };

    const handleDelete = async (entryId: string) => {
        if (!confirm('Delete this entry? This will recalculate the daily total.')) return;
        try {
            await deleteHabitEntry(entryId);
            setEntries(prev => prev.filter(e => e.id !== entryId));
            await refreshDayLogs();
        } catch (error) {
            console.error('Failed to delete entry', error);
            alert('Failed to delete entry');
        }
    };

    const handleStartEdit = (entry: HabitEntry) => {
        setEditingId(entry.id);
        setEditValue(entry.value || 0);
        setShowNewEntry(false);
    };

    const handleSaveEdit = async (entry: HabitEntry) => {
        setSaving(true);
        try {
            await updateHabitEntry(entry.id, { value: editValue });
            setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, value: editValue } : e));
            setEditingId(null);
            await refreshDayLogs();
        } catch (error) {
            console.error('Failed to update entry', error);
            alert('Failed to update entry');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateEntry = async () => {
        if (!selectedDate) return;
        setSaving(true);
        try {
            const result = await createHabitEntry({
                habitId,
                dayKey: selectedDate,
                value: newEntryValue,
                source: 'manual',
                timestamp: new Date().toISOString(),
            });
            setEntries(prev => [...prev, result.entry]);
            setShowNewEntry(false);
            setNewEntryValue(1);
            await refreshDayLogs();
        } catch (error) {
            console.error('Failed to create entry', error);
            alert('Failed to create entry');
        } finally {
            setSaving(false);
        }
    };

    if (!habit) return null;

    const isQuantity = habit.goal?.type === 'number';
    const selectedEntries = selectedDate ? (entriesByDay.get(selectedDate) || []) : [];

    return (
        <div className="modal-overlay fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg max-h-[85dvh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-white/5">
                    <h2 className="text-lg font-bold text-neutral-100">
                        {habit.name}
                    </h2>
                    <button
                        onClick={onClose}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-300 -mr-2"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto modal-scroll">
                    {loading ? (
                        <div className="text-center py-12 text-neutral-500">Loading history...</div>
                    ) : (
                        <>
                            {/* Calendar Section */}
                            <div className="px-5 pt-4 pb-2">
                                {/* Month Navigation */}
                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                                        className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <span className="text-sm font-semibold text-neutral-200">
                                        {format(currentMonth, 'MMMM yyyy')}
                                    </span>
                                    <button
                                        onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                                        className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
                                        disabled={isSameMonth(currentMonth, today)}
                                    >
                                        <ChevronRight size={18} className={isSameMonth(currentMonth, today) ? 'opacity-30' : ''} />
                                    </button>
                                </div>

                                {/* Weekday Headers */}
                                <div className="grid grid-cols-7 gap-1 mb-1">
                                    {WEEKDAY_LABELS.map(d => (
                                        <div key={d} className="text-center text-[10px] font-medium text-neutral-600 py-1">
                                            {d}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar Grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map(day => {
                                        const dayKey = format(day, 'yyyy-MM-dd');
                                        const inMonth = isSameMonth(day, currentMonth);
                                        const isToday = isSameDay(day, today);
                                        const isFuture = isFutureDate(day);
                                        const hasEntries = entriesByDay.has(dayKey);
                                        const isSelected = selectedDate === dayKey;
                                        const dayEntries = entriesByDay.get(dayKey) || [];
                                        const dayTotal = dayEntries.reduce((sum, e) => sum + (e.value || 0), 0);

                                        return (
                                            <button
                                                key={dayKey}
                                                onClick={() => handleDateClick(day)}
                                                disabled={isFuture}
                                                className={cn(
                                                    "relative flex flex-col items-center justify-center py-1.5 rounded-lg text-xs transition-all",
                                                    !inMonth && "opacity-30",
                                                    isFuture && "opacity-20 cursor-not-allowed",
                                                    isSelected
                                                        ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400"
                                                        : isToday
                                                            ? "bg-white/5 border border-white/10 text-white font-bold"
                                                            : "hover:bg-white/5 text-neutral-400",
                                                    !isFuture && !isSelected && "cursor-pointer"
                                                )}
                                            >
                                                <span className="leading-none">{format(day, 'd')}</span>
                                                {hasEntries && (
                                                    <span className={cn(
                                                        "mt-0.5 text-[8px] font-bold leading-none",
                                                        isSelected ? "text-emerald-400" : "text-emerald-500"
                                                    )}>
                                                        {isQuantity ? dayTotal : '●'}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-white/5 mx-5 my-2" />

                            {/* Selected Date Detail / Entry List */}
                            <div className="px-5 pb-5">
                                {selectedDate ? (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-neutral-200">
                                                {format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                                            </h3>
                                            <button
                                                onClick={() => { setShowNewEntry(true); setEditingId(null); }}
                                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md transition-colors"
                                            >
                                                <Plus size={14} />
                                                Add Entry
                                            </button>
                                        </div>

                                        {/* New Entry Form */}
                                        {showNewEntry && (
                                            <div className="flex items-center gap-2 mb-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                                                <input
                                                    type="number"
                                                    value={newEntryValue}
                                                    onChange={e => setNewEntryValue(Number(e.target.value))}
                                                    className="w-20 px-2 py-1.5 text-sm bg-neutral-800 border border-white/10 rounded-md text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                                                    autoFocus
                                                />
                                                {habit.goal?.unit && (
                                                    <span className="text-xs text-neutral-500">{habit.goal.unit}</span>
                                                )}
                                                <div className="ml-auto flex gap-2">
                                                    <button
                                                        onClick={handleCreateEntry}
                                                        disabled={saving}
                                                        className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-md transition-colors disabled:opacity-50"
                                                    >
                                                        {saving ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button
                                                        onClick={() => setShowNewEntry(false)}
                                                        className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 rounded-md transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Existing Entries for Selected Date */}
                                        {selectedEntries.length === 0 && !showNewEntry ? (
                                            <p className="text-sm text-neutral-600 py-4 text-center">No entries for this date.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedEntries.map(entry => (
                                                    <div key={entry.id} className="flex items-center gap-3 p-3 bg-neutral-800/50 border border-white/5 rounded-lg">
                                                        {editingId === entry.id ? (
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <input
                                                                    type="number"
                                                                    value={editValue}
                                                                    onChange={e => setEditValue(Number(e.target.value))}
                                                                    className="w-20 px-2 py-1.5 text-sm bg-neutral-800 border border-white/10 rounded-md text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                                                                    autoFocus
                                                                />
                                                                {habit.goal?.unit && (
                                                                    <span className="text-xs text-neutral-500">{habit.goal.unit}</span>
                                                                )}
                                                                <div className="ml-auto flex gap-2">
                                                                    <button
                                                                        onClick={() => handleSaveEdit(entry)}
                                                                        disabled={saving}
                                                                        className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                                                                    >
                                                                        {saving ? 'Saving...' : 'Save'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingId(null)}
                                                                        className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono font-bold text-neutral-200 text-sm">
                                                                            {entry.value ?? '—'}
                                                                        </span>
                                                                        {habit.goal?.unit && (
                                                                            <span className="text-xs text-neutral-500">{habit.goal.unit}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-neutral-600 mt-0.5">
                                                                        {entry.source}
                                                                        {(() => {
                                                                            const d = new Date(entry.timestamp);
                                                                            return isNaN(d.getTime()) ? '' : ` · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                                                        })()}
                                                                        {entry.bundleOptionLabel && (
                                                                            <span className="ml-1 text-emerald-500">
                                                                                · {entry.bundleOptionLabel}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleStartEdit(entry)}
                                                                        className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(entry.id)}
                                                                        className="p-1.5 rounded-md text-neutral-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Date List - show all dates with entries */
                                    <div>
                                        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                                            Entry History ({entryDates.length} {entryDates.length === 1 ? 'day' : 'days'})
                                        </h3>
                                        {entryDates.length === 0 ? (
                                            <p className="text-sm text-neutral-600 py-4 text-center">No entries yet. Select a date on the calendar to add one.</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {entryDates.map(dayKey => {
                                                    const dayEntries = entriesByDay.get(dayKey) || [];
                                                    const total = dayEntries.reduce((sum, e) => sum + (e.value || 0), 0);
                                                    const count = dayEntries.length;
                                                    return (
                                                        <button
                                                            key={dayKey}
                                                            onClick={() => { setSelectedDate(dayKey); setEditingId(null); setShowNewEntry(false); }}
                                                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                                                        >
                                                            <span className="text-sm text-neutral-300">
                                                                {format(new Date(dayKey + 'T12:00:00'), 'EEE, MMM d, yyyy')}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                {isQuantity && (
                                                                    <span className="font-mono text-sm font-bold text-neutral-200">
                                                                        {total}
                                                                        {habit.goal?.unit && <span className="text-xs text-neutral-500 ml-0.5">{habit.goal.unit}</span>}
                                                                    </span>
                                                                )}
                                                                {count > 1 && (
                                                                    <span className="text-[10px] text-neutral-600 bg-white/5 px-1.5 py-0.5 rounded">
                                                                        {count}x
                                                                    </span>
                                                                )}
                                                                <ChevronRight size={14} className="text-neutral-600" />
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
