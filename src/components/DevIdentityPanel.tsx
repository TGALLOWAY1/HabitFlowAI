/**
 * Dev-only panel for inspecting and switching the active userId/householdId.
 * Renders nothing in production builds. For full identity UI use Settings.
 */
import React, { useState, useCallback } from 'react';
import {
  getActiveRealUserId,
  setActiveRealUserId,
  getActiveUserId,
  getActiveHouseholdId,
  getKnownUserIds,
} from '../lib/persistenceClient';

export function DevIdentityPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [customId, setCustomId] = useState('');
  const currentId = getActiveRealUserId();
  const effectiveId = getActiveUserId();
  const householdId = getActiveHouseholdId();
  const knownIds = getKnownUserIds();

  const isProd = import.meta.env.PROD;
  if (isProd) return null;

  const switchTo = useCallback((newId: string) => {
    if (!newId.trim()) return;
    setActiveRealUserId(newId.trim());
    window.location.reload();
  }, []);

  return (
    <div className="fixed bottom-2 right-2 z-[9999] text-xs">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-neutral-800/90 text-neutral-400 px-2 py-1 rounded border border-neutral-700 hover:text-white hover:border-neutral-500 transition-colors"
          title="Dev: Identity panel"
        >
          🔑
        </button>
      ) : (
        <div className="bg-neutral-900/95 border border-neutral-700 rounded-lg p-3 w-72 shadow-xl backdrop-blur-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-neutral-300">Identity (dev)</span>
            <button onClick={() => setIsOpen(false)} className="text-neutral-500 hover:text-white">✕</button>
          </div>

          <div className="text-neutral-500 mb-1">Household:</div>
          <div className="text-neutral-200 font-mono text-[10px] bg-neutral-800 px-2 py-1 rounded mb-2 break-all">
            {householdId}
          </div>
          <div className="text-neutral-500 mb-1">Effective userId:</div>
          <div className="text-neutral-200 font-mono text-[10px] bg-neutral-800 px-2 py-1 rounded mb-2 break-all">
            {effectiveId}
          </div>

          <div className="text-neutral-500 mb-1">Switch to:</div>
          <div className="space-y-1 mb-2">
            {knownIds.slice(0, 8).map((id) => (
              <button
                key={id}
                onClick={() => switchTo(id)}
                className={`block w-full text-left px-2 py-1 rounded transition-colors ${
                  currentId === id
                    ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                }`}
              >
                <span className="font-mono text-[9px]">{id.slice(0, 8)}…</span>
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            <input
              value={customId}
              onChange={e => setCustomId(e.target.value)}
              placeholder="Custom userId…"
              className="flex-1 bg-neutral-800 text-neutral-200 px-2 py-1 rounded border border-neutral-700 text-[10px] font-mono"
            />
            <button
              onClick={() => switchTo(customId)}
              className="px-2 py-1 bg-neutral-700 text-neutral-300 rounded hover:bg-neutral-600"
            >
              Go
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
