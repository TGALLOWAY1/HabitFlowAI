import React, { useState } from 'react';
import { ArrowRight, Target, Repeat, CalendarCheck, Check } from 'lucide-react';

interface CreateGoalPageProps {
    onNext?: (data: {
        title: string;
        type: 'cumulative' | 'frequency' | 'onetime';
        targetValue: number;
        unit?: string;
        deadline?: string;
    }) => void;
}

export const CreateGoalPage: React.FC<CreateGoalPageProps> = ({ onNext }) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'cumulative' | 'frequency' | 'onetime'>('cumulative');
    const [targetValue, setTargetValue] = useState('');
    const [unit, setUnit] = useState('');
    const [deadline, setDeadline] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            return;
        }

        let targetValueNum = parseFloat(targetValue);

        // For one-time goals, targetValue is not used, so we can mock it or set to 0/1 depending on backend requirement
        // Backend allows targetValue to be optional now, but typescript interface here might need adjustment or we send dummy.
        // Actually interface expects number. Let's send 1 for onetime if undefined.
        if (type === 'onetime') {
            targetValueNum = 1; // Default dummy value
        } else {
            if (isNaN(targetValueNum) || targetValueNum <= 0) {
                return;
            }
        }

        const goalData = {
            title: title.trim(),
            type,
            targetValue: targetValueNum,
            unit: type !== 'onetime' ? (unit.trim() || undefined) : undefined,
            deadline: deadline || undefined,
        };

        if (onNext) {
            onNext(goalData);
        }
    };

    const isFormValid = (() => {
        if (!title.trim()) return false;

        if (type === 'onetime') {
            return !!deadline; // Deadline (Event Date) is required for onetime
        } else {
            // For others, target value > 0 is required
            return targetValue !== '' && !isNaN(parseFloat(targetValue)) && parseFloat(targetValue) > 0;
        }
    })();

    return (
        <div className="w-full max-w-2xl mx-auto pb-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Create Goal</h1>
                <p className="text-neutral-400">Set up your goal details</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Title */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-neutral-300">
                        Goal Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-lg placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        placeholder="e.g., Run a Marathon"
                        required
                    />
                </div>

                {/* Goal Type Selection */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-neutral-300">
                        Goal Type
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={() => setType('cumulative')}
                            className={`p-4 rounded-xl border text-left transition-all relative ${type === 'cumulative'
                                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20'
                                    : 'bg-neutral-900/50 border-white/5 hover:border-white/10 hover:bg-neutral-800/50'
                                }`}
                        >
                            <div className={`p-2 rounded-lg inline-flex mb-3 ${type === 'cumulative' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                                }`}>
                                <Target size={20} />
                            </div>
                            <div className="text-white font-medium mb-1">Cumulative</div>
                            <div className="text-xs text-neutral-400 leading-relaxed">
                                Reach a specific total volume or number over time.
                            </div>
                            {type === 'cumulative' && (
                                <div className="absolute top-3 right-3 text-emerald-500">
                                    <Check size={16} />
                                </div>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setType('frequency')}
                            className={`p-4 rounded-xl border text-left transition-all relative ${type === 'frequency'
                                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20'
                                    : 'bg-neutral-900/50 border-white/5 hover:border-white/10 hover:bg-neutral-800/50'
                                }`}
                        >
                            <div className={`p-2 rounded-lg inline-flex mb-3 ${type === 'frequency' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                                }`}>
                                <Repeat size={20} />
                            </div>
                            <div className="text-white font-medium mb-1">Frequency</div>
                            <div className="text-xs text-neutral-400 leading-relaxed">
                                Maintain a consistency target (e.g. 3x/week).
                            </div>
                            {type === 'frequency' && (
                                <div className="absolute top-3 right-3 text-emerald-500">
                                    <Check size={16} />
                                </div>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setType('onetime')}
                            className={`p-4 rounded-xl border text-left transition-all relative ${type === 'onetime'
                                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20'
                                    : 'bg-neutral-900/50 border-white/5 hover:border-white/10 hover:bg-neutral-800/50'
                                }`}
                        >
                            <div className={`p-2 rounded-lg inline-flex mb-3 ${type === 'onetime' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                                }`}>
                                <CalendarCheck size={20} />
                            </div>
                            <div className="text-white font-medium mb-1">One-Time Event</div>
                            <div className="text-xs text-neutral-400 leading-relaxed">
                                Train for a specific event on a specific date.
                            </div>
                            {type === 'onetime' && (
                                <div className="absolute top-3 right-3 text-emerald-500">
                                    <Check size={16} />
                                </div>
                            )}
                        </button>
                    </div>
                </div>

                {/* Conditional Fields based on Type */}
                {type !== 'onetime' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Target Value */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-neutral-300">
                                Target Value
                            </label>
                            <input
                                type="number"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                placeholder={type === 'cumulative' ? "e.g., 100" : "e.g., 3"}
                                min="0.01"
                                step="0.01"
                                required
                            />
                            <p className="text-xs text-neutral-500">
                                {type === 'cumulative'
                                    ? 'Total value to achieve (e.g., 100 for "100 miles")'
                                    : 'Number of times to achieve per week'}
                            </p>
                        </div>

                        {/* Unit */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-neutral-300">
                                Unit <span className="text-neutral-500 font-normal">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                placeholder="e.g., miles, sessions"
                            />
                        </div>

                        {/* Deadline (Optional for Cumulative/Frequency) */}
                        <div className="space-y-3 md:col-span-2">
                            <label className="block text-sm font-medium text-neutral-300">
                                Deadline <span className="text-neutral-500 font-normal">(Optional)</span>
                            </label>
                            <input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                        {/* Event Date (Required for OneTime) */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-neutral-300">
                                Event Date <span className="text-emerald-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="w-full bg-neutral-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                min={new Date().toISOString().split('T')[0]}
                                required
                            />
                            <p className="text-xs text-neutral-500">
                                When is the big day?
                            </p>
                        </div>
                    </div>
                )}


                {/* Footer with Next Button */}
                <div className="pt-6 border-t border-white/5 flex justify-end">
                    <button
                        type="submit"
                        disabled={!isFormValid}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${isFormValid
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-900 shadow-lg shadow-emerald-500/20'
                                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            }`}
                    >
                        Next: Link Habits
                        <ArrowRight size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
};
