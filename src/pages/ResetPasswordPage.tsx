/**
 * ResetPasswordPage — set a new password using a token from the reset email.
 *
 * Reads the token from `?token=...`. On success, returns the user to the
 * sign-in screen with a success notice; the reset endpoint also invalidates
 * any prior sessions, so the user must log in fresh with the new password.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { LayoutGrid } from 'lucide-react';

interface ResetPasswordPageProps {
  onDone: (message?: string) => void;
}

const MIN_PASSWORD_LENGTH = 8;

function readTokenFromQuery(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') ?? '';
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onDone }) => {
  const { resetPassword } = useAuth();
  const [token, setToken] = useState<string>(() => readTokenFromQuery());
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setToken(readTokenFromQuery());
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!token) {
      setLocalError('This reset link is missing its token. Request a new one.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await resetPassword(token, password);
    setLoading(false);

    if (!result.ok) {
      setLocalError(result.error || 'Password reset failed.');
      return;
    }
    onDone('Password updated. Please sign in with your new password.');
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
            <LayoutGrid size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
            HabitFlow
          </h1>
          <p className="text-neutral-500 text-sm mt-1">Choose a new password</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-neutral-800/50 border border-white/10 rounded-xl p-6 space-y-4 backdrop-blur-sm"
        >
          {localError && (
            <div className="p-3 text-sm text-red-200 bg-red-600/20 border border-red-500/30 rounded-lg">
              {localError}
            </div>
          )}

          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium text-neutral-300 mb-1.5">
              New password
            </label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-900 text-white px-3 py-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-colors placeholder:text-neutral-600"
              placeholder="At least 8 characters"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="reset-confirm" className="block text-sm font-medium text-neutral-300 mb-1.5">
              Confirm new password
            </label>
            <input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-neutral-900 text-white px-3 py-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-colors placeholder:text-neutral-600"
              placeholder="Re-enter your new password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-6">
          <button
            type="button"
            onClick={() => onDone()}
            className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
};
