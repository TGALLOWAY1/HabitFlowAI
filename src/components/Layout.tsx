import React, { useMemo, useState, useRef, useEffect } from 'react';
import { LayoutGrid, Settings, User, LogOut, Info, Eye, EyeOff, FlaskConical } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import { useAuth } from '../store/AuthContext';
import { useDashboardPrefs } from '../store/DashboardPrefsContext';
import { getActiveUserMode, seedDemoEmotionalWellbeing, resetDemoEmotionalWellbeing } from '../lib/persistenceClient';
import { SettingsModal } from './SettingsModal';
import { InfoModal } from './InfoModal';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { refreshHabitsAndCategories } = useHabitStore();
    const { user, logout } = useAuth();
    const { hideStreaks, setHideStreaks } = useDashboardPrefs();
    const isBetaUser = user?.email?.toLowerCase() === 'tj.galloway1@gmail.com';
    const isDev = import.meta.env.DEV;
    const isDemo = getActiveUserMode() === 'demo';
    const [devNotice, setDevNotice] = useState<string | null>(null);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const demoBadge = useMemo(() => {
        if (!isDemo) return null;
        return (
            <span className="ml-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-rose-500/15 text-rose-300 border border-rose-500/30">
                DEMO DATA
            </span>
        );
    }, [isDemo]);

    const handleSeedDemo = async () => {
        await seedDemoEmotionalWellbeing();
        await refreshHabitsAndCategories();
        if (isDev) {
            console.info('[Demo] Seeded demo data');
            setDevNotice('Seeded demo data');
            setTimeout(() => setDevNotice(null), 2500);
        }
        // Trigger lightweight refetches without a full reload
        window.dispatchEvent(new Event('habitflow:demo-data-changed'));
    };

    const handleResetDemo = async () => {
        await resetDemoEmotionalWellbeing();
        await refreshHabitsAndCategories();
        if (isDev) {
            console.info('[Demo] Reset demo data');
            setDevNotice('Reset demo data');
            setTimeout(() => setDevNotice(null), 2500);
        }
        window.dispatchEvent(new Event('habitflow:demo-data-changed'));
    };

    // Listen for requests to open settings from other components
    useEffect(() => {
        const handleOpenSettings = () => setSettingsOpen(true);
        window.addEventListener('habitflow:open-settings', handleOpenSettings);
        return () => window.removeEventListener('habitflow:open-settings', handleOpenSettings);
    }, []);

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
        };

        if (userMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [userMenuOpen]);

    return (
        <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-emerald-500/30">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 pt-[env(safe-area-inset-top,0px)] h-[calc(4rem+env(safe-area-inset-top,0px))] bg-neutral-900/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-50">
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
                    {isDev && devNotice && (
                        <div className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/20">
                            {devNotice}
                        </div>
                    )}
                    {isDev && isDemo && (
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
                    <button
                        onClick={() => setInfoOpen(true)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white"
                        title="How HabitFlow Works"
                    >
                        <Info size={20} />
                    </button>
                    <button
                        onClick={() => setSettingsOpen(true)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white"
                        title="Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <div ref={userMenuRef} className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="min-h-[44px] min-w-[44px] bg-neutral-800 rounded-full flex items-center justify-center border border-white/10 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                            aria-label="User menu"
                        >
                            <User size={16} />
                        </button>

                        {userMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-white/10 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                <div className="py-1">
                                    {user?.displayName && (
                                        <div className="px-4 py-2 text-sm text-neutral-300 border-b border-white/5">
                                            {user.displayName}
                                        </div>
                                    )}
                                    {user?.email && (
                                        <div className="px-4 py-1.5 text-xs text-neutral-500">
                                            {user.email}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setHideStreaks(!hideStreaks)}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        {hideStreaks ? <Eye size={14} /> : <EyeOff size={14} />}
                                        {hideStreaks ? 'Show streaks' : 'Hide streaks'}
                                    </button>
                                    {isBetaUser && (
                                        <button
                                            onClick={() => {
                                                const searchParams = new URLSearchParams(window.location.search);
                                                searchParams.set('view', 'analysis-beta');
                                                const url = `${window.location.pathname}?${searchParams.toString()}`;
                                                window.history.pushState({ view: 'analysis-beta' }, '', url);
                                                window.dispatchEvent(new PopStateEvent('popstate'));
                                                setUserMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                                        >
                                            <FlaskConical size={14} />
                                            Analysis (Beta)
                                        </button>
                                    )}
                                    <button
                                        onClick={async () => {
                                            setUserMenuOpen(false);
                                            await logout();
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        <LogOut size={14} />
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content - safe-area for notched devices */}
            <main className="pt-[calc(4rem+env(safe-area-inset-top,0px))] px-4 pb-20 max-w-7xl mx-auto min-h-screen">
                {children}
            </main>
            <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />
            <InfoModal
                isOpen={infoOpen}
                onClose={() => setInfoOpen(false)}
            />
        </div>
    );
};
