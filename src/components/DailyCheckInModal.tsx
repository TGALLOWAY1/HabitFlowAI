import React, { useState, useEffect } from 'react';
import { X, Save, Sun, Moon, Battery, Activity, Brain, Wind, Target, Focus as FocusIcon, Heart } from 'lucide-react';
import { useHabitStore } from '../store/HabitContext';
import { format } from 'date-fns';
import type { WellbeingSession } from '../types';
import { WELLBEING_METRIC_KEYS, type WellbeingMetricKey } from '../models/persistenceTypes';
import { getActivePersonaConfig } from '../shared/personas/activePersona';

interface DailyCheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const INITIAL_SESSION: WellbeingSession = {
    // Legacy/compat (1-5)
    depression: 3,
    anxiety: 3,
    energy: 3,
    // Legacy (0-100)
    sleepScore: 75,
    // New subjective superset (0-4)
    lowMood: 2,
    calm: 2,
    stress: 2,
    focus: 2,
    sleepQuality: 2,
    notes: ''
};

type MetricUiConfig = {
    key: WellbeingMetricKey;
    label: string;
    icon: React.ReactNode;
    colorClass: string;
    min: number;
    max: number;
    step: number;
    /** Optional: show only in a specific tab */
    tab?: 'morning' | 'evening';
    /** Optional: render as textarea */
    kind?: 'number' | 'text';
};

const METRIC_UI: Record<WellbeingMetricKey, MetricUiConfig> = {
    depression: { key: 'depression', label: 'Depression (legacy)', icon: <Brain size={16} className="text-blue-400" />, colorClass: 'text-blue-400', min: 1, max: 5, step: 1, kind: 'number' },
    anxiety: { key: 'anxiety', label: 'Anxiety', icon: <Activity size={16} className="text-purple-400" />, colorClass: 'text-purple-400', min: 1, max: 5, step: 1, kind: 'number' },
    energy: { key: 'energy', label: 'Energy', icon: <Battery size={16} className="text-emerald-400" />, colorClass: 'text-emerald-400', min: 1, max: 5, step: 1, kind: 'number' },
    sleepScore: { key: 'sleepScore', label: 'Sleep score', icon: <Moon size={16} className="text-indigo-400" />, colorClass: 'text-indigo-400', min: 0, max: 100, step: 1, tab: 'morning', kind: 'number' },
    sleepQuality: { key: 'sleepQuality', label: 'Sleep quality (subjective)', icon: <Heart size={16} className="text-fuchsia-300" />, colorClass: 'text-fuchsia-300', min: 0, max: 4, step: 1, tab: 'morning', kind: 'number' },
    lowMood: { key: 'lowMood', label: 'Low Mood', icon: <Brain size={16} className="text-blue-400" />, colorClass: 'text-blue-400', min: 0, max: 4, step: 1, kind: 'number' },
    calm: { key: 'calm', label: 'Calm', icon: <Wind size={16} className="text-emerald-400" />, colorClass: 'text-emerald-400', min: 0, max: 4, step: 1, kind: 'number' },
    stress: { key: 'stress', label: 'Stress', icon: <Target size={16} className="text-orange-400" />, colorClass: 'text-orange-400', min: 0, max: 4, step: 1, kind: 'number' },
    focus: { key: 'focus', label: 'Focus', icon: <FocusIcon size={16} className="text-amber-300" />, colorClass: 'text-amber-300', min: 0, max: 4, step: 1, kind: 'number' },
    notes: { key: 'notes', label: 'Notes (Optional)', icon: null, colorClass: 'text-neutral-300', min: 0, max: 0, step: 1, kind: 'text' },
};

export const DailyCheckInModal: React.FC<DailyCheckInModalProps> = ({ isOpen, onClose }) => {
    const { logWellbeing, wellbeingLogs } = useHabitStore();
    const today = format(new Date(), 'yyyy-MM-dd');
    const persona = getActivePersonaConfig();
    const checkinSubset = persona.checkinSubset;
    const subsetSet = new Set(checkinSubset);

    // Determine default tab based on time of day (before 5PM = Morning)
    const currentHour = new Date().getHours();
    const defaultTab = currentHour < 17 ? 'morning' : 'evening';

    const [activeTab, setActiveTab] = useState<'morning' | 'evening'>(defaultTab);

    // State for both sessions
    const [morningData, setMorningData] = useState<WellbeingSession>(INITIAL_SESSION);
    const [eveningData, setEveningData] = useState<WellbeingSession>(INITIAL_SESSION);

    // Load existing data
    useEffect(() => {
        console.log('[DailyCheckInModal] useEffect - isOpen:', isOpen, 'today:', today, 'wellbeingLogs keys:', Object.keys(wellbeingLogs));
        if (isOpen && wellbeingLogs[today]) {
            const log = wellbeingLogs[today];
            console.log('[DailyCheckInModal] Loading existing log for today:', log);
            if (log.morning) setMorningData(log.morning);
            if (log.evening) setEveningData(log.evening);
        } else if (isOpen) {
            console.log('[DailyCheckInModal] No log found for today:', today, 'Available dates:', Object.keys(wellbeingLogs));
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
        console.log('[DailyCheckInModal] handleSave called with:', { today, activeTab, currentData });
        try {
            /**
             * Guardrail (dev-only):
             * Prevent introducing new wellbeing keys at runtime.
             * Only keys in WELLBEING_METRIC_KEYS are allowed (contract-locked).
             */
            if (import.meta.env.DEV) {
                for (const key of Object.keys(currentData)) {
                    if (!(WELLBEING_METRIC_KEYS as readonly string[]).includes(key)) {
                        throw new Error(
                            `Invalid wellbeing metric key "${key}". Do not create new keys at runtime. ` +
                            'Use WELLBEING_METRIC_KEYS (see docs/reference/00_DATA_CONTRACT_WELLBEING_KEYS.md).'
                        );
                    }
                }
            }

            // Only persist keys the persona is actually showing (plus notes if present).
            // This ensures persona changes don't silently write hidden metrics.
            const sessionPayload: Partial<WellbeingSession> = {};
            for (const key of WELLBEING_METRIC_KEYS) {
                if (key === 'notes') continue;
                if (!subsetSet.has(key)) continue;
                const cfg = METRIC_UI[key];
                if (cfg?.tab && cfg.tab !== activeTab) continue;
                (sessionPayload as any)[key] = (currentData as any)[key];
            }
            if (typeof currentData.notes === 'string' && currentData.notes.trim().length > 0) {
                sessionPayload.notes = currentData.notes;
            }

            const result = await logWellbeing(today, {
                date: today,
                [activeTab]: sessionPayload
            });
            console.log('[DailyCheckInModal] logWellbeing completed:', result);
            onClose();
        } catch (error) {
            console.error('[DailyCheckInModal] Failed to save wellbeing log:', error);
            // Still close modal even if API fails
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
                    {/* Render persona-selected metric subset from the canonical superset */}
                    {checkinSubset
                        .filter((k): k is WellbeingMetricKey => (WELLBEING_METRIC_KEYS as readonly string[]).includes(k))
                        .map((k) => {
                            const cfg = METRIC_UI[k];
                            if (!cfg) return null;
                            if (cfg.key === 'notes') return null; // Notes handled separately below
                            if (cfg.tab && cfg.tab !== activeTab) return null;

                            const rawValue = (currentData as any)[k];
                            const value = typeof rawValue === 'number' ? rawValue : cfg.min;

                            return (
                                <div key={k} className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <label className="text-neutral-300 font-medium flex items-center gap-2">
                                            {cfg.icon}
                                            {cfg.label}
                                        </label>
                                        <span className={`${cfg.colorClass} font-bold`}>
                                            {value}{cfg.max === 100 ? '' : `/${cfg.max}`}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={cfg.min}
                                        max={cfg.max}
                                        step={cfg.step}
                                        value={value}
                                        onChange={(e) => updateCurrentSession(k as any, Number(e.target.value))}
                                        className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    {(cfg.max <= 5) && (
                                        <div className="flex justify-between text-xs text-neutral-500 px-1">
                                            <span>Low</span>
                                            <span>High</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    {/* Notes (always available; stored only if non-empty) */}
                    <div className="space-y-2">
                        <label className="text-sm text-neutral-300 font-medium">Notes (Optional)</label>
                        <textarea
                            value={currentData.notes || ''}
                            onChange={(e) => updateCurrentSession('notes', e.target.value)}
                            placeholder={`How are you feeling this ${activeTab}?`}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none resize-none h-20"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-neutral-800/50 flex justify-end">
                    <button
                        onClick={(e) => {
                            console.log('[DailyCheckInModal] BUTTON CLICKED');
                            e.preventDefault();
                            handleSave();
                        }}
                        type="button"
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
