/**
 * AuthGate — renders children when authenticated, login/invite/forgot/reset
 * pages when not. Shows a loading spinner during session check.
 *
 * The reset-password view is auto-selected when the URL path is
 * `/reset-password` (the link emailed by the password-reset flow). After a
 * successful reset we land back on the login view with a success banner so
 * the user can sign in with their new password.
 */

import React, { useEffect, useState, Suspense } from 'react';
import { useAuth } from '../store/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { InviteRedeemPage } from '../pages/InviteRedeemPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { Loader2 } from 'lucide-react';

// Lazy-loaded so the tour/roadmap chunks aren't pulled into the initial auth bundle.
const TourPage = React.lazy(() => import('../pages/TourPage').then(m => ({ default: m.TourPage })));
const RoadmapPage = React.lazy(() => import('../pages/RoadmapPage').then(m => ({ default: m.RoadmapPage })));

type AuthView = 'login' | 'invite' | 'forgot' | 'reset' | 'tour' | 'roadmap';

function initialView(): AuthView {
  if (typeof window !== 'undefined' && window.location.pathname === '/reset-password') {
    return 'reset';
  }
  return 'login';
}

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const [view, setView] = useState<AuthView>(() => initialView());
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  // After a successful reset/clear, drop the ?token= from the URL so the
  // emailed link can't be reopened to retry against an already-used token.
  useEffect(() => {
    if (view !== 'reset' && window.location.pathname === '/reset-password') {
      window.history.replaceState({}, '', '/');
    }
  }, [view]);

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
    if (view === 'forgot') {
      return <ForgotPasswordPage onBackToLogin={() => setView('login')} />;
    }
    if (view === 'reset') {
      return (
        <ResetPasswordPage
          onDone={(message) => {
            setLoginNotice(message ?? null);
            setView('login');
          }}
        />
      );
    }
    if (view === 'tour') {
      return (
        <Suspense
          fallback={
            <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
              <Loader2 size={32} className="text-emerald-500 animate-spin" />
            </div>
          }
        >
          <TourPage
            mode="auth"
            onCreateAccount={() => setView('invite')}
            onSignIn={() => setView('login')}
            onBack={() => setView('login')}
          />
        </Suspense>
      );
    }
    if (view === 'roadmap') {
      return (
        <Suspense
          fallback={
            <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
              <Loader2 size={32} className="text-emerald-500 animate-spin" />
            </div>
          }
        >
          <RoadmapPage mode="auth" onBack={() => setView('tour')} />
        </Suspense>
      );
    }
    return (
      <LoginPage
        onSwitchToInvite={() => setView('invite')}
        onSwitchToForgotPassword={() => setView('forgot')}
        onViewTour={() => setView('tour')}
        successMessage={loginNotice}
      />
    );
  }

  return <>{children}</>;
};
