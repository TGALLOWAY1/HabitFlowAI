import React, { useState } from 'react';
import { useActivityStore } from '../store/ActivityContext';
import type { Activity } from '../types';
import { countHabitSteps } from '../lib/activityUtils';
import { Plus, Edit, Trash2, ClipboardList } from 'lucide-react';
import { cn } from '../utils/cn';

interface ActivityListProps {
    onCreate: () => void;
    onEdit: (activity: Activity) => void;
}

export const ActivityList: React.FC<ActivityListProps> = ({ onCreate, onEdit }) => {
    const { activities, loading, error, deleteActivity } = useActivityStore();
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleDelete = async (activity: Activity) => {
        if (deleteConfirmId === activity.id) {
            try {
                await deleteActivity(activity.id);
                setDeleteConfirmId(null);
            } catch (error) {
                console.error('Failed to delete activity:', error);
            }
        } else {
            setDeleteConfirmId(activity.id);
            setTimeout(() => setDeleteConfirmId(null), 5000);
        }
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-neutral-900/50 rounded-2xl border border-white/5 backdrop-blur-sm shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h2 className="text-2xl font-bold text-white">Activities</h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors"
                    >
                        <Plus size={18} />
                        Create Activity
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-neutral-400">Loading activities...</div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-red-400">Error: {error}</div>
                    </div>
                ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ClipboardList size={48} className="text-neutral-600 mb-4" />
                        <h3 className="text-lg font-medium text-neutral-300 mb-2">No activities yet</h3>
                        <p className="text-neutral-500 mb-6">Create your first activity to get started</p>
                        <button
                            onClick={onCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors"
                        >
                            <Plus size={18} />
                            Create Activity
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {activities.map((activity) => {
                            const habitStepsCount = countHabitSteps(activity);
                            const totalSteps = activity.steps.length;

                            return (
                                <div
                                    key={activity.id}
                                    className="group relative bg-neutral-800/50 border border-white/5 rounded-lg p-4 hover:bg-neutral-800/70 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-medium text-white mb-2">{activity.title}</h3>
                                            <div className="flex items-center gap-4 text-sm text-neutral-400">
                                                <span>{totalSteps} {totalSteps === 1 ? 'step' : 'steps'}</span>
                                                {habitStepsCount > 0 && (
                                                    <span className="text-emerald-400">
                                                        {habitStepsCount} {habitStepsCount === 1 ? 'habit step' : 'habit steps'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onEdit(activity)}
                                                className="p-2 rounded-lg text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                                                title="Edit Activity"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(activity)}
                                                className={cn(
                                                    "p-2 rounded-lg transition-all",
                                                    deleteConfirmId === activity.id
                                                        ? "bg-red-500/20 text-red-400"
                                                        : "text-neutral-400 hover:bg-neutral-700 hover:text-red-400"
                                                )}
                                                title={deleteConfirmId === activity.id ? "Click again to delete" : "Delete Activity"}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
