import React, { useState, useEffect } from 'react';
import { X, Save, Sun, Moon, Battery, Activity, Brain } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import { format } from 'date-fns';
import type { WellbeingSession } from '../types';

interface DailyCheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const INITIAL_SESSION: WellbeingSession = {
    depression: 3,
    anxiety: 3,
    energy: 3,
    sleepScore: 75,
    notes: ''
};

export const DailyCheckInModal: React.FC<DailyCheckInModalProps> = ({ isOpen, onClose }) => {
    const { logWellbeing, wellbeingLogs } = useHabitStore();
    const today = format(new Date(), 'yyyy-MM-dd');

    // Determine default tab based on time of day (before 5PM = Morning)
    const currentHour = new Date().getHours();
    const defaultTab = currentHour < 17 ? 'morning' : 'evening';

    const [activeTab, setActiveTab] = useState<'morning' | 'evening'>(defaultTab);

    // State for both sessions
    const [morningData, setMorningData] = useState<WellbeingSession>(INITIAL_SESSION);
    const [eveningData, setEveningData] = useState<WellbeingSession>(INITIAL_SESSION);

    // Load existing data
    useEffect(() => {
        if (isOpen && wellbeingLogs[today]) {
            const log = wellbeingLogs[today];
            if (log.morning) setMorningData(log.morning);
            if (log.evening) setEveningData(log.evening);
        }
    }, [isOpen, wellbeingLogs, today]);

    // Helper to update current session data
    const updateCurrentSession = (field: keyof WellbeingSession, value: any) => {
        if (activeTab === 'morning') {
            setMorningData(prev => ({ ...prev, [field]: value }));
        } else {
            setEveningData(prev => ({ ...prev, [field]: value }));
        }
    };

    const currentData = activeTab === 'morning' ? morningData : eveningData;

    const handleSave = async () => {
        try {
            await logWellbeing(today, {
                date: today,
                [activeTab]: currentData
            });
            onClose();
        } catch (error) {
            console.error('Failed to save wellbeing log:', error);
            // Still close modal even if API fails (fallback to localStorage)
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header with Tabs */}
                <div className="border-b border-white/5 bg-neutral-800/50">
                    <div className="flex items-center justify-between p-4 pb-0">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            Daily Check-in
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex px-4 mt-4 gap-4">
                        <button
                            onClick={() => setActiveTab('morning')}
                            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'morning'
                                ? 'border-amber-400 text-white'
                                : 'border-transparent text-neutral-400 hover:text-white'
                                }`}
                        >
                            <Sun size={16} className={activeTab === 'morning' ? 'text-amber-400' : ''} />
                            Morning
                        </button>
                        <button
                            onClick={() => setActiveTab('evening')}
                            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'evening'
                                ? 'border-indigo-400 text-white'
                                : 'border-transparent text-neutral-400 hover:text-white'
                                }`}
                        >
                            <Moon size={16} className={activeTab === 'evening' ? 'text-indigo-400' : ''} />
                            Evening
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Depression */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <label className="text-neutral-300 font-medium flex items-center gap-2">
                                <Brain size={16} className="text-blue-400" /> Depression
                            </label>
                            <span className="text-blue-400 font-bold">{currentData.depression}/5</span>
                        </div>
                        <input
                            type="range"
                            min="1" max="5" step="1"
                            value={currentData.depression}
                            onChange={(e) => updateCurrentSession('depression', Number(e.target.value))}
                            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-neutral-500 px-1">
                            <span>Low</span>
                            <span>High</span>
                        </div>
                    </div>

                    {/* Anxiety */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <label className="text-neutral-300 font-medium flex items-center gap-2">
                                <Activity size={16} className="text-purple-400" /> Anxiety
                            </label>
                            <span className="text-purple-400 font-bold">{currentData.anxiety}/5</span>
                        </div>
                        <input
                            type="range"
                            min="1" max="5" step="1"
                            value={currentData.anxiety}
                            onChange={(e) => updateCurrentSession('anxiety', Number(e.target.value))}
                            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-xs text-neutral-500 px-1">
                            <span>Low</span>
                            <span>High</span>
                        </div>
                    </div>

                    {/* Energy (Evening Only) */}
                    {activeTab === 'evening' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="flex justify-between text-sm">
                                <label className="text-neutral-300 font-medium flex items-center gap-2">
                                    <Battery size={16} className="text-emerald-400" /> Energy
                                </label>
                                <span className="text-emerald-400 font-bold">{currentData.energy}/5</span>
                            </div>
                            <input
                                type="range"
                                min="1" max="5" step="1"
                                value={currentData.energy}
                                onChange={(e) => updateCurrentSession('energy', Number(e.target.value))}
                                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <div className="flex justify-between text-xs text-neutral-500 px-1">
                                <span>Low</span>
                                <span>High</span>
                            </div>
                        </div>
                    )}

                    {/* Sleep Score (Morning Only) */}
                    {activeTab === 'morning' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex justify-between text-sm">
                                <label className="text-neutral-300 font-medium flex items-center gap-2">
                                    <Moon size={16} className="text-indigo-400" /> Sleep Score
                                </label>
                                <span className="text-indigo-400 font-bold">{currentData.sleepScore}</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="100" step="1"
                                value={currentData.sleepScore}
                                onChange={(e) => updateCurrentSession('sleepScore', Number(e.target.value))}
                                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-sm text-neutral-300 font-medium">Notes (Optional)</label>
                        <textarea
                            value={currentData.notes}
                            onChange={(e) => updateCurrentSession('notes', e.target.value)}
                            placeholder={`How are you feeling this ${activeTab}?`}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none resize-none h-20"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-neutral-800/50 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                    >
                        <Save size={18} />
                        Save {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Check-in
                    </button>
                </div>
            </div>
        </div>
    );
};
