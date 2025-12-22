import React, { useMemo, useState } from 'react';
import { LayoutGrid, Settings, User } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import { getActiveUserMode, setActiveUserMode, seedDemoEmotionalWellbeing, resetDemoEmotionalWellbeing } from '../lib/persistenceClient';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { refreshHabitsAndCategories } = useHabitStore();
    const isDev = import.meta.env.DEV;
    const [userMode, setUserMode] = useState<'real' | 'demo'>(() => getActiveUserMode());
    const isDemo = userMode === 'demo';

    const demoBadge = useMemo(() => {
        if (!isDemo) return null;
        return (
            <span className="ml-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-rose-500/15 text-rose-300 border border-rose-500/30">
                DEMO DATA
            </span>
        );
    }, [isDemo]);

    const handleRefresh = async () => {
        await refreshHabitsAndCategories();
    };

    const handleToggleMode = (mode: 'real' | 'demo') => {
        setActiveUserMode(mode);
        setUserMode(mode);
        // Hard refresh so all queries re-run under the new userId identity header
        window.location.reload();
    };

    const handleSeedDemo = async () => {
        await seedDemoEmotionalWellbeing();
        await refreshHabitsAndCategories();
        window.location.reload();
    };

    const handleResetDemo = async () => {
        await resetDemoEmotionalWellbeing();
        await refreshHabitsAndCategories();
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-emerald-500/30">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-neutral-900/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <LayoutGrid size={18} className="text-white" />
                    </div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                        HabitFlow
                    </h1>
                    {demoBadge}
                </div>

                <div className="flex items-center gap-4">
                    {isDev && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-neutral-800/60 border border-white/10 rounded-full overflow-hidden">
                                <button
                                    onClick={() => handleToggleMode('real')}
                                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${!isDemo ? 'bg-white/10 text-white' : 'text-neutral-300 hover:text-white'}`}
                                    title="Use your real local user data"
                                >
                                    Use My Data
                                </button>
                                <button
                                    onClick={() => handleToggleMode('demo')}
                                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${isDemo ? 'bg-rose-500/20 text-rose-200' : 'text-neutral-300 hover:text-white'}`}
                                    title="Switch to demo dataset (DEMO_USER_ID)"
                                >
                                    Demo: Emotional Wellbeing
                                </button>
                            </div>

                            {isDemo && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleSeedDemo}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                                        title="Seed demo wellbeing + gratitude journal data (server-guarded)"
                                    >
                                        Seed Demo Data
                                    </button>
                                    <button
                                        onClick={handleResetDemo}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-full bg-rose-500/15 text-rose-200 border border-rose-500/30 hover:bg-rose-500/25 transition-colors"
                                        title="Reset demo wellbeing + gratitude journal data (server-guarded)"
                                    >
                                        Reset Demo Data
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <button
                        onClick={handleRefresh}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white"
                        title="Refresh Habits and Categories"
                    >
                        <Settings size={20} />
                    </button>
                    <button className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center border border-white/10 text-neutral-400">
                        <User size={16} />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-20 px-4 pb-20 max-w-7xl mx-auto min-h-screen flex flex-col">
                {children}
            </main>
        </div>
    );
};
