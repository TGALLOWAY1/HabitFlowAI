import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, Check, Shield } from 'lucide-react';
import type { Habit } from '../models/persistenceTypes';
import { DayChipSelector } from './DayChipSelector';
import { NumberChipSelector } from './NumberChipSelector';

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
    const [requiredDaysPerWeek, setRequiredDaysPerWeek] = useState<number>(7);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (habit) {
            const days = habit.assignedDays || [0, 1, 2, 3, 4, 5, 6];
            setAssignedDays(days);
            setTime(habit.scheduledTime || '');
            setDuration(habit.durationMinutes || 30);
            setRequiredDaysPerWeek(habit.requiredDaysPerWeek ?? days.length);
        }
    }, [habit]);

    // Auto-clamp requiredDaysPerWeek when assignedDays shrinks
    useEffect(() => {
        if (requiredDaysPerWeek > assignedDays.length) {
            setRequiredDaysPerWeek(assignedDays.length);
        }
    }, [assignedDays.length, requiredDaysPerWeek]);

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

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(habit.id, {
                assignedDays,
                scheduledTime: time,
                durationMinutes: duration,
                nonNegotiable: assignedDays.length === 7 && requiredDaysPerWeek === 7,
                requiredDaysPerWeek,
            });
            onClose();
        } catch (error) {
            console.error('Failed to save habit:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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

                    {/* Scheduled Days */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-400 uppercase flex items-center gap-1">
                            <Calendar size={12} /> Scheduled Days
                        </label>
                        <DayChipSelector
                            selectedDays={assignedDays}
                            onChange={setAssignedDays}
                            minSelected={1}
                        />
                    </div>

                    {/* Days Per Week Required */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-400 uppercase flex items-center gap-1">
                            <Shield size={12} /> Days Per Week Required
                        </label>
                        <NumberChipSelector
                            value={requiredDaysPerWeek}
                            onChange={setRequiredDaysPerWeek}
                            min={1}
                            max={assignedDays.length}
                        />
                        {assignedDays.length === 7 && requiredDaysPerWeek === 7 && (
                            <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                                <Shield size={10} /> Non-Negotiable — all days required
                            </p>
                        )}
                        {requiredDaysPerWeek < assignedDays.length && (
                            <p className="text-xs text-emerald-400 mt-1">
                                {assignedDays.length - requiredDaysPerWeek} grace day{assignedDays.length - requiredDaysPerWeek !== 1 ? 's' : ''} per week
                            </p>
                        )}
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
