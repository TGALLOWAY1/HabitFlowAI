/**
 * CreateGoalTrackModal
 *
 * Modal for creating a new goal track. Collects name, category, and optional description.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { createGoalTrack } from '../../lib/persistenceClient';
import { useHabitStore } from '../../store/HabitContext';

interface CreateGoalTrackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (trackId: string) => void;
    /** Pre-select a category (e.g., when creating from a goal) */
    defaultCategoryId?: string;
}

export const CreateGoalTrackModal: React.FC<CreateGoalTrackModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    defaultCategoryId,
}) => {
    const { categories } = useHabitStore();
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState(defaultCategoryId || '');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !categoryId) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const track = await createGoalTrack({
                name: name.trim(),
                categoryId,
                description: description.trim() || undefined,
            });
            onSuccess?.(track.id);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create track');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-surface-0 border border-line-subtle rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-line-subtle">
                    <h2 className="text-lg font-semibold text-content-primary">Create Goal Track</h2>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-2 rounded-lg hover:bg-surface-1 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                        <X size={18} className="text-content-secondary" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-danger-soft border border-danger/30 rounded-lg text-sm text-danger-contrast">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1.5">Track Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Certification Path"
                            className="w-full px-3 py-2.5 bg-surface-1 border border-line-subtle rounded-lg text-content-primary text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-focus"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1.5">Category</label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full px-3 py-2.5 bg-surface-1 border border-line-subtle rounded-lg text-content-primary text-sm focus:outline-none focus:ring-1 focus:ring-focus"
                        >
                            <option value="">Select category...</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1.5">Description (optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this track about?"
                            rows={2}
                            className="w-full px-3 py-2.5 bg-surface-1 border border-line-subtle rounded-lg text-content-primary text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-focus resize-none"
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-medium text-content-primary bg-surface-2 hover:bg-surface-2 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim() || !categoryId}
                            className="px-4 py-2 text-sm font-medium text-content-on-accent bg-accent hover:bg-accent-strong rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Track'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
