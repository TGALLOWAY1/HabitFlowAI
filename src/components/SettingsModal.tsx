import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { getGeminiApiKey, setGeminiApiKey } from '../lib/geminiClient';
import { deleteAllUserData } from '../lib/persistenceClient';
import { Eye, EyeOff, ChevronRight, ArrowLeft } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function SettingsModal({ isOpen, onClose, onRefresh }: SettingsModalProps) {
  const { user } = useAuth();
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => getGeminiApiKey());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);

  // Reset confirmations when modal closes
  if (!isOpen) return null;

  const handleSaveGeminiKey = () => {
    setGeminiApiKey(geminiKey);
    setGeminiKeySaved(true);
    setTimeout(() => setGeminiKeySaved(false), 2000);
  };

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
            {showLearnMore ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowLearnMore(false)}
                  className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span className="text-sm">Settings</span>
                </button>
                <h2 id="settings-title" className="text-lg font-semibold text-white">
                  How HabitFlow Works
                </h2>
              </>
            ) : (
              <h2 id="settings-title" className="text-lg font-semibold text-white">
                Settings
              </h2>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {showLearnMore ? (
            <div className="p-4 space-y-5">
              {[
                {
                  title: 'Habits',
                  meaning: 'Small repeated actions that build consistency over time.',
                  differs: 'Unlike tasks, habits are ongoing — they don\'t get "done."',
                  example: 'Drink water, stretch for 5 minutes, practice Portuguese.',
                },
                {
                  title: 'Goals',
                  meaning: 'Outcomes or milestones your habits help create.',
                  differs: 'Goals give your habits direction and purpose.',
                  example: 'Run a 10K, improve sleep, become conversational in Portuguese.',
                },
                {
                  title: 'Routines',
                  meaning: 'Repeatable sequences that reduce friction.',
                  differs: 'Routines group multiple actions into a single flow.',
                  example: 'Morning reset, gym prep, evening shutdown.',
                },
                {
                  title: 'Tasks',
                  meaning: 'One-off or short-term obligations.',
                  differs: 'Unlike habits, tasks are transient — do them and move on.',
                  example: 'Call landlord, submit form, buy groceries.',
                },
                {
                  title: 'Journal',
                  meaning: 'Reflection, review, and self-observation.',
                  differs: 'Journal is your space for introspection, not tracking.',
                  example: 'Evening check-in, free write, weekly reflection.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-lg bg-neutral-800/50 border border-white/5 p-4">
                  <h4 className="text-sm font-semibold text-white mb-1.5">{item.title}</h4>
                  <p className="text-sm text-neutral-300 mb-1">{item.meaning}</p>
                  <p className="text-xs text-neutral-500 mb-2">{item.differs}</p>
                  <p className="text-xs text-neutral-500 italic">e.g. {item.example}</p>
                </div>
              ))}
            </div>
          ) : (

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

            {/* AI Integration */}
            <section>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
                AI Integration
              </h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="gemini-key" className="block text-sm text-neutral-300 mb-1.5">
                    Gemini API Key
                  </label>
                  <p className="text-[11px] text-neutral-500 mb-2">
                    Add your Google Gemini API key to enable AI-powered weekly summaries.
                    Your key is stored locally and never saved on the server.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        id="gemini-key"
                        type={showGeminiKey ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIza..."
                        className="w-full px-3 py-2 pr-9 rounded-lg bg-neutral-800 text-neutral-200 border border-white/10 text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                        aria-label={showGeminiKey ? 'Hide key' : 'Show key'}
                      >
                        {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveGeminiKey}
                      className="px-3 py-2 rounded-lg bg-emerald-600/80 text-white hover:bg-emerald-600 text-sm whitespace-nowrap"
                    >
                      {geminiKeySaved ? 'Saved!' : 'Save'}
                    </button>
                  </div>
                  {geminiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setGeminiKey('');
                        setGeminiApiKey('');
                      }}
                      className="mt-2 text-xs text-red-400 hover:text-red-300"
                    >
                      Remove key
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Learn More */}
            <section>
              <button
                type="button"
                onClick={() => setShowLearnMore(true)}
                className="w-full px-4 py-2.5 rounded-lg bg-neutral-800 text-neutral-200 border border-white/10 hover:bg-neutral-700 text-sm text-left flex items-center justify-between"
              >
                How HabitFlow Works
                <ChevronRight size={16} className="text-neutral-500" />
              </button>
            </section>

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
                        disabled={isDeleting}
                        onClick={async () => {
                          setIsDeleting(true);
                          try {
                            await deleteAllUserData();
                            setShowDeleteConfirm(false);
                            onClose();
                            window.location.reload();
                          } catch (err) {
                            console.error('Failed to delete user data:', err);
                            alert('Failed to delete data. Please try again.');
                          } finally {
                            setIsDeleting(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 text-sm"
                      >
                        {isDeleting ? 'Deleting...' : 'Yes, delete everything'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
