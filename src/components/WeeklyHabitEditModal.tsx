import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, Check, Shield } from 'lucide-react';
import type { Habit } from '../models/persistenceTypes';

interface WeeklyHabitEditModalProps {
    habit: Habit | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Habit>) => Promise<void>;
}

export const WeeklyHabitEditModal: React.FC<WeeklyHabitEditModalProps> = ({ habit, isOpen, onClose, onSave }) => {
    const [assignedDays, setAssignedDays] = useState<number[]>([]);
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState(30);
    const [nonNegotiable, setNonNegotiable] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (habit) {
            setAssignedDays(habit.assignedDays || []);
            setTime(habit.scheduledTime || '');
            setDuration(habit.durationMinutes || 30);
            setNonNegotiable(habit.nonNegotiable || false);
        }
    }, [habit]);

    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !habit) return null;

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(habit.id, {
                assignedDays,
                scheduledTime: time,
                durationMinutes: duration,
                nonNegotiable
            });
            onClose();
        } catch (error) {
            console.error('Failed to save habit:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleDay = (index: number) => {
        setAssignedDays(prev =>
            prev.includes(index) ? prev.filter(d => d !== index) : [...prev, index]
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                    <h3 className="text-lg font-bold text-white truncate pr-4">{habit.name}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">

                    {/* Time & Duration */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-400 uppercase flex items-center gap-1">
                                <Clock size={12} /> Time
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-emerald-500 focus:outline-none transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-neutral-400 uppercase flex items-center gap-1">
                                <Clock size={12} /> Duration (min)
                            </label>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                min="5"
                                step="5"
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-emerald-500 focus:outline-none transition-colors"
                            />
                        </div>
                    </div>

                    {/* Days */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-400 uppercase flex items-center gap-1">
                            <Calendar size={12} /> Assigned Days
                        </label>
                        <div className="flex justify-between gap-1">
                            {days.map((d, i) => (
                                <button
                                    key={i}
                                    onClick={() => toggleDay(i)}
                                    className={`
                                        w-9 h-9 rounded-lg text-xs font-bold transition-all
                                        ${assignedDays.includes(i)
                                            ? 'bg-emerald-500 text-neutral-900 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'}
                                    `}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Non-Negotiable Toggle */}
                    <div className="bg-neutral-800/50 border border-white/5 rounded-lg p-3 flex items-center justify-between group cursor-pointer hover:bg-neutral-800 transition-colors"
                        onClick={() => setNonNegotiable(!nonNegotiable)}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg transition-colors ${nonNegotiable ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-700/50 text-neutral-500'}`}>
                                <Shield size={20} />
                            </div>
                            <div>
                                <h4 className={`font-medium transition-colors ${nonNegotiable ? 'text-yellow-400' : 'text-neutral-300'}`}>Non-Negotiable</h4>
                                <p className="text-xs text-neutral-500">Essential habit.</p>
                            </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${nonNegotiable ? 'bg-yellow-500' : 'bg-neutral-700'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${nonNegotiable ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-neutral-900 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-bold py-2 px-6 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Saving...' : (
                            <>
                                <Check size={18} /> Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
