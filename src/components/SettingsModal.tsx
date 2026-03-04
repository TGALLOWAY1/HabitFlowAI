/**
 * Settings modal: identity (household + user), refresh, and other app settings.
 * V1: minimal household/user selection; Switch User list from household registry API.
 */
import React, { useState, useCallback, useEffect } from 'react';
import type { HouseholdUser } from '../models/persistenceTypes';
import {
  getActiveHouseholdId,
  setActiveHouseholdId,
  getActiveRealUserId,
  setActiveRealUserId,
  getActiveUserId,
  getKnownUserIds,
  addKnownUserId,
  fetchHouseholdUsers,
  createHouseholdUser,
} from '../lib/persistenceClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

/** Union of API household users and local known IDs so we show everyone. */
function mergeUserList(apiUsers: HouseholdUser[], knownIds: string[]): Array<{ userId: string; displayName?: string }> {
  const byId = new Map<string, { userId: string; displayName?: string }>();
  for (const u of apiUsers) {
    byId.set(u.userId, { userId: u.userId, displayName: u.displayName });
  }
  for (const id of knownIds) {
    if (!byId.has(id)) byId.set(id, { userId: id });
  }
  return Array.from(byId.values());
}

export function SettingsModal({ isOpen, onClose, onRefresh }: SettingsModalProps) {
  const [householdId, setHouseholdId] = useState(getActiveHouseholdId());
  const [customUserId, setCustomUserId] = useState('');
  const [householdUsers, setHouseholdUsers] = useState<HouseholdUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const currentUserId = getActiveRealUserId();
  const effectiveUserId = getActiveUserId();
  const knownIds = getKnownUserIds();
  const userList = mergeUserList(householdUsers, knownIds);

  useEffect(() => {
    if (!isOpen) return;
    setUsersLoading(true);
    fetchHouseholdUsers()
      .then(setHouseholdUsers)
      .catch(() => setHouseholdUsers([]))
      .finally(() => setUsersLoading(false));
  }, [isOpen]);

  const handleSwitchUser = useCallback(
    (userId: string) => {
      if (!userId.trim()) return;
      setActiveRealUserId(userId.trim());
      onClose();
      window.location.reload();
    },
    [onClose]
  );

  const handleCreateNewUser = useCallback(async () => {
    setCreateLoading(true);
    try {
      const user = await createHouseholdUser({ displayName: 'New user' });
      setActiveRealUserId(user.userId);
      addKnownUserId(user.userId);
      onClose();
      window.location.reload();
    } catch {
      const newId = crypto.randomUUID();
      setActiveRealUserId(newId);
      addKnownUserId(newId);
      onClose();
      window.location.reload();
    } finally {
      setCreateLoading(false);
    }
  }, [onClose]);

  const handleSaveHousehold = useCallback(() => {
    setActiveHouseholdId(householdId);
    onClose();
    window.location.reload();
  }, [householdId, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-neutral-900 border border-white/10 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="settings-title"
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-semibold text-white">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Identity */}
          <section>
            <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-3">
              Identity
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-neutral-500 mb-1">Household</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={householdId}
                    onChange={(e) => setHouseholdId(e.target.value)}
                    className="flex-1 bg-neutral-800 text-white px-3 py-2 rounded-lg border border-white/10 font-mono text-xs"
                    placeholder="default-household"
                  />
                  <button
                    type="button"
                    onClick={handleSaveHousehold}
                    className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                  >
                    Save
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-neutral-500 mb-1">Current user</label>
                <div className="bg-neutral-800 px-3 py-2 rounded-lg border border-white/10 font-mono text-xs text-neutral-300 break-all">
                  {effectiveUserId}
                </div>
              </div>
              <div>
                <label className="block text-neutral-500 mb-1">Switch user</label>
                <div className="space-y-2">
                  {usersLoading && (
                    <div className="text-neutral-500 text-xs">Loading users…</div>
                  )}
                  {!usersLoading && userList.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {userList.map(({ userId, displayName }) => (
                        <button
                          key={userId}
                          type="button"
                          onClick={() => handleSwitchUser(userId)}
                          className={`px-2 py-1 rounded text-xs font-mono ${
                            userId === currentUserId
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-neutral-800 text-neutral-300 border border-white/10 hover:bg-neutral-700'
                          }`}
                        >
                          {displayName || `${userId.slice(0, 8)}…`}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customUserId}
                      onChange={(e) => setCustomUserId(e.target.value)}
                      placeholder="Paste or enter user ID"
                      className="flex-1 bg-neutral-800 text-white px-3 py-2 rounded-lg border border-white/10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleSwitchUser(customUserId)}
                      className="px-3 py-2 rounded-lg bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
                    >
                      Go
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateNewUser}
                    disabled={createLoading}
                    className="w-full px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 text-sm disabled:opacity-50"
                  >
                    {createLoading ? 'Creating…' : 'Create new user'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Refresh */}
          {onRefresh && (
            <section>
              <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-3">
                Data
              </h3>
              <button
                type="button"
                onClick={() => {
                  onRefresh();
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-200 border border-white/10 hover:bg-neutral-700"
              >
                Refresh habits & categories
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
