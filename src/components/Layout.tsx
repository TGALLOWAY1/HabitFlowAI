import React, { useMemo, useState, useRef, useEffect } from 'react';
import { LayoutGrid, Settings, User, LogOut, Info, Eye, EyeOff, FlaskConical, Sun, Moon, Monitor } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import { useAuth } from '../store/AuthContext';
import { useDashboardPrefs } from '../store/DashboardPrefsContext';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeMode } from '../theme/palette';
import { getActiveUserMode, seedDemoEmotionalWellbeing, resetDemoEmotionalWellbeing } from '../lib/persistenceClient';
import { SettingsModal } from './SettingsModal';
import { InfoModal } from './InfoModal';

interface LayoutProps {
    children: React.ReactNode;
}

const THEME_OPTIONS: ReadonlyArray<{ mode: ThemeMode; label: string; Icon: typeof Sun }> = [
    { mode: 'light', label: 'Light', Icon: Sun },
    { mode: 'dark', label: 'Dark', Icon: Moon },
    { mode: 'system', label: 'System', Icon: Monitor },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { refreshHabitsAndCategories } = useHabitStore();
    const { user, logout } = useAuth();
    const { hideStreaks, setHideStreaks, setThemeMode } = useDashboardPrefs();
    const { mode } = useTheme();
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
            <span className="ml-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-danger-soft text-danger-contrast border border-danger/30">
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
        <div className="min-h-screen bg-surface-0 text-content-primary font-sans selection:bg-accent/30">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 pt-[env(safe-area-inset-top,0px)] h-[calc(4rem+env(safe-area-inset-top,0px))] bg-surface-0/80 backdrop-blur-md border-b border-line-subtle flex items-center justify-between px-6 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-contrast rounded-lg flex items-center justify-center shadow-lg shadow-accent/20">
                        <LayoutGrid size={18} className="text-content-on-accent" />
                    </div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-content-primary to-content-muted">
                        HabitFlow
                    </h1>
                    {demoBadge}
                </div>

                <div className="flex items-center gap-4">
                    {isDev && devNotice && (
                        <div className="text-xs px-3 py-1.5 rounded-full bg-accent-soft text-accent-contrast border border-accent/20">
                            {devNotice}
                        </div>
                    )}
                    {isDev && isDemo && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleSeedDemo}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-full bg-accent-soft text-accent-contrast border border-accent/30 hover:bg-surface-2 transition-colors"
                                        title="Seed demo wellbeing + gratitude journal data (server-guarded)"
                                    >
                                        Seed Demo Data
                                    </button>
                                    <button
                                        onClick={handleResetDemo}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-full bg-danger-soft text-danger-contrast border border-danger/30 hover:bg-surface-2 transition-colors"
                                        title="Reset demo wellbeing + gratitude journal data (server-guarded)"
                                    >
                                        Reset Demo Data
                                    </button>
                                </div>
                    )}
                    <button
                        onClick={() => setInfoOpen(true)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-surface-2 rounded-full transition-colors text-content-secondary hover:text-content-primary"
                        title="How HabitFlow Works"
                    >
                        <Info size={20} />
                    </button>
                    <button
                        onClick={() => setSettingsOpen(true)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-surface-2 rounded-full transition-colors text-content-secondary hover:text-content-primary"
                        title="Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <div ref={userMenuRef} className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="min-h-[44px] min-w-[44px] bg-surface-1 rounded-full flex items-center justify-center border border-line-subtle text-content-secondary hover:bg-surface-2 hover:text-content-primary transition-colors"
                            aria-label="User menu"
                        >
                            <User size={16} />
                        </button>

                        {userMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-60 bg-surface-1 border border-line-subtle rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                <div className="py-1">
                                    {user?.displayName && (
                                        <div className="px-4 py-2 text-sm text-content-secondary border-b border-line-subtle">
                                            {user.displayName}
                                        </div>
                                    )}
                                    {user?.email && (
                                        <div className="px-4 py-1.5 text-xs text-content-muted">
                                            {user.email}
                                        </div>
                                    )}
                                    {/* Appearance quick toggle — sits inside the user menu. */}
                                    <div className="px-4 py-2 border-b border-line-subtle">
                                        <div className="text-[11px] uppercase tracking-wide text-content-muted mb-1.5">Appearance</div>
                                        <div
                                            role="radiogroup"
                                            aria-label="Theme"
                                            className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-2 border border-line-subtle"
                                        >
                                            {THEME_OPTIONS.map(({ mode: optionMode, label, Icon }) => {
                                                const isActive = mode === optionMode;
                                                return (
                                                    <button
                                                        key={optionMode}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={isActive}
                                                        onClick={() => setThemeMode(optionMode)}
                                                        className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                                            isActive
                                                                ? 'bg-surface-1 text-accent-contrast shadow-sm'
                                                                : 'text-content-secondary hover:text-content-primary'
                                                        }`}
                                                    >
                                                        <Icon size={13} />
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setHideStreaks(!hideStreaks)}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-content-secondary hover:text-content-primary hover:bg-surface-2 transition-colors"
                                    >
                                        {hideStreaks ? <Eye size={14} /> : <EyeOff size={14} />}
                                        {hideStreaks ? 'Show streaks' : 'Hide streaks'}
                                    </button>
                                    {isBetaUser && (
                                        <button
                                            onClick={() => {
                                                const searchParams = new URLSearchParams(window.location.search);
                                                searchParams.set('view', 'analytics');
                                                const url = `${window.location.pathname}?${searchParams.toString()}`;
                                                window.history.pushState({ view: 'analytics' }, '', url);
                                                window.dispatchEvent(new PopStateEvent('popstate'));
                                                setUserMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-content-secondary hover:text-content-primary hover:bg-surface-2 transition-colors"
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
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-content-secondary hover:text-content-primary hover:bg-surface-2 transition-colors"
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
                onNavigate={(route) => {
                    const url = `${window.location.pathname}?view=${route}`;
                    window.history.pushState({ view: route }, '', url);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }}
            />
            <InfoModal
                isOpen={infoOpen}
                onClose={() => setInfoOpen(false)}
            />
        </div>
    );
};
