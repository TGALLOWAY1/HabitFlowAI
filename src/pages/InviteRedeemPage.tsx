/**
 * InviteRedeemPage — create account with invite code.
 * Fields: invite code, email, password, display name.
 */

import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { LayoutGrid } from 'lucide-react';

interface InviteRedeemPageProps {
  onSwitchToLogin: () => void;
}

export const InviteRedeemPage: React.FC<InviteRedeemPageProps> = ({ onSwitchToLogin }) => {
  const { redeemInvite, error: authError, clearError } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError || authError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!inviteCode.trim()) {
      setLocalError('Invite code is required.');
      return;
    }
    if (!email.trim()) {
      setLocalError('Email is required.');
      return;
    }
    if (!password) {
      setLocalError('Password is required.');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (!displayName.trim()) {
      setLocalError('Display name is required.');
      return;
    }

    setLoading(true);
    const result = await redeemInvite(inviteCode.trim(), email.trim(), password, displayName.trim());
    setLoading(false);

    if (!result.ok) {
      setLocalError(result.error || 'Account creation failed.');
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
          <p className="text-neutral-500 text-sm mt-1">Create your account</p>
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
            <label htmlFor="invite-code" className="block text-sm font-medium text-neutral-300 mb-1.5">
              Invite Code
            </label>
            <input
              id="invite-code"
              type="text"
              autoComplete="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full bg-neutral-900 text-white px-3 py-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-colors placeholder:text-neutral-600 font-mono tracking-wider"
              placeholder="Enter your invite code"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="invite-name" className="block text-sm font-medium text-neutral-300 mb-1.5">
              Display Name
            </label>
            <input
              id="invite-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-neutral-900 text-white px-3 py-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-colors placeholder:text-neutral-600"
              placeholder="Your name"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-neutral-300 mb-1.5">
              Email
            </label>
            <input
              id="invite-email"
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
            <label htmlFor="invite-password" className="block text-sm font-medium text-neutral-300 mb-1.5">
              Password
            </label>
            <input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-900 text-white px-3 py-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-colors placeholder:text-neutral-600"
              placeholder="Min 8 chars, mixed case, digit, special char"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Switch to login */}
        <p className="text-center text-sm text-neutral-500 mt-6">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
