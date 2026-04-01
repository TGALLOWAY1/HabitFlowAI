import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../store/AuthContext';

const BETA_EMAIL = 'tj.galloway1@gmail.com';

interface AnalysisBetaPageProps {
  onBack: () => void;
}

export const AnalysisBetaPage: React.FC<AnalysisBetaPageProps> = ({ onBack }) => {
  const { user } = useAuth();
  const isAuthorized = user?.email?.toLowerCase() === BETA_EMAIL;

  useEffect(() => {
    if (!isAuthorized) {
      onBack();
    }
  }, [isAuthorized, onBack]);

  if (!isAuthorized) return null;

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-neutral-400 hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-white">Analysis (Beta)</h2>
      </div>

      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
        <p className="text-neutral-400 text-sm">Analysis features coming soon.</p>
      </div>
    </div>
  );
};
