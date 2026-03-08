/**
 * LoginPage — email + password login form.
 * Matches the app's dark theme (neutral-900, emerald accents).
 */

import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { LayoutGrid } from 'lucide-react';

interface LoginPageProps {
  onSwitchToInvite: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToInvite }) => {
  const { login, error: authError, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError || authError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim()) {
      setLocalError('Email is required.');
      return;
    }
    if (!password) {
      setLocalError('Password is required.');
      return;
    }

    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);

    if (!result.ok) {
      setLocalError(result.error || 'Login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
            <LayoutGrid size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
            HabitFlow
          </h1>
          <p className="text-neutral-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-neutral-800/50 border border-white/10 rounded-xl p-6 space-y-4 backdrop-blur-sm"
        >
          {error && (
            <div className="p-3 text-sm text-red-200 bg-red-600/20 border border-red-500/30 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-neutral-300 mb-1.5">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-900 text-white px-3 py-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-colors placeholder:text-neutral-600"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-neutral-300 mb-1.5">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-900 text-white px-3 py-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-colors placeholder:text-neutral-600"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Switch to invite */}
        <p className="text-center text-sm text-neutral-500 mt-6">
          Have an invite code?{' '}
          <button
            type="button"
            onClick={onSwitchToInvite}
            className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
};
