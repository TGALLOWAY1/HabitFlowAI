import React from 'react';
import { LayoutGrid, Settings, User } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { refreshHabitsAndCategories } = useHabitStore();

    const handleRefresh = async () => {
        await refreshHabitsAndCategories();
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
                </div>

                <div className="flex items-center gap-4">
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
            <main className="pt-20 px-4 pb-20 max-w-7xl mx-auto h-screen flex flex-col">
                {children}
            </main>
        </div>
    );
};
