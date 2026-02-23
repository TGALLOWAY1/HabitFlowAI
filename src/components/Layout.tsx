import React, { useMemo, useState, useRef, useEffect } from 'react';
import { LayoutGrid, Settings, User, Check } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import { getActiveUserMode, seedDemoEmotionalWellbeing, resetDemoEmotionalWellbeing } from '../lib/persistenceClient';
import { getActivePersonaId, setActivePersonaId } from '../shared/personas/activePersona';
import { DEFAULT_PERSONA_ID, EMOTIONAL_PERSONA_ID, FITNESS_PERSONA_ID } from '../shared/personas/personaConstants';
import type { PersonaId } from '../shared/personas/personaTypes';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { refreshHabitsAndCategories } = useHabitStore();
    const isDev = import.meta.env.DEV;
    const isDemo = getActiveUserMode() === 'demo';
    const [devNotice, setDevNotice] = useState<string | null>(null);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [activePersonaId, setActivePersonaIdState] = useState<PersonaId>(getActivePersonaId());
    const userMenuRef = useRef<HTMLDivElement>(null);

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

    // Listen for persona changes
    useEffect(() => {
        const handlePersonaChange = () => {
            setActivePersonaIdState(getActivePersonaId());
        };
        window.addEventListener('habitflow:personaChanged', handlePersonaChange);
        return () => window.removeEventListener('habitflow:personaChanged', handlePersonaChange);
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

    const handlePersonaSelect = (personaId: PersonaId) => {
        setActivePersonaId(personaId);
        setActivePersonaIdState(personaId);
        setUserMenuOpen(false);
    };

    const personaOptions = [
        { id: DEFAULT_PERSONA_ID, label: 'Default Dashboard' },
        { id: EMOTIONAL_PERSONA_ID, label: 'Emotional Wellbeing' },
        { id: FITNESS_PERSONA_ID, label: 'Fitness Focused' },
    ];

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
                        onClick={handleRefresh}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white"
                        title="Refresh Habits and Categories"
                    >
                        <Settings size={20} />
                    </button>
                    <div ref={userMenuRef} className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center border border-white/10 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                            aria-label="User menu"
                        >
                            <User size={16} />
                        </button>

                        {userMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-white/10 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                <div className="py-1">
                                    <div className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider border-b border-white/5">
                                        Persona
                                    </div>
                                    {personaOptions.map((option) => {
                                        const isActive = option.id === activePersonaId;
                                        return (
                                            <button
                                                key={option.id}
                                                onClick={() => handlePersonaSelect(option.id)}
                                                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                                                    isActive
                                                        ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                                                        : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                                                }`}
                                            >
                                                {isActive && <Check size={14} className="text-emerald-400" />}
                                                <span className={isActive ? '' : 'ml-6'}>{option.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-20 px-4 pb-20 max-w-7xl mx-auto min-h-screen">
                {children}
            </main>
        </div>
    );
};
