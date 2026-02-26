/**
 * Debug Entries Page
 * 
 * Power-user "truth inspection" screen that makes EntryView visible and auditable.
 * Reads from /api/entries (truthQuery-backed) to validate that frontend reads reflect the same data.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { fetchHabitEntries, getLocalTimeZone } from '../lib/persistenceClient';
import { AlertTriangle } from 'lucide-react';

interface EntryView {
  habitId: string;
  dayKey: string;
  timestampUtc: string;
  value: number | null;
  unit?: string;
  source: 'manual' | 'routine' | 'quick' | 'import' | 'legacy' | 'test';
  provenance: {
    routineId?: string;
    routineExecutionId?: string;
  };
  deletedAt?: string | null;
  conflict?: boolean;
  legacyValue?: number | null;
}

export const DebugEntriesPage: React.FC = () => {
  const { habits } = useHabitStore();

  // Filter state
  const [selectedHabitId, setSelectedHabitId] = useState<string>('');
  const [dayKey, setDayKey] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [conflictsOnly, setConflictsOnly] = useState<boolean>(false);

  // Data state
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch entries when filters change
  useEffect(() => {
    const loadEntries = async () => {
      if (!selectedHabitId) {
        setEntries([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // If dayKey is provided, set startDayKey and endDayKey to the same value
        const startDayKey = dayKey || undefined;
        const endDayKey = dayKey || undefined;

        const fetchedEntries = await fetchHabitEntries(
          selectedHabitId,
          startDayKey,
          endDayKey,
          getLocalTimeZone()
        );
        setEntries(fetchedEntries);
      } catch (err) {
        console.error('Failed to fetch entries:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch entries');
      } finally {
        setLoading(false);
      }
    };

    loadEntries();
  }, [selectedHabitId, dayKey]);

  // Apply client-side filters (source, conflicts)
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    // Filter by source
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(entry => entry.source === sourceFilter);
    }

    // Filter conflicts only
    if (conflictsOnly) {
      filtered = filtered.filter(entry => entry.conflict === true);
    }

    // Sort by dayKey desc, then timestampUtc desc
    filtered.sort((a, b) => {
      if (a.dayKey !== b.dayKey) {
        return b.dayKey.localeCompare(a.dayKey); // desc
      }
      return b.timestampUtc.localeCompare(a.timestampUtc); // desc
    });

    return filtered;
  }, [entries, sourceFilter, conflictsOnly]);

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Evidence Review - EntryView Timeline</h1>
        <p className="text-neutral-400 text-sm">
          Debug screen for inspecting EntryViews from truthQuery. All data comes from /api/entries.
        </p>
      </div>

      {/* Dev-only Banner */}
      <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
        <AlertTriangle className="text-yellow-500 mt-0.5 flex-shrink-0" size={20} />
        <div className="flex-1">
          <p className="text-yellow-500 font-medium text-sm mb-1">Dev Mode: Truth Inspection</p>
          <p className="text-neutral-400 text-xs">
            This screen reads from <code className="bg-neutral-800 px-1 rounded">/api/entries</code> (truthQuery).
            If results differ from Day View, a legacy read path still exists.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Habit Selector */}
        <div>
          <label className="block text-sm font-medium mb-2 text-neutral-300">Habit</label>
          <select
            value={selectedHabitId}
            onChange={(e) => setSelectedHabitId(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a habit...</option>
            {habits.map(habit => (
              <option key={habit.id} value={habit.id}>
                {habit.name}
              </option>
            ))}
          </select>
        </div>

        {/* DayKey Picker */}
        <div>
          <label className="block text-sm font-medium mb-2 text-neutral-300">DayKey</label>
          <input
            type="date"
            value={dayKey}
            onChange={(e) => setDayKey(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="YYYY-MM-DD"
          />
        </div>

        {/* Source Filter */}
        <div>
          <label className="block text-sm font-medium mb-2 text-neutral-300">Source</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual</option>
            <option value="routine">Routine</option>
            <option value="quick">Quick</option>
            <option value="import">Import</option>
            <option value="legacy">Legacy</option>
            <option value="test">Test</option>
          </select>
        </div>

        {/* Conflicts Only Toggle */}
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={conflictsOnly}
              onChange={(e) => setConflictsOnly(e.target.checked)}
              className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-neutral-300">Conflicts Only</span>
          </label>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-500 text-sm">Error: {error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="mb-6 p-4 bg-neutral-800 rounded-lg text-center">
          <p className="text-neutral-400">Loading entries...</p>
        </div>
      )}

      {/* Results Summary */}
      {!loading && selectedHabitId && (
        <div className="mb-4 text-sm text-neutral-400">
          Showing {filteredEntries.length} of {entries.length} entries
        </div>
      )}

      {/* Entries Table */}
      {!loading && filteredEntries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left p-3 text-sm font-medium text-neutral-300">Habit ID</th>
                <th className="text-left p-3 text-sm font-medium text-neutral-300">DayKey</th>
                <th className="text-left p-3 text-sm font-medium text-neutral-300">Timestamp (UTC)</th>
                <th className="text-left p-3 text-sm font-medium text-neutral-300">Value</th>
                <th className="text-left p-3 text-sm font-medium text-neutral-300">Source</th>
                <th className="text-left p-3 text-sm font-medium text-neutral-300">Routine ID</th>
                <th className="text-left p-3 text-sm font-medium text-neutral-300">Deleted</th>
                <th className="text-left p-3 text-sm font-medium text-neutral-300">Conflict</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, index) => (
                <tr
                  key={`${entry.habitId}-${entry.dayKey}-${entry.timestampUtc}-${index}`}
                  className="border-b border-neutral-800 hover:bg-neutral-800/50"
                >
                  <td className="p-3 text-sm text-neutral-400 font-mono">{entry.habitId.slice(0, 8)}...</td>
                  <td className="p-3 text-sm text-neutral-300">{entry.dayKey}</td>
                  <td className="p-3 text-sm text-neutral-400 font-mono text-xs">
                    {new Date(entry.timestampUtc).toLocaleString()}
                  </td>
                  <td className="p-3 text-sm text-neutral-300">
                    {entry.value !== null ? entry.value : <span className="text-neutral-500">null</span>}
                  </td>
                  <td className="p-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        entry.source === 'legacy'
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : entry.source === 'routine'
                          ? 'bg-blue-500/20 text-blue-500'
                          : entry.source === 'manual'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      {entry.source}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-neutral-400 font-mono text-xs">
                    {entry.provenance.routineId ? entry.provenance.routineId.slice(0, 8) + '...' : '-'}
                  </td>
                  <td className="p-3 text-sm">
                    {entry.deletedAt ? (
                      <span className="text-red-500 text-xs">Yes</span>
                    ) : (
                      <span className="text-neutral-500 text-xs">No</span>
                    )}
                  </td>
                  <td className="p-3 text-sm">
                    {entry.conflict ? (
                      <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-500">Conflict</span>
                    ) : (
                      <span className="text-neutral-500 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && selectedHabitId && filteredEntries.length === 0 && (
        <div className="p-8 text-center bg-neutral-800 rounded-lg">
          <p className="text-neutral-400">
            {entries.length === 0
              ? 'No entries found for this habit.'
              : 'No entries match the current filters.'}
          </p>
        </div>
      )}

      {/* No Habit Selected */}
      {!selectedHabitId && (
        <div className="p-8 text-center bg-neutral-800 rounded-lg">
          <p className="text-neutral-400">Select a habit to view entries.</p>
        </div>
      )}
    </div>
  );
};
