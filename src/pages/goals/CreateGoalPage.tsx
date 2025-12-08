import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface CreateGoalPageProps {
    onNext?: (data: {
        title: string;
        type: 'cumulative' | 'frequency';
        targetValue: number;
        unit?: string;
        deadline?: string;
    }) => void;
}

export const CreateGoalPage: React.FC<CreateGoalPageProps> = ({ onNext }) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'cumulative' | 'frequency'>('cumulative');
    const [targetValue, setTargetValue] = useState('');
    const [unit, setUnit] = useState('');
    const [deadline, setDeadline] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title.trim()) {
            return;
        }

        const targetValueNum = parseFloat(targetValue);
        if (isNaN(targetValueNum) || targetValueNum <= 0) {
            return;
        }

        const goalData = {
            title: title.trim(),
            type,
            targetValue: targetValueNum,
            unit: unit.trim() || undefined,
            deadline: deadline || undefined,
        };

        if (onNext) {
            onNext(goalData);
        }
    };

    const isFormValid = title.trim().length > 0 && 
                       targetValue !== '' && 
                       !isNaN(parseFloat(targetValue)) && 
                       parseFloat(targetValue) > 0;

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Create Goal</h1>
                <p className="text-neutral-400">Set up your goal details</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                        Goal Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                        placeholder="e.g., Run 100 miles"
                        required
                    />
                </div>

                {/* Type */}
                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                        Goal Type
                    </label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as 'cumulative' | 'frequency')}
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                        <option value="cumulative">Cumulative</option>
                        <option value="frequency">Frequency</option>
                    </select>
                    <p className="mt-1 text-xs text-neutral-500">
                        {type === 'cumulative' 
                            ? 'Track total progress over time (e.g., "Run 100 miles total")'
                            : 'Track how often a goal is met (e.g., "Exercise 3 times per week")'}
                    </p>
                </div>

                {/* Target Value */}
                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                        Target Value
                    </label>
                    <input
                        type="number"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                        placeholder="e.g., 100"
                        min="0.01"
                        step="0.01"
                        required
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                        {type === 'cumulative' 
                            ? 'Total value to achieve (e.g., 100 for "100 miles")'
                            : 'Number of times to achieve (e.g., 3 for "3 times per week")'}
                    </p>
                </div>

                {/* Unit */}
                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                        Unit <span className="text-neutral-500">(Optional)</span>
                    </label>
                    <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                        placeholder="e.g., miles, times, hours"
                    />
                </div>

                {/* Deadline */}
                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                        Deadline <span className="text-neutral-500">(Optional)</span>
                    </label>
                    <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                        min={new Date().toISOString().split('T')[0]}
                    />
                </div>

                {/* Footer with Next Button */}
                <div className="pt-6 border-t border-white/5 flex justify-end">
                    <button
                        type="submit"
                        disabled={!isFormValid}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                            isFormValid
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-900'
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
