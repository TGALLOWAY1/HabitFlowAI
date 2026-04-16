import { useState, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import { getGeminiApiKey, setGeminiApiKey } from '../lib/geminiClient';
import { deleteAllUserData, isHealthFeatureEnabled } from '../lib/persistenceClient';
import { Eye, EyeOff, Sparkles, Activity, ChevronRight } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (route: string) => void;
}

export function SettingsModal({ isOpen, onClose, onNavigate }: SettingsModalProps) {
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => getGeminiApiKey());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const handleReopenGuide = useCallback(() => {
    try { localStorage.removeItem('hf_setup_guide_dismissed'); } catch { /* noop */ }
    window.dispatchEvent(new Event('habitflow:reopen-setup-guide'));
    onClose();
  }, [onClose]);

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
          className="relative bg-surface-0 border border-line-subtle rounded-xl shadow-xl max-w-sm w-full mx-auto my-8 sm:my-16"
          role="dialog"
          aria-labelledby="settings-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-line-subtle flex items-center justify-between">
            <h2 id="settings-title" className="text-lg font-semibold text-content-primary">
              Settings
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-content-secondary hover:text-content-primary rounded-lg hover:bg-surface-2"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-5">
            {/* Account */}
            {user?.displayName && (
              <section>
                <h3 className="text-xs font-medium text-content-muted uppercase tracking-wider mb-2">
                  Account
                </h3>
                <div className="text-sm text-content-primary">
                  {user.displayName}
                </div>
              </section>
            )}

            {/* Setup Guide */}
            <section>
              <button
                type="button"
                onClick={handleReopenGuide}
                className="w-full px-4 py-2.5 rounded-lg bg-surface-1 text-content-primary border border-line-subtle hover:bg-surface-2 text-sm text-left flex items-center gap-2"
              >
                <Sparkles size={16} className="text-accent-contrast flex-shrink-0" />
                Reopen setup guide
              </button>
            </section>

            {/* Apple Health Integration */}
            {isHealthFeatureEnabled(user?.email) && (
              <section>
                <h3 className="text-xs font-medium text-content-muted uppercase tracking-wider mb-2">
                  Integrations
                </h3>
                <button
                  type="button"
                  onClick={() => { onNavigate?.('health'); onClose(); }}
                  className="w-full px-4 py-2.5 rounded-lg bg-surface-1 text-content-primary border border-line-subtle hover:bg-surface-2 text-sm text-left flex items-center gap-2"
                >
                  <Activity size={16} className="text-accent-contrast flex-shrink-0" />
                  <span className="flex-1">Apple Health</span>
                  <ChevronRight size={16} className="text-content-muted" />
                </button>
              </section>
            )}

            {/* AI Integration */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-medium text-content-muted uppercase tracking-wider">
                  AI Integration
                </h3>
                <span className="text-[10px] text-content-muted font-medium">(~3 mins to set up)</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="gemini-key" className="block text-sm text-content-secondary mb-1.5">
                    Gemini API Key
                  </label>
                  <p className="text-[11px] text-content-muted mb-2">
                    Add your Google Gemini API key to enable AI-powered weekly summaries.
                    Your key is stored locally and never saved on the server.
                  </p>
                  <ol className="text-[11px] text-content-muted mb-3 space-y-1 pl-4 list-decimal">
                    <li>Go to{' '}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-contrast hover:text-accent-contrast underline underline-offset-2"
                      >
                        Google AI Studio
                      </a>
                    </li>
                    <li>Sign in with your Google account</li>
                    <li>Click <span className="text-content-secondary font-medium">Create API Key</span></li>
                    <li>Copy the key and paste it below</li>
                  </ol>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        id="gemini-key"
                        type={showGeminiKey ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIza..."
                        className="w-full px-3 py-2 pr-9 rounded-lg bg-surface-1 text-content-primary border border-line-subtle text-sm placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-focus/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary"
                        aria-label={showGeminiKey ? 'Hide key' : 'Show key'}
                      >
                        {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveGeminiKey}
                      className="px-3 py-2 rounded-lg bg-emerald-600/80 text-content-primary hover:bg-emerald-600 text-sm whitespace-nowrap"
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

            {/* Data */}
            <section>
              <h3 className="text-xs font-medium text-content-muted uppercase tracking-wider mb-3">
                Data
              </h3>
              <div className="space-y-3">
                {/* Delete data */}
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-2.5 rounded-lg bg-surface-1 text-red-400 border border-line-subtle hover:bg-surface-2 text-sm text-left"
                  >
                    Delete my data
                  </button>
                ) : (
                  <div className="rounded-lg bg-surface-1/50 border border-red-500/30 p-3 space-y-3">
                    <p className="text-sm text-content-secondary">
                      This will permanently delete all your habits, logs, and settings. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-lg bg-surface-2 text-content-primary border border-line-subtle hover:bg-surface-2 text-sm"
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
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-content-primary hover:bg-red-500 disabled:opacity-50 text-sm"
                      >
                        {isDeleting ? 'Deleting...' : 'Yes, delete everything'}
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
