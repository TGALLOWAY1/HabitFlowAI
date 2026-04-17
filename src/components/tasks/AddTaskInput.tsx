import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useTasks } from '../../context/TaskContext';

interface AddTaskInputProps {
    defaultPlacement?: 'inbox' | 'today';
    placeholder?: string;
}

export const AddTaskInput: React.FC<AddTaskInputProps> = ({
    defaultPlacement = 'inbox',
    placeholder = "Add a task..."
}) => {
    const { addTask } = useTasks();
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || isSubmitting) return;

        try {
            setIsSubmitting(true);
            await addTask({
                title: title.trim(),
                listPlacement: defaultPlacement
            });
            setTitle('');
        } catch (error) {
            console.error('Failed to add task', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500">
                <Plus size={16} />
            </div>
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={placeholder}
                disabled={isSubmitting}
                enterKeyHint="done"
                className="
          w-full bg-surface-0 border border-line-subtle rounded-lg py-2.5 pl-9 pr-10
          text-base sm:text-sm text-content-primary placeholder-neutral-500
          focus:outline-none focus:border-line-strong focus:bg-surface-1
          transition-all duration-200
        "
            />
            {title.trim() && (
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-accent-contrast hover:bg-accent-strong/20 transition-colors disabled:opacity-50"
                >
                    <Check size={16} />
                </button>
            )}
        </form>
    );
};
