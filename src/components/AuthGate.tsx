/**
 * AuthGate — renders children when authenticated, login/invite page when not.
 * Shows a loading spinner during session check.
 */

import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { InviteRedeemPage } from '../pages/InviteRedeemPage';
import { Loader2 } from 'lucide-react';

type AuthView = 'login' | 'invite';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const [view, setView] = useState<AuthView>('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-emerald-500 animate-spin" />
          <p className="text-neutral-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (view === 'invite') {
      return <InviteRedeemPage onSwitchToLogin={() => setView('login')} />;
    }
    return <LoginPage onSwitchToInvite={() => setView('invite')} />;
  }

  return <>{children}</>;
};
