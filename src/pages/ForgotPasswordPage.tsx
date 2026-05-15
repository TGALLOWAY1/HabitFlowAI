/**
 * ForgotPasswordPage — request a password reset email.
 *
 * The backend always responds 200 to avoid leaking which emails are
 * registered, so the success copy is intentionally non-committal.
 */

import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { LayoutGrid } from 'lucide-react';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Email is required.');
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(email.trim());
    setLoading(false);

    if (!result.ok) {
      setLocalError(result.error || 'Could not request password reset.');
      return;
    }
    setSubmitted(true);
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
          <p className="text-neutral-500 text-sm mt-1">Reset your password</p>
        </div>

        {submitted ? (
          <div className="bg-neutral-800/50 border border-white/10 rounded-xl p-6 space-y-3 backdrop-blur-sm">
            <p className="text-sm text-emerald-300">Check your inbox.</p>
            <p className="text-sm text-neutral-300">
              If an account exists for that email, we&apos;ve sent a link to reset your password.
              The link expires in 15 minutes.
            </p>
          </div>
        ) : (
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
              <label htmlFor="forgot-email" className="block text-sm font-medium text-neutral-300 mb-1.5">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-900 text-white px-3 py-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-colors placeholder:text-neutral-600"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-neutral-500 mt-6">
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
};
