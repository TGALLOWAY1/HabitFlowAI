import { useState } from 'react';
import { useAuth } from '../store/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function SettingsModal({ isOpen, onClose, onRefresh }: SettingsModalProps) {
  const { user } = useAuth();
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset confirmations when modal closes
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Scroll wrapper */}
      <div className="absolute inset-0 overflow-y-auto modal-scroll p-4">
        <div
          className="relative bg-neutral-900 border border-white/10 rounded-xl shadow-xl max-w-sm w-full mx-auto my-8 sm:my-16"
          role="dialog"
          aria-labelledby="settings-title"
          onClick={(e) => e.stopPropagation()}
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

          <div className="p-4 space-y-5">
            {/* Account */}
            {user?.displayName && (
              <section>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                  Account
                </h3>
                <div className="text-sm text-neutral-200">
                  {user.displayName}
                </div>
              </section>
            )}

            {/* Data */}
            <section>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
                Data
              </h3>
              <div className="space-y-3">
                {/* Refresh */}
                {onRefresh && (
                  <>
                    {!showRefreshConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowRefreshConfirm(true)}
                        className="w-full px-4 py-2.5 rounded-lg bg-neutral-800 text-neutral-200 border border-white/10 hover:bg-neutral-700 text-sm text-left"
                      >
                        Refresh data
                      </button>
                    ) : (
                      <div className="rounded-lg bg-neutral-800/50 border border-amber-500/30 p-3 space-y-3">
                        <p className="text-sm text-neutral-300">
                          Re-sync all habits and categories from the server?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowRefreshConfirm(false)}
                            className="px-3 py-1.5 rounded-lg bg-neutral-700 text-neutral-200 border border-white/10 hover:bg-neutral-600 text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onRefresh();
                              setShowRefreshConfirm(false);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-600/80 text-white hover:bg-amber-600 text-sm"
                          >
                            Yes, refresh
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Delete data */}
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-2.5 rounded-lg bg-neutral-800 text-red-400 border border-white/10 hover:bg-neutral-700 text-sm text-left"
                  >
                    Delete my data
                  </button>
                ) : (
                  <div className="rounded-lg bg-neutral-800/50 border border-red-500/30 p-3 space-y-3">
                    <p className="text-sm text-neutral-300">
                      This will permanently delete all your habits, logs, and settings. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-lg bg-neutral-700 text-neutral-200 border border-white/10 hover:bg-neutral-600 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // TODO: wire up data deletion API
                          setShowDeleteConfirm(false);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 text-sm"
                      >
                        Yes, delete everything
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
